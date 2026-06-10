// app/coach/clients/[clientId]/page.tsx
import { redirect } from "next/navigation";

export default function ClientPage({
  params,
}: {
  params: { clientId: string };
}) {
  redirect(`/coach/clients/${params.clientId}/profil`);
}
