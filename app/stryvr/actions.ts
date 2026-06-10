// app/stryvr/actions.ts
'use server';

import { createClient } from '@/utils/supabase/server';

export type WaitlistResult =
  | { success: true; alreadyExists: false }
  | { success: true; alreadyExists: true }
  | { success: false; error: string };

export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  const firstName = (formData.get('first_name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';

  if (!firstName || firstName.length < 2) {
    return { success: false, error: 'Prénom requis (min. 2 caractères).' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Adresse email invalide.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('beta_waitlist')
    .insert({ first_name: firstName, email, source: 'stryvr-landing' });

  if (error) {
    // Unique constraint violation → déjà inscrit
    if (error.code === '23505') {
      return { success: true, alreadyExists: true };
    }
    console.error('[joinWaitlist] Supabase error:', error);
    return { success: false, error: 'Erreur lors de l\'inscription. Réessaie.' };
  }

  return { success: true, alreadyExists: false };
}

export async function getBetaCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('beta_waitlist')
    .select('*', { count: 'exact', head: true });
  const raw = count ?? 0;
  return Math.floor(raw / 10) * 10;
}
