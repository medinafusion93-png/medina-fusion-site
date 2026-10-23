import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = !!url && !!key;
export const supabase = createClient(url || 'http://localhost', key || 'non-configure');

/** Appelle une Edge Function avec la session de l'utilisateur ; renvoie un message d'erreur lisible */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { msg = ((await ctx.json()) as { error?: string }).error ?? msg; } catch { /* corps non JSON */ }
    }
    throw new Error(msg);
  }
  return data as T;
}

/** Lève une erreur lisible si une requête Supabase a échoué */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
