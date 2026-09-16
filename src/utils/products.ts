import type { PriceOption, Product, StockStatus } from '../types';
import { unitsLabel } from './format';

export const STATUS_LABEL: Record<StockStatus, string> = {
  disponible: 'Disponible',
  poco_stock: 'Poco stock',
  agotado: 'Agotado',
};

export function getStatus(product: Product, lowStockThreshold: number): StockStatus {
  if (product.availability !== 'auto') {
    return product.availability;
  }
  if (product.stock <= 0) {
    return 'agotado';
  }
  if (product.stock <= lowStockThreshold) {
    return 'poco_stock';
  }
  return 'disponible';
}

export function sortPrices(prices: PriceOption[]): PriceOption[] {
  const copy = prices.slice();
  copy.sort(function (a, b) {
    return a.quantity - b.quantity;
  });
  return copy;
}

export function lowestQuantityPrice(product: Product): PriceOption | null {
  const sorted = sortPrices(product.prices);
  if (sorted.length === 0) {
    return null;
  }
  return sorted[0];
}

export function priceLabel(option: PriceOption): string {
  return unitsLabel(option.quantity);
}

// Si la cantidad coincide con la opción, se usa su precio exacto.
// Si no coincide, se usa el precio por unidad de esa opción.
export function suggestedTotal(option: PriceOption, quantity: number): number {
  if (option.quantity === quantity) {
    return option.price;
  }
  const unitPrice = option.price / option.quantity;
  return Math.round(unitPrice * quantity);
}

export function sortProductsForDisplay(products: Product[], lowStockThreshold: number): Product[] {
  const copy = products.slice();
  copy.sort(function (a, b) {
    const aSoldOut = getStatus(a, lowStockThreshold) === 'agotado' ? 1 : 0;
    const bSoldOut = getStatus(b, lowStockThreshold) === 'agotado' ? 1 : 0;
    if (aSoldOut !== bSoldOut) {
      return aSoldOut - bSoldOut;
    }
    return a.name.localeCompare(b.name, 'es');
  });
  return copy;
}

export function whatsappLink(phone: string, message: string): string {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}
