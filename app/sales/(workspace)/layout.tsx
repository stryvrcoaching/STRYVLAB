import { redirect } from 'next/navigation'
import { SalesShell } from '@/components/sales/SalesShell'
import { getSalesAccessForCurrentUser } from '@/lib/sales/access'
import SalesServiceWorkerRegistrar from '@/components/sales/SalesServiceWorkerRegistrar'
import SalesPwaPrompt from '@/components/sales/SalesPwaPrompt'

export const dynamic = 'force-dynamic'

export default async function SalesWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const access = await getSalesAccessForCurrentUser()

  if (!access.user) redirect('/sales/login')
  if (!access.partner || access.partner.status !== 'active') redirect('/sales/login?access=denied')

  return (
    <>
      <SalesServiceWorkerRegistrar />
      <SalesPwaPrompt />
      <SalesShell partnerName={access.partner.full_name}>{children}</SalesShell>
    </>
  )
}
