import { useState, useEffect } from 'react';

type StorageMode = 'database' | 'local';

export function useStorageMode() {
  const [mode, setMode] = useState<StorageMode>('local'); // Default to local storage

  useEffect(() => {
    const savedMode = localStorage.getItem('finance_app_storage_mode') as StorageMode;
    if (savedMode && (savedMode === 'database' || savedMode === 'local')) {
      setMode(savedMode);
    }
  }, []);

  const toggleMode = () => {
    const newMode: StorageMode = mode === 'database' ? 'local' : 'database';
    setMode(newMode);
    localStorage.setItem('finance_app_storage_mode', newMode);
  };

  const setStorageMode = (newMode: StorageMode) => {
    setMode(newMode);
    localStorage.setItem('finance_app_storage_mode', newMode);
  };

  return {
    mode,
    isLocalMode: mode === 'local',
    isDatabaseMode: mode === 'database',
    toggleMode,
    setStorageMode,
  };
}