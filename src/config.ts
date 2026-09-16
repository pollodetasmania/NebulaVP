import type { Settings } from './types';

// Configuración general.
// Los valores VITE_* se escriben en el archivo .env (o en Vercel/Netlify).
// Si no hay datos de Supabase, la app funciona en modo demostración.

const env: Record<string, string | undefined> = (import.meta as any).env || {};

export const SUPABASE_URL = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY || '').trim();
export const SUPABASE_BUCKET = 'product-images';

// Número de WhatsApp inicial (WHATSAPP_NUMBER). Después se cambia desde Configuración.
// Déjalo vacío si todavía no lo tienes. Solo dígitos, sin espacios ni signo +.
export const WHATSAPP_NUMBER = (env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');

export const DEFAULT_SETTINGS: Settings = {
  whatsappNumber: WHATSAPP_NUMBER,
  tagline: 'Explore the nebula',
  lowStockThreshold: 5,
  legalNotice:
    'Venta exclusiva para mayores de 18 años. Los productos con nicotina son adictivos y afectan la salud.',
};

// Cuánto tiempo se recuerda la confirmación de edad en el mismo navegador.
export const AGE_CONFIRMATION_HOURS = 12;
