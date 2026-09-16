import { DEFAULT_SETTINGS } from '../config';
import type {
  Availability,
  Category,
  DataStore,
  InventoryMovement,
  NewSaleInput,
  PriceOption,
  Product,
  ProductInput,
  Sale,
  Settings,
} from '../types';
import { dayKey, monthKey, newId } from '../utils/format';
import { optimizeImage } from '../utils/image';

// MODO CLAUDE
// Se usa cuando la app está publicada como Artifact en claude.ai.
// Guarda los datos en la base de datos del Artifact y las fotos en su almacenamiento.
// Solo quien puede editar el Artifact entra a /admin.
//
// Organización de los documentos:
//   products/{id}          un documento por producto (precios incluidos)
//   categories/{id}        un documento por categoría
//   settings/main          ajustes (WhatsApp, frase, etc.)
//   sales/{AAAA-MM-DD}     todas las ventas de un día
//   movements/{AAAA-MM}    movimientos de inventario de un mes

type AnyObject = Record<string, any>;

function toProduct(id: string, data: AnyObject): Product {
  const imageRef = typeof data.imageRef === 'string' && data.imageRef !== '' ? data.imageRef : null;
  const prices: PriceOption[] = [];
  if (Array.isArray(data.prices)) {
    for (const price of data.prices) {
      prices.push({ id: String(price.id), quantity: Number(price.quantity), price: Number(price.price) });
    }
  }
  return {
    id: id,
    name: String(data.name || ''),
    description: String(data.description || ''),
    categoryId: data.categoryId ? String(data.categoryId) : null,
    sku: String(data.sku || ''),
    stock: Number(data.stock || 0),
    availability: (data.availability || 'auto') as Availability,
    visible: data.visible !== false,
    prices: prices,
    imageRef: imageRef,
    imageUrl: imageRef ? '/_blob/' + imageRef : null,
    isDemo: data.isDemo === true,
    createdAt: String(data.createdAt || ''),
    updatedAt: String(data.updatedAt || ''),
  };
}

function productToDocument(product: Product): AnyObject {
  return {
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    sku: product.sku,
    stock: product.stock,
    availability: product.availability,
    visible: product.visible,
    prices: product.prices.map(function (price) {
      return { id: price.id, quantity: price.quantity, price: price.price };
    }),
    imageRef: product.imageRef,
    isDemo: product.isDemo,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function createClaudeStore(runtime: any): Promise<DataStore | null> {
  const db = await runtime.use('db');
  if (!db) {
    return null;
  }
  const assets = await runtime.use('assets');
  const user = await runtime.use('user');

  // Las operaciones se hacen una por una para no pisar datos.
  let queue: Promise<unknown> = Promise.resolve();
  function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.catch(function () {
      return undefined;
    });
    return result;
  }

  async function readProduct(productId: string): Promise<Product | null> {
    const snapshot = await db.doc('products/' + productId).get();
    if (!snapshot.exists) {
      return null;
    }
    return toProduct(snapshot.id, snapshot.data());
  }

  async function addMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<void> {
    const now = new Date();
    const reference = db.doc('movements/' + monthKey(now));
    const snapshot = await reference.get();
    let entries: InventoryMovement[] = [];
    if (snapshot.exists && Array.isArray(snapshot.data().entries)) {
      entries = snapshot.data().entries.slice();
    }
    entries.push({
      id: newId(),
      createdAt: now.toISOString(),
      productId: movement.productId,
      change: movement.change,
      reason: movement.reason,
      saleId: movement.saleId,
    });
    if (entries.length > 1500) {
      entries = entries.slice(-1500);
    }
    await reference.set({ month: monthKey(now), entries: entries });
  }

  async function changeStock(productId: string, change: number): Promise<number | null> {
    const product = await readProduct(productId);
    if (!product) {
      return null;
    }
    const newStock = Math.max(0, product.stock + change);
    await db.doc('products/' + productId).update({ stock: newStock, updatedAt: new Date().toISOString() });
    return newStock;
  }

  const store: DataStore = {
    mode: 'claude',

    async loadCatalog() {
      const results = await Promise.all([
        db.collection('products').get(),
        db.collection('categories').get(),
        db.doc('settings/main').get(),
      ]);

      const products: Product[] = [];
      for (const snapshot of results[0].docs) {
        products.push(toProduct(snapshot.id, snapshot.data()));
      }

      const categories: Category[] = [];
      for (const snapshot of results[1].docs) {
        const data = snapshot.data();
        categories.push({ id: snapshot.id, name: String(data.name || ''), position: Number(data.position || 0) });
      }
      categories.sort(function (a, b) {
        return a.position - b.position;
      });

      let settings: Settings = { ...DEFAULT_SETTINGS };
      if (results[2].exists) {
        settings = { ...DEFAULT_SETTINGS, ...(results[2].data() as Partial<Settings>) };
      }

      return { products: products, categories: categories, settings: settings };
    },

    async getAdminAccess() {
      if (!user) {
        return 'denied';
      }
      const canEdit = await user.canEdit();
      if (canEdit) {
        return 'allowed';
      }
      return 'denied';
    },

    async login() {
      // En Claude el acceso depende de los permisos del Artifact.
    },

    async logout() {
      // En Claude el acceso depende de los permisos del Artifact.
    },

    saveProduct(input: ProductInput) {
      return oneAtATime(async function () {
        const now = new Date().toISOString();
        let existing: Product | null = null;
        if (input.id !== null) {
          existing = await readProduct(input.id);
          if (!existing) {
            throw new Error('El producto ya no existe.');
          }
        }

        const product: Product = {
          id: existing ? existing.id : newId(),
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          sku: input.sku,
          stock: input.stock,
          availability: input.availability,
          visible: input.visible,
          prices: input.prices,
          imageRef: input.imageRef,
          imageUrl: null,
          isDemo: existing ? existing.isDemo : false,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
        await db.doc('products/' + product.id).set(productToDocument(product));

        const previousStock = existing ? existing.stock : 0;
        const change = product.stock - previousStock;
        if (change !== 0) {
          await addMovement({
            productId: product.id,
            change: change,
            reason: existing ? 'ajuste' : 'inicial',
            saleId: null,
          });
        }
        return product.id;
      });
    },

    deleteProduct(product: Product) {
      return oneAtATime(async function () {
        await db.doc('products/' + product.id).delete();
        if (product.imageRef && assets) {
          try {
            await assets.delete(product.imageRef);
          } catch (error) {
            // Si la foto ya no existe no pasa nada.
          }
        }
      });
    },

    async uploadImage(image: Blob) {
      if (!assets) {
        throw new Error('No tienes permiso para subir fotos en este Artifact.');
      }
      const optimized = await optimizeImage(image, 1200, 0.82);
      const result = await assets.upload(optimized, { type: optimized.type });
      return { ref: result.id, url: result.url };
    },

    async deleteImage(ref: string) {
      if (!assets) {
        return;
      }
      try {
        await assets.delete(ref);
      } catch (error) {
        // Si la foto ya no existe no pasa nada.
      }
    },

    saveCategory(name: string, id: string | null) {
      return oneAtATime(async function () {
        if (id !== null) {
          await db.doc('categories/' + id).update({ name: name });
          return id;
        }
        const existing = await db.collection('categories').get();
        const categoryId = newId();
        await db.doc('categories/' + categoryId).set({ name: name, position: existing.size + 1 });
        return categoryId;
      });
    },

    deleteCategory(id: string) {
      return oneAtATime(async function () {
        await db.doc('categories/' + id).delete();
        const products = await db.collection('products').where('categoryId', '==', id).get();
        for (const snapshot of products.docs) {
          await db.doc('products/' + snapshot.id).update({ categoryId: null });
        }
      });
    },

    saveSettings(settings: Settings) {
      return oneAtATime(async function () {
        await db.doc('settings/main').set({
          whatsappNumber: settings.whatsappNumber,
          tagline: settings.tagline,
          lowStockThreshold: settings.lowStockThreshold,
          legalNotice: settings.legalNotice,
        });
      });
    },

    setStock(productId: string, newStock: number) {
      return oneAtATime(async function () {
        const product = await readProduct(productId);
        if (!product) {
          throw new Error('El producto ya no existe.');
        }
        const change = newStock - product.stock;
        if (change === 0) {
          return;
        }
        await db.doc('products/' + productId).update({ stock: newStock, updatedAt: new Date().toISOString() });
        await addMovement({ productId: productId, change: change, reason: 'ajuste', saleId: null });
      });
    },

    registerSale(input: NewSaleInput) {
      return oneAtATime(async function () {
        const product = await readProduct(input.productId);
        if (!product) {
          throw new Error('El producto ya no existe.');
        }
        if (input.quantity <= 0) {
          throw new Error('La cantidad debe ser mayor que cero.');
        }
        if (product.stock < input.quantity) {
          throw new Error('No hay suficiente stock. Disponible: ' + product.stock + '.');
        }

        // 1. Descontar el stock.
        const newStock = product.stock - input.quantity;
        await db.doc('products/' + product.id).update({ stock: newStock, updatedAt: new Date().toISOString() });

        // 2. Guardar la venta en el documento del día.
        const now = new Date();
        const today = dayKey(now);
        const sale: Sale = {
          id: today + '_' + newId(),
          createdAt: now.toISOString(),
          status: 'activa',
          cancelledAt: null,
          total: input.total,
          items: [
            {
              productId: product.id,
              productName: product.name,
              quantity: input.quantity,
              priceLabel: input.priceLabel,
              lineTotal: input.total,
            },
          ],
        };

        try {
          const dayReference = db.doc('sales/' + today);
          const daySnapshot = await dayReference.get();
          let entries: Sale[] = [];
          if (daySnapshot.exists && Array.isArray(daySnapshot.data().entries)) {
            entries = daySnapshot.data().entries.slice();
          }
          entries.push(sale);
          await dayReference.set({ day: today, entries: entries });
        } catch (error) {
          // Si la venta no se pudo guardar, se devuelve el stock.
          await db.doc('products/' + product.id).update({ stock: product.stock });
          throw error;
        }

        // 3. Registrar el movimiento de inventario.
        await addMovement({ productId: product.id, change: -input.quantity, reason: 'venta', saleId: sale.id });
        return newStock;
      });
    },

    cancelSale(saleId: string) {
      return oneAtATime(async function () {
        const day = saleId.split('_')[0];
        const dayReference = db.doc('sales/' + day);
        const daySnapshot = await dayReference.get();
        if (!daySnapshot.exists) {
          throw new Error('La venta no existe.');
        }
        const entries: Sale[] = daySnapshot.data().entries.map(function (entry: Sale) {
          return { ...entry };
        });
        const sale = entries.find(function (entry) {
          return entry.id === saleId;
        });
        if (!sale) {
          throw new Error('La venta no existe.');
        }
        if (sale.status === 'anulada') {
          return;
        }

        // 1. Marcar la venta como anulada.
        sale.status = 'anulada';
        sale.cancelledAt = new Date().toISOString();
        await dayReference.set({ day: day, entries: entries });

        // 2. Devolver las unidades al inventario.
        for (const item of sale.items) {
          if (item.productId) {
            const updated = await changeStock(item.productId, item.quantity);
            if (updated !== null) {
              await addMovement({
                productId: item.productId,
                change: item.quantity,
                reason: 'anulacion',
                saleId: sale.id,
              });
            }
          }
        }
      });
    },

    async loadSales() {
      const snapshot = await db.collection('sales').orderBy('day', 'desc').limit(60).get();
      const sales: Sale[] = [];
      for (const daySnapshot of snapshot.docs) {
        const data = daySnapshot.data();
        if (Array.isArray(data.entries)) {
          for (const entry of data.entries) {
            sales.push(entry as Sale);
          }
        }
      }
      sales.sort(function (a, b) {
        return b.createdAt.localeCompare(a.createdAt);
      });
      return sales;
    },

    async resetDemo() {
      throw new Error('Esta opción solo existe en el modo local.');
    },
  };

  return store;
}
