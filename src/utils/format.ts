// Funciones pequeñas para mostrar números, fechas y crear identificadores.

export function formatMoney(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  const digits = Math.abs(rounded).toString();
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (rounded < 0) {
    return '-$' + withDots;
  }
  return '$' + withDots;
}

export function unitsLabel(quantity: number): string {
  if (quantity === 1) {
    return '1 unidad';
  }
  return quantity + ' unidades';
}

export function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

function twoDigits(value: number): string {
  if (value < 10) {
    return '0' + value;
  }
  return String(value);
}

export function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return twoDigits(date.getHours()) + ':' + twoDigits(date.getMinutes());
}

// Día en hora local, con formato AAAA-MM-DD.
export function dayKey(date: Date): string {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

export function monthKey(date: Date): string {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1);
}

export function dayTitle(key: string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (key === dayKey(today)) {
    return 'Hoy';
  }
  if (key === dayKey(yesterday)) {
    return 'Ayer';
  }

  const parts = key.split('-');
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const text = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function newId(): string {
  const cryptoObject = (globalThis as any).crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Ocurrió un error inesperado.';
}
