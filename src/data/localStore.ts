import { DEFAULT_SETTINGS } from '../config';
import type {
  Category,
  DataStore,
  InventoryMovement,
  NewSaleInput,
  Product,
  ProductInput,
  Sale,
  Settings,
} from '../types';
import { blobToDataUrl, optimizeImage } from '../utils/image';
import { newId } from '../utils/format';
import { DEMO_CATEGORIES, makeDemoProducts } from './demoData';

// MODO LOCAL (demostración)
// Guarda todo en el navegador de este dispositivo (localStorage).
// Sirve para probar la app sin configurar nada. No se comparte con otros celulares.

const STORAGE_KEY = 'nebula-demo-data-v1';

interface LocalDatabase {
  products: Product[];
  categories: Category[];
  settings: Settings;
  sales: Sale[];
  movements: InventoryMovement[];
}

let memoryCopy: LocalDatabase | null = null;

function createDemoDatabase(): LocalDatabase {
  const products = makeDemoProducts();
  const movements: InventoryMovement[] = [];
  for (const product of products) {
    movements.push({
      id: newId(),
      productId: product.id,
      change: product.stock,
      reason: 'inicial',
      saleId: null,
      createdAt: product.createdAt,
    });
  }
  return {
    products: products,
    categories: DEMO_CATEGORIES.slice(),
    settings: { ...DEFAULT_SETTINGS },
    sales: [],
    movements: movements,
  };
}

function readDatabase(): LocalDatabase {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (text) {
      const parsed = JSON.parse(text) as LocalDatabase;
      parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      return parsed;
    }
  } catch (error) {
    // Si localStorage no está disponible se usa la copia en memoria.
  }
  if (memoryCopy) {
    return memoryCopy;
  }
  const fresh = createDemoDatabase();
  writeDatabase(fresh);
  return fresh;
}

function writeDatabase(database: LocalDatabase): void {
  memoryCopy = database;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'QuotaExceededError') {
      throw new Error('El navegador no tiene más espacio. Elimina algunas fotos o productos de prueba.');
    }
  }
}

function addMovement(database: LocalDatabase, movement: Omit<InventoryMovement, 'id' | 'createdAt'>): void {
  database.movements.push({
    id: newId(),
    createdAt: new Date().toISOString(),
    productId: movement.productId,
    change: movement.change,
    reason: movement.reason,
    saleId: movement.saleId,
  });
  if (database.movements.length > 1000) {
    database.movements = database.movements.slice(-1000);
  }
}

export function createLocalStore(): DataStore {
  const store: DataStore = {
    mode: 'local',

    async loadCatalog() {
      const database = readDatabase();
      const categories = database.categories.slice();
      categories.sort(function (a, b) {
        return a.position - b.position;
      });
      return {
        products: database.products,
        categories: categories,
        settings: database.settings,
      };
    },

    async getAdminAccess() {
      return 'allowed';
    },

    async login() {
      // En modo local no hay inicio de sesión.
    },

    async logout() {
      // En modo local no hay inicio de sesión.
    },

    async saveProduct(input: ProductInput) {
      const database = readDatabase();
      const now = new Date().toISOString();

      if (input.id === null) {
        const product: Product = {
          id: newId(),
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          sku: input.sku,
          stock: input.stock,
          availability: input.availability,
          visible: input.visible,
          prices: input.prices,
          imageRef: input.imageRef,
          imageUrl: input.imageUrl,
          isDemo: false,
          createdAt: now,
          updatedAt: now,
        };
        database.products.push(product);
        if (product.stock !== 0) {
          addMovement(database, { productId: product.id, change: product.stock, reason: 'inicial', saleId: null });
        }
        writeDatabase(database);
        return product.id;
      }

      const existing = database.products.find(function (item) {
        return item.id === input.id;
      });
      if (!existing) {
        throw new Error('El producto ya no existe.');
      }
      const stockChange = input.stock - existing.stock;
      existing.name = input.name;
      existing.description = input.description;
      existing.categoryId = input.categoryId;
      existing.sku = input.sku;
      existing.stock = input.stock;
      existing.availability = input.availability;
      existing.visible = input.visible;
      existing.prices = input.prices;
      existing.imageRef = input.imageRef;
      existing.imageUrl = input.imageUrl;
      existing.updatedAt = now;
      if (stockChange !== 0) {
        addMovement(database, { productId: existing.id, change: stockChange, reason: 'ajuste', saleId: null });
      }
      writeDatabase(database);
      return existing.id;
    },

    async deleteProduct(product: Product) {
      const database = readDatabase();
      database.products = database.products.filter(function (item) {
        return item.id !== product.id;
      });
      writeDatabase(database);
    },

    async uploadImage(image: Blob) {
      // En modo local la foto se guarda dentro del navegador, más pequeña.
      const smaller = await optimizeImage(image, 800, 0.75);
      const dataUrl = await blobToDataUrl(smaller);
      return { ref: 'local-' + newId(), url: dataUrl };
    },

    async deleteImage() {
      // La foto local desaparece al quitarla del producto.
    },

    async saveCategory(name: string, id: string | null) {
      const database = readDatabase();
      if (id !== null) {
        const category = database.categories.find(function (item) {
          return item.id === id;
        });
        if (category) {
          category.name = name;
        }
        writeDatabase(database);
        return id;
      }
      const newCategory: Category = {
        id: newId(),
        name: name,
        position: database.categories.length + 1,
      };
      database.categories.push(newCategory);
      writeDatabase(database);
      return newCategory.id;
    },

    async deleteCategory(id: string) {
      const database = readDatabase();
      database.categories = database.categories.filter(function (item) {
        return item.id !== id;
      });
      for (const product of database.products) {
        if (product.categoryId === id) {
          product.categoryId = null;
        }
      }
      writeDatabase(database);
    },

    async saveSettings(settings: Settings) {
      const database = readDatabase();
      database.settings = settings;
      writeDatabase(database);
    },

    async setStock(productId: string, newStock: number) {
      const database = readDatabase();
      const product = database.products.find(function (item) {
        return item.id === productId;
      });
      if (!product) {
        throw new Error('El producto ya no existe.');
      }
      const change = newStock - product.stock;
      product.stock = newStock;
      product.updatedAt = new Date().toISOString();
      if (change !== 0) {
        addMovement(database, { productId: productId, change: change, reason: 'ajuste', saleId: null });
      }
      writeDatabase(database);
    },

    async registerSale(input: NewSaleInput) {
      const database = readDatabase();
      const product = database.products.find(function (item) {
        return item.id === input.productId;
      });
      if (!product) {
        throw new Error('El producto ya no existe.');
      }
      if (input.quantity <= 0) {
        throw new Error('La cantidad debe ser mayor que cero.');
      }
      if (product.stock < input.quantity) {
        throw new Error('No hay suficiente stock. Disponible: ' + product.stock + '.');
      }

      product.stock = product.stock - input.quantity;
      product.updatedAt = new Date().toISOString();

      const sale: Sale = {
        id: newId(),
        createdAt: new Date().toISOString(),
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
      database.sales.push(sale);
      if (database.sales.length > 500) {
        database.sales = database.sales.slice(-500);
      }
      addMovement(database, { productId: product.id, change: -input.quantity, reason: 'venta', saleId: sale.id });
      writeDatabase(database);
      return product.stock;
    },

    async cancelSale(saleId: string) {
      const database = readDatabase();
      const sale = database.sales.find(function (item) {
        return item.id === saleId;
      });
      if (!sale) {
        throw new Error('La venta no existe.');
      }
      if (sale.status === 'anulada') {
        return;
      }
      for (const item of sale.items) {
        const product = database.products.find(function (candidate) {
          return candidate.id === item.productId;
        });
        if (product) {
          product.stock = product.stock + item.quantity;
          product.updatedAt = new Date().toISOString();
          addMovement(database, { productId: product.id, change: item.quantity, reason: 'anulacion', saleId: sale.id });
        }
      }
      sale.status = 'anulada';
      sale.cancelledAt = new Date().toISOString();
      writeDatabase(database);
    },

    async loadSales() {
      const database = readDatabase();
      const sales = database.sales.slice();
      sales.sort(function (a, b) {
        return b.createdAt.localeCompare(a.createdAt);
      });
      return sales;
    },

    async resetDemo() {
      memoryCopy = null;
      const fresh = createDemoDatabase();
      writeDatabase(fresh);
    },
  };

  return store;
}
