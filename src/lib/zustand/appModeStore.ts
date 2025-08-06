import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv'; // Import MMKV directly

// Initialize MMKV storage specifically for app mode
const appModeMMKVStorage = new MMKV({
  id: 'app-mode-storage', // Unique ID for this store's storage
});

// Create a custom storage for Zustand using the MMKV instance
const zustandStorage = {
  setItem: (name: string, value: string) => {
    return appModeMMKVStorage.set(name, value);
  },
  getItem: (name: string) => {
    const value = appModeMMKVStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return appModeMMKVStorage.delete(name);
  },
};

type AppMode = 'video' | 'music';

interface AppModeState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const useAppModeStore = create<AppModeState>()(
  persist(
    set => ({
      appMode: 'video', // Default app mode is 'video'
      setAppMode: (mode: AppMode) => set({appMode: mode}),
    }),
    {
      name: 'app-mode-storage', // unique name for the persisted state
      storage: createJSONStorage(() => zustandStorage), // Use the custom zustandStorage adapter
    },
  ),
);

export default useAppModeStore;

