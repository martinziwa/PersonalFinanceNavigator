import { createContext, useContext, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStorageMode } from '@/hooks/useStorageMode';
import { useAuth } from '@/hooks/useAuth';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { queryClient } from '@/lib/queryClient';
import { localQueryClient } from '@/lib/localQueryClient';

interface StorageContextType {
  isLocalMode: boolean;
  isDatabaseMode: boolean;
  toggleMode: () => void;
  setStorageMode: (mode: 'database' | 'local') => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export function useStorageContext() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorageContext must be used within StorageProvider');
  }
  return context;
}

interface StorageProviderProps {
  children: ReactNode;
}

export function StorageProvider({ children }: StorageProviderProps) {
  const { mode, isLocalMode, isDatabaseMode, toggleMode, setStorageMode } = useStorageMode();
  
  const contextValue = {
    isLocalMode,
    isDatabaseMode,
    toggleMode,
    setStorageMode,
  };

  return (
    <StorageContext.Provider value={contextValue}>
      <QueryClientProvider client={isLocalMode ? localQueryClient : queryClient}>
        {children}
      </QueryClientProvider>
    </StorageContext.Provider>
  );
}

// Combined auth hook that works with both storage modes
export function useCombinedAuth() {
  const { isLocalMode } = useStorageContext();
  const databaseAuth = useAuth();
  const localAuth = useLocalAuth();
  
  return isLocalMode ? localAuth : databaseAuth;
}