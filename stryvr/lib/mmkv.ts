import { MMKV } from 'react-native-mmkv';

// Local storage instance
export const storage = new MMKV();

// Helper functions
export const setItem = (key: string, value: string) => {
  storage.set(key, value);
};

export const getItem = (key: string): string | undefined => {
  return storage.getString(key);
};

export const removeItem = (key: string) => {
  storage.delete(key);
};

export const clearAll = () => {
  storage.clearAll();
};

// Typed helpers for common data
export const setUserPreferences = (preferences: Record<string, any>) => {
  setItem('userPreferences', JSON.stringify(preferences));
};

export const getUserPreferences = (): Record<string, any> | null => {
  const data = getItem('userPreferences');
  return data ? JSON.parse(data) : null;
};