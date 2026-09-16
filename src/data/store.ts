import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import type { DataStore } from '../types';
import { createClaudeStore } from './claudeStore';
import { createLocalStore } from './localStore';
import { createSupabaseStore } from './supabaseStore';

// Elige dónde se guardan los datos:
// 1. Si hay datos de Supabase en .env  -> Supabase (sitio publicado).
// 2. Si la app está publicada en Claude -> base de datos del Artifact.
// 3. En cualquier otro caso              -> modo local de demostración.

export async function createStore(): Promise<DataStore> {
  if (SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '') {
    return createSupabaseStore();
  }

  const runtime = (window as any).claude;
  if (runtime && typeof runtime.use === 'function') {
    const claudeStore = await createClaudeStore(runtime);
    if (claudeStore) {
      return claudeStore;
    }
    throw new Error('Abre esta app desde tu enlace de Claude para ver el catálogo.');
  }

  return createLocalStore();
}
