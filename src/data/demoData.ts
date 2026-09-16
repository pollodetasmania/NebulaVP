import type { Category, Product } from '../types';

// =====================================================================
// PRODUCTOS DE DEMOSTRACIÓN
// Son FICTICIOS. Solo sirven para ver cómo funciona la aplicación.
// No tienen fotos: las fotos reales se suben desde el panel /admin.
// Se pueden eliminar desde Administración > Productos.
// =====================================================================

export const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-vaporizadores', name: 'Vaporizadores', position: 1 },
  { id: 'cat-accesorios', name: 'Accesorios', position: 2 },
  { id: 'cat-otros', name: 'Otros', position: 3 },
];

interface DemoProductData {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  sku: string;
  stock: number;
  prices: number[][]; // [cantidad, precio]
}

const DEMO_PRODUCT_DATA: DemoProductData[] = [
  {
    id: 'demo-nebula-x',
    name: 'Nebula X',
    description: 'Producto de demostración. Reemplaza este texto con la descripción real del producto.',
    categoryId: 'cat-vaporizadores',
    sku: 'DEMO-X',
    stock: 12,
    prices: [
      [1, 35000],
      [2, 65000],
      [3, 90000],
    ],
  },
  {
    id: 'demo-nebula-pro',
    name: 'Nebula Pro',
    description: 'Producto de demostración con poco stock, para ver cómo se muestra ese estado.',
    categoryId: 'cat-vaporizadores',
    sku: 'DEMO-PRO',
    stock: 4,
    prices: [
      [1, 45000],
      [2, 85000],
    ],
  },
  {
    id: 'demo-nebula-air',
    name: 'Nebula Air',
    description: 'Producto de demostración. Edita el nombre, la foto y los precios desde el panel.',
    categoryId: 'cat-vaporizadores',
    sku: 'DEMO-AIR',
    stock: 20,
    prices: [
      [1, 30000],
      [2, 55000],
      [3, 78000],
    ],
  },
  {
    id: 'demo-nebula-max',
    name: 'Nebula Max',
    description: 'Producto de demostración agotado. No se puede vender hasta que se agregue stock.',
    categoryId: 'cat-vaporizadores',
    sku: 'DEMO-MAX',
    stock: 0,
    prices: [[1, 60000]],
  },
  {
    id: 'demo-cable-usb-c',
    name: 'Cable USB-C Nebula',
    description: 'Accesorio de demostración.',
    categoryId: 'cat-accesorios',
    sku: 'DEMO-USB',
    stock: 15,
    prices: [
      [1, 15000],
      [2, 26000],
    ],
  },
];

export function makeDemoProducts(): Product[] {
  const now = new Date().toISOString();
  const products: Product[] = [];

  for (const data of DEMO_PRODUCT_DATA) {
    const prices = [];
    for (let index = 0; index < data.prices.length; index++) {
      prices.push({
        id: data.id + '-precio-' + (index + 1),
        quantity: data.prices[index][0],
        price: data.prices[index][1],
      });
    }

    products.push({
      id: data.id,
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      sku: data.sku,
      stock: data.stock,
      availability: 'auto',
      visible: true,
      prices: prices,
      imageRef: null,
      imageUrl: null,
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return products;
}
