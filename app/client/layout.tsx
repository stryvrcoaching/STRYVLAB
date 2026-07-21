import type { Metadata, Viewport } from 'next'
import ConditionalClientShell from '@/components/client/ConditionalClientShell'
import ClientRouteMemory from '@/components/client/ClientRouteMemory'
import ServiceWorkerRegistrar from '@/components/client/ServiceWorkerRegistrar'
import DeferredClientRuntime from '@/components/client/DeferredClientRuntime'
import NativeStatusBar from '@/components/client/NativeStatusBar'
import { ClientI18nProvider } from '@/components/client/ClientI18nProvider'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'STRYVR',
    // startupImage omitted — proper splash screen assets not yet generated
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Prevent iOS auto-zoom on input focus in PWA context
  // Keep fixed bottom chrome at layout bottom when the soft keyboard opens
  // (instead of lifting the dock with the visual viewport).
  interactiveWidget: 'overlays-content',
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// NOTE: Auth protection for client routes is handled entirely by the middleware
// (utils/supabase/middleware.ts → isClientProtected check).
//
// Do NOT add an auth redirect here. This layout applies to ALL routes under
// /client/, including /client/login and /client/set-password. Adding a
// redirect would cause an infinite redirect loop for unauthenticated users
// trying to access those pages.
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  let initialLang: ClientLang = 'fr'
  let clientId: string | null = null

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const db = service()
      const client = await resolveClientFromUser(user.id, user.email, db, 'id')
      if (client?.id) {
        clientId = client.id
        initialLang = await resolveClientLanguage(db, client.id)
      }
    }
  } catch {
    // Non-blocking — fallback to the default provider language.
  }

  return (
    <ClientI18nProvider initialLang={initialLang}>
      <div
        data-client-app
        className="min-h-dvh bg-[var(--client-page-bg,#0a0a0a)] font-barlow isolate"
      >
        <ClientRouteMemory />
        <ServiceWorkerRegistrar />
        <DeferredClientRuntime clientId={clientId} />
        <NativeStatusBar />
        <ConditionalClientShell>{children}</ConditionalClientShell>
      </div>
    </ClientI18nProvider>
  )
}
