// Tipos de datos que usa toda la aplicación.

// "auto" = el estado se calcula solo según el stock.
export type Availability = 'auto' | 'disponible' | 'poco_stock' | 'agotado';

export type StockStatus = 'disponible' | 'poco_stock' | 'agotado';

export interface PriceOption {
  id: string;
  quantity: number; // cantidad de unidades (1, 2, 3...)
  price: number; // precio total para esa cantidad, en pesos
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  sku: string;
  stock: number;
  availability: Availability;
  visible: boolean; // si es false no aparece en el catálogo público
  prices: PriceOption[];
  imageRef: string | null; // referencia interna de la foto (para borrarla)
  imageUrl: string | null; // dirección para mostrar la foto
  isDemo: boolean; // true = producto de demostración
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  id: string | null; // null = producto nuevo
  name: string;
  description: string;
  categoryId: string | null;
  sku: string;
  stock: number;
  availability: Availability;
  visible: boolean;
  prices: PriceOption[];
  imageRef: string | null;
  imageUrl: string | null;
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

export interface Settings {
  whatsappNumber: string; // solo dígitos, con indicativo del país
  tagline: string;
  lowStockThreshold: number;
  legalNotice: string;
}

export interface SaleItem {
  productId: string | null;
  productName: string;
  quantity: number;
  priceLabel: string;
  lineTotal: number;
}

export interface Sale {
  id: string;
  createdAt: string;
  status: 'activa' | 'anulada';
  cancelledAt: string | null;
  total: number;
  items: SaleItem[];
}

export interface InventoryMovement {
  id: string;
  productId: string;
  change: number; // negativo = salen unidades, positivo = entran
  reason: 'inicial' | 'ajuste' | 'venta' | 'anulacion';
  saleId: string | null;
  createdAt: string;
}

export interface CatalogData {
  products: Product[];
  categories: Category[];
  settings: Settings;
}

export interface NewSaleInput {
  productId: string;
  quantity: number;
  priceLabel: string;
  total: number;
}

export interface UploadedImage {
  ref: string;
  url: string;
}

export type DataMode = 'local' | 'claude' | 'supabase';

export type AdminAccess = 'allowed' | 'login' | 'denied';

// Todas las formas de guardar datos (local, Claude, Supabase) cumplen esta lista.
export interface DataStore {
  mode: DataMode;
  loadCatalog(): Promise<CatalogData>;
  getAdminAccess(): Promise<AdminAccess>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  saveProduct(input: ProductInput): Promise<string>;
  deleteProduct(product: Product): Promise<void>;
  uploadImage(image: Blob): Promise<UploadedImage>;
  deleteImage(ref: string): Promise<void>;
  saveCategory(name: string, id: string | null): Promise<string>;
  deleteCategory(id: string): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  setStock(productId: string, newStock: number): Promise<void>;
  registerSale(input: NewSaleInput): Promise<number>; // devuelve el stock nuevo
  cancelSale(saleId: string): Promise<void>;
  loadSales(): Promise<Sale[]>;
  resetDemo(): Promise<void>;
}
