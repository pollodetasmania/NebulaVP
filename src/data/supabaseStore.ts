import { DEFAULT_SETTINGS, SUPABASE_ANON_KEY, SUPABASE_BUCKET, SUPABASE_URL } from '../config';
import type {
  Availability,
  Category,
  DataStore,
  NewSaleInput,
  PriceOption,
  Product,
  ProductInput,
  Sale,
  SaleItem,
  Settings,
} from '../types';
import { newId } from '../utils/format';
import { optimizeImage } from '../utils/image';

// MODO SUPABASE (para publicar en Vercel o Netlify)
// Usa la API de Supabase directamente con fetch, sin librerías extra.
// El catálogo es público. El panel /admin pide correo y contraseña (Supabase Auth).
// Las tablas, permisos y funciones están en supabase/schema.sql

const SESSION_KEY = 'nebula-admin-session';

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // milisegundos
}

type AnyObject = Record<string, any>;

function readSession(): Session | null {
  try {
    const text = window.localStorage.getItem(SESSION_KEY);
    if (text) {
      return JSON.parse(text) as Session;
    }
  } catch (error) {
    // Sin sesión guardada.
  }
  return null;
}

function writeSession(session: Session | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch (error) {
    // Si no se puede guardar, la sesión dura mientras la página esté abierta.
  }
}

function sessionFromResponse(data: AnyObject): Session {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const text = data.message || data.msg || data.error_description || data.error || '';
    if (text === 'Invalid login credentials') {
      return 'Correo o contraseña incorrectos.';
    }
    if (text) {
      return String(text);
    }
  } catch (error) {
    // La respuesta no era JSON.
  }
  return 'Error del servidor (' + response.status + ').';
}

function toProduct(row: AnyObject): Product {
  const prices: PriceOption[] = [];
  if (Array.isArray(row.product_prices)) {
    for (const price of row.product_prices) {
      prices.push({ id: price.id, quantity: Number(price.quantity), price: Number(price.price) });
    }
  }
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    categoryId: row.category_id || null,
    sku: row.sku || '',
    stock: Number(row.stock || 0),
    availability: (row.availability || 'auto') as Availability,
    visible: row.visible !== false,
    prices: prices,
    imageRef: row.image_path || null,
    imageUrl: row.image_url || null,
    isDemo: row.is_demo === true,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function toSale(row: AnyObject): Sale {
  const items: SaleItem[] = [];
  if (Array.isArray(row.sale_items)) {
    for (const item of row.sale_items) {
      items.push({
        productId: item.product_id || null,
        productName: item.product_name || '',
        quantity: Number(item.quantity),
        priceLabel: item.price_label || '',
        lineTotal: Number(item.line_total),
      });
    }
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status === 'anulada' ? 'anulada' : 'activa',
    cancelledAt: row.cancelled_at || null,
    total: Number(row.total),
    items: items,
  };
}

export function createSupabaseStore(): DataStore {
  let session: Session | null = readSession();

  async function getAccessToken(): Promise<string | null> {
    if (!session) {
      return null;
    }
    // Renovar la sesión un minuto antes de que venza.
    if (Date.now() > session.expiresAt - 60000) {
      const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      if (!response.ok) {
        session = null;
        writeSession(null);
        return null;
      }
      session = sessionFromResponse(await response.json());
      writeSession(session);
    }
    return session.accessToken;
  }

  async function headers(needsAdmin: boolean): Promise<Record<string, string>> {
    const token = await getAccessToken();
    if (needsAdmin && !token) {
      throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
    }
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + (token || SUPABASE_ANON_KEY),
      'Content-Type': 'application/json',
    };
  }

  async function rest(
    path: string,
    options: { method?: string; body?: unknown; admin?: boolean; returnRows?: boolean },
  ): Promise<any> {
    const requestHeaders = await headers(options.admin === true);
    if (options.returnRows === true) {
      requestHeaders.Prefer = 'return=representation';
    }
    const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method: options.method || 'GET',
      headers: requestHeaders,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    const text = await response.text();
    if (text === '') {
      return null;
    }
    return JSON.parse(text);
  }

  function rpc(name: string, body: AnyObject): Promise<any> {
    return rest('rpc/' + name, { method: 'POST', body: body, admin: true });
  }

  const store: DataStore = {
    mode: 'supabase',

    async loadCatalog() {
      const results = await Promise.all([
        rest('products?select=*,product_prices(*)&order=created_at.asc', {}),
        rest('categories?select=*&order=position.asc', {}),
        rest('app_settings?select=*&id=eq.1', {}),
      ]);

      const products: Product[] = [];
      for (const row of results[0]) {
        products.push(toProduct(row));
      }

      const categories: Category[] = [];
      for (const row of results[1]) {
        categories.push({ id: row.id, name: row.name, position: Number(row.position || 0) });
      }

      let settings: Settings = { ...DEFAULT_SETTINGS };
      if (results[2].length > 0) {
        const row = results[2][0];
        settings = {
          whatsappNumber: row.whatsapp_number || DEFAULT_SETTINGS.whatsappNumber,
          tagline: row.tagline || DEFAULT_SETTINGS.tagline,
          lowStockThreshold: Number(row.low_stock_threshold ?? DEFAULT_SETTINGS.lowStockThreshold),
          legalNotice: row.legal_notice || DEFAULT_SETTINGS.legalNotice,
        };
      }

      return { products: products, categories: categories, settings: settings };
    },

    async getAdminAccess() {
      const token = await getAccessToken();
      if (token) {
        return 'allowed';
      }
      return 'login';
    },

    async login(email: string, password: string) {
      const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      session = sessionFromResponse(await response.json());
      writeSession(session);
    },

    async logout() {
      const token = session ? session.accessToken : null;
      session = null;
      writeSession(null);
      if (token) {
        try {
          await fetch(SUPABASE_URL + '/auth/v1/logout', {
            method: 'POST',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
          });
        } catch (error) {
          // La sesión ya se borró en este dispositivo.
        }
      }
    },

    async saveProduct(input: ProductInput) {
      const productId = await rpc('save_product', {
        p_product: {
          id: input.id || '',
          name: input.name,
          description: input.description,
          category_id: input.categoryId || '',
          sku: input.sku,
          stock: input.stock,
          availability: input.availability,
          visible: input.visible,
          image_path: input.imageRef || '',
          image_url: input.imageUrl || '',
        },
        p_prices: input.prices.map(function (price) {
          return { quantity: price.quantity, price: price.price };
        }),
      });
      return String(productId);
    },

    async deleteProduct(product: Product) {
      await rest('products?id=eq.' + encodeURIComponent(product.id), { method: 'DELETE', admin: true });
      if (product.imageRef) {
        await store.deleteImage(product.imageRef);
      }
    },

    async uploadImage(image: Blob) {
      const optimized = await optimizeImage(image, 1200, 0.82);
      const extension = optimized.type === 'image/webp' ? 'webp' : 'jpg';
      const path = 'products/' + Date.now() + '-' + newId() + '.' + extension;
      const requestHeaders = await headers(true);
      const response = await fetch(SUPABASE_URL + '/storage/v1/object/' + SUPABASE_BUCKET + '/' + path, {
        method: 'POST',
        headers: {
          apikey: requestHeaders.apikey,
          Authorization: requestHeaders.Authorization,
          'Content-Type': optimized.type,
          'cache-control': '31536000',
        },
        body: optimized,
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      return {
        ref: path,
        url: SUPABASE_URL + '/storage/v1/object/public/' + SUPABASE_BUCKET + '/' + path,
      };
    },

    async deleteImage(ref: string) {
      try {
        const requestHeaders = await headers(true);
        await fetch(SUPABASE_URL + '/storage/v1/object/' + SUPABASE_BUCKET, {
          method: 'DELETE',
          headers: requestHeaders,
          body: JSON.stringify({ prefixes: [ref] }),
        });
      } catch (error) {
        // Si la foto ya no existe no pasa nada.
      }
    },

    async saveCategory(name: string, id: string | null) {
      if (id !== null) {
        await rest('categories?id=eq.' + encodeURIComponent(id), {
          method: 'PATCH',
          body: { name: name },
          admin: true,
        });
        return id;
      }
      const existing = await rest('categories?select=id', { admin: true });
      const rows = await rest('categories?select=id', {
        method: 'POST',
        body: { name: name, position: existing.length + 1 },
        admin: true,
        returnRows: true,
      });
      return rows && rows.length > 0 ? rows[0].id : '';
    },

    async deleteCategory(id: string) {
      await rest('categories?id=eq.' + encodeURIComponent(id), { method: 'DELETE', admin: true });
    },

    async saveSettings(settings: Settings) {
      await rest('app_settings?id=eq.1', {
        method: 'PATCH',
        body: {
          whatsapp_number: settings.whatsappNumber,
          tagline: settings.tagline,
          low_stock_threshold: settings.lowStockThreshold,
          legal_notice: settings.legalNotice,
        },
        admin: true,
      });
    },

    async setStock(productId: string, newStock: number) {
      await rpc('set_stock', { p_product_id: productId, p_new_stock: newStock });
    },

    async registerSale(input: NewSaleInput) {
      const newStock = await rpc('register_sale', {
        p_product_id: input.productId,
        p_quantity: input.quantity,
        p_price_label: input.priceLabel,
        p_total: input.total,
      });
      return Number(newStock);
    },

    async cancelSale(saleId: string) {
      await rpc('cancel_sale', { p_sale_id: saleId });
    },

    async loadSales() {
      const rows = await rest('sales?select=*,sale_items(*)&order=created_at.desc&limit=300', { admin: true });
      const sales: Sale[] = [];
      for (const row of rows) {
        sales.push(toSale(row));
      }
      return sales;
    },

    async resetDemo() {
      throw new Error('Esta opción solo existe en el modo local.');
    },
  };

  return store;
}
