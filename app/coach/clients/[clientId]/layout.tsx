"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientProvider, type ClientData } from "@/lib/client-context";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchClient = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Client introuvable" : "Erreur serveur");
        return;
      }
      const data = await res.json();
      if (data.client) {
        setClient(data.client);
      } else {
        setError("Client introuvable");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  if (loading) {
    return (
      <div className="px-6 pb-24 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 space-y-3">
              <Skeleton className="h-2.5 w-14 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
              <div className="pt-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="px-6 pt-10 text-center">
        <p className="text-[14px] text-white/50">{error || "Client introuvable"}</p>
        <button
          onClick={() => router.push("/coach/clients")}
          className="mt-4 text-[12px] text-[#1f8a65] hover:text-[#1f8a65]/70 transition-colors"
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <ClientProvider client={client} clientId={clientId} refetch={fetchClient}>
      {children}
    </ClientProvider>
  );
}
