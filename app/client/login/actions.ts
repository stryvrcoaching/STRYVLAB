'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed')) return 'Votre email n\'a pas encore été confirmé.'
  return 'Une erreur est survenue. Veuillez réessayer.'
}

function isDemoLoginEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.CLIENT_DEMO_ENABLED === 'true'
}

export async function clientLogin(formData: FormData) {
  const supabase = createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email et mot de passe requis.' }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateError(error.message) }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function clientDemoLogin() {
  if (!isDemoLoginEnabled()) {
    return { error: 'Accès démo indisponible.' }
  }

  const email = process.env.CLIENT_DEMO_EMAIL?.trim()
  const password = process.env.CLIENT_DEMO_PASSWORD?.trim()
  if (!email || !password) {
    return { error: 'Configuration du compte démo incomplète.' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateError(error.message) }

  revalidatePath('/', 'layout')
  return { success: true }
}
