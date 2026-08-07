import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  collapseSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = 'digita.sidebar.collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );

  const persist = useCallback((next: boolean) => {
    setIsCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const value = useMemo(
    () => ({
      isCollapsed,
      toggleSidebar: () => persist(!isCollapsed),
      collapseSidebar: () => persist(true),
    }),
    [isCollapsed, persist],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used inside a SidebarProvider');
  return ctx;
}
