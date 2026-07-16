import { SalesLeadDetailWorkspace } from '@/components/sales/SalesLeadDetailWorkspace'

type PageProps = {
  params: Promise<{ leadId: string }>
}

export default async function Page({ params }: PageProps) {
  const { leadId } = await params
  return <SalesLeadDetailWorkspace leadId={leadId} />
}
