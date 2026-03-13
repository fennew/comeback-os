"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface ClientData {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string | null;
  status: string;
}

interface ClientContextValue {
  activeClientId: string | null;
  activeClient: ClientData | null;
  clients: ClientData[];
  setActiveClientId: (id: string | null) => void;
  refreshClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextValue>({
  activeClientId: null,
  activeClient: null,
  clients: [],
  setActiveClientId: () => {},
  refreshClients: async () => {},
});

export function useClientContext() {
  return useContext(ClientContext);
}

export function ClientContextProvider({ children }: { children: React.ReactNode }) {
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);

  // Load active client from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("comeback-os-active-client");
    if (stored) {
      setActiveClientIdState(stored);
    }
  }, []);

  // Persist active client to localStorage
  function setActiveClientId(id: string | null) {
    setActiveClientIdState(id);
    if (id) {
      localStorage.setItem("comeback-os-active-client", id);
    } else {
      localStorage.removeItem("comeback-os-active-client");
    }
  }

  const refreshClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch {
      // Silently fail - clients list will be empty
    }
  }, []);

  // Fetch clients on mount
  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return (
    <ClientContext.Provider
      value={{
        activeClientId,
        activeClient,
        clients,
        setActiveClientId,
        refreshClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}
