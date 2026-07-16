'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createDashboardServiceClient } from '@/lib/dashboard/service'
import {
  getIpFromHeaders,
  getUserAgentFromHeaders,
  maybeSendSecurityEventAlert,
  recordSecurityEvent,
  upsertSecurityIncident,
} from '@/lib/security/security-events'

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
  const securityDb = createDashboardServiceClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const ipAddress = getIpFromHeaders()
  const userAgent = getUserAgentFromHeaders()

  if (!email || !password) return { error: 'Email et mot de passe requis.' }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    await recordSecurityEvent({
      db: securityDb,
      eventType: 'auth_login_failed_client',
      severity: 'high',
      actorType: 'anonymous',
      actorEmail: email.toLowerCase(),
      ipAddress,
      userAgent,
      requestPath: '/client/login',
      requestMethod: 'POST',
      resourceType: 'auth',
      resourceId: 'client_login',
      outcome: 'failure',
      reason: error.message,
      meta: { surface: 'client_login' },
    })

    await upsertSecurityIncident({
      db: securityDb,
      source: 'auth',
      severity: 'high',
      title: 'Échec de connexion client',
      description: error.message,
      dedupeKey: `client_login_failed:${ipAddress ?? 'unknown'}:${email.toLowerCase()}`,
      actorEmail: email.toLowerCase(),
      ipAddress,
      route: '/client/login',
      meta: { surface: 'client_login' },
    })

    await maybeSendSecurityEventAlert({
      db: securityDb,
      eventType: 'auth_login_failed_client',
      severity: 'high',
      actorEmail: email.toLowerCase(),
      ipAddress,
      requestPath: '/client/login',
      requestMethod: 'POST',
      reason: error.message,
      meta: { surface: 'client_login' },
    })

    return { error: translateError(error.message) }
  }

  await recordSecurityEvent({
    db: securityDb,
    eventType: 'auth_login_success_client',
    severity: 'medium',
    actorType: 'client',
    actorUserId: data.user?.id ?? null,
    actorEmail: data.user?.email ?? email.toLowerCase(),
    ipAddress,
    userAgent,
    requestPath: '/client/login',
    requestMethod: 'POST',
    resourceType: 'auth',
    resourceId: 'client_login',
    outcome: 'success',
    meta: { surface: 'client_login' },
  })

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
  const securityDb = createDashboardServiceClient()
  const ipAddress = getIpFromHeaders()
  const userAgent = getUserAgentFromHeaders()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: translateError(error.message) }

  await recordSecurityEvent({
    db: securityDb,
    eventType: 'auth_login_success_demo',
    severity: 'medium',
    actorType: 'client',
    actorUserId: data.user?.id ?? null,
    actorEmail: data.user?.email ?? email,
    ipAddress,
    userAgent,
    requestPath: '/client/login',
    requestMethod: 'POST',
    resourceType: 'auth',
    resourceId: 'client_demo_login',
    outcome: 'success',
    meta: { surface: 'client_demo_login' },
  })

  revalidatePath('/', 'layout')
  return { success: true }
}
