"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type DockContextType = {
  activeClientId: string | null;
  openClient: (client: { id: string; firstName: string; lastName: string }) => void;
  setActiveClient: (clientId: string) => void;
};

const DockContext = createContext<DockContextType>({
  activeClientId: null,
  openClient: () => {},
  setActiveClient: () => {},
});

export function DockProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  const openClient = useCallback((client: { id: string; firstName: string; lastName: string }) => {
    setActiveClientId(client.id);
  }, []);

  const setActiveClient = useCallback((clientId: string) => {
    setActiveClientId(clientId);
  }, []);

  return (
    <DockContext.Provider value={{ activeClientId, openClient, setActiveClient }}>
      {children}
    </DockContext.Provider>
  );
}

export function useDock() {
  return useContext(DockContext);
}
