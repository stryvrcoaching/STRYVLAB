"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";

export type ClientData = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  goal?: string;
  notes?: string;
  status?: string;
  transformation_phase?: string | null;
  training_goal?: string | null;
  fitness_level?: string | null;
  sport_practice?: string | null;
  weekly_frequency?: number | null;
  equipment_category?: string | null;
  profile_photo_url?: string | null;
  created_at: string;
};

type ClientContextType = {
  client: ClientData;
  clientId: string;
  refetch: () => Promise<void>;
};

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({
  children,
  client,
  clientId,
  refetch,
}: {
  children: ReactNode;
  client: ClientData;
  clientId: string;
  refetch: () => Promise<void>;
}) {
  const value = useMemo(
    () => ({ client, clientId, refetch }),
    [client, clientId, refetch]
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be called within ClientProvider");
  return ctx;
}
