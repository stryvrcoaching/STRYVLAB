"use client";

import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import CheckinHub from "@/components/clients/CheckinHub";

export default function CheckinsPage() {
  const { clientId } = useClient();
  useClientTopBar("Check-ins");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">
        <CheckinHub clientId={clientId} />
      </div>
    </main>
  );
}
