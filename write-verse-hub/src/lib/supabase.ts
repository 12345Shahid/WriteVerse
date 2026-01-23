import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Handle auth errors globally - clear invalid sessions
export async function handleAuthError(error: any): Promise<void> {
  if (!supabase) return;
  
  const errorMessage = error?.message || String(error);
  const isAuthError = 
    errorMessage.includes('Refresh Token') ||
    errorMessage.includes('Invalid token') ||
    errorMessage.includes('JWT') ||
    errorMessage.includes('session') ||
    error?.status === 401;
  
  if (isAuthError) {
    console.warn('[Supabase] Auth error detected, signing out:', errorMessage);
    try {
      await supabase.auth.signOut();
      // Clear local storage
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('writerai_active_team');
      }
      // Redirect to auth page
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    } catch (e) {
      console.error('[Supabase] Sign out failed', e);
    }
  }
}

export async function getUserId(): Promise<string | null> {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      await handleAuthError(error);
      return null;
    }
    return data.user?.id ?? null;
  } catch (e: any) {
    console.error('[Supabase] getUserId failed', e);
    await handleAuthError(e);
    return null;
  }
}

// Initialize auth state listener
if (supabase && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event: string, session: any) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('[Supabase] Token refreshed');
    } else if (event === 'SIGNED_OUT') {
      console.log('[Supabase] User signed out');
      window.localStorage.removeItem('writerai_active_team');
    }
  });
}
