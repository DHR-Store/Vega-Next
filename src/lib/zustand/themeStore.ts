import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

// Initialize MMKV storage specifically for the theme store
const themeMMKVStorage = new MMKV({
  id: 'theme-storage', // Unique ID for this store's storage
});

// Create a custom storage adapter for Zustand using the MMKV instance
const zustandThemeStorage = {
  setItem: (name: string, value: string) => {
    return themeMMKVStorage.set(name, value);
  },
  getItem: (name: string) => {
    const value = themeMMKVStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return themeMMKVStorage.delete(name);
  },
};

// Define the state and actions for the theme store
interface ThemeState {
  primary: string;
  isCustom: boolean;
  setPrimary: (color: string) => void;
  setCustom: (isCustom: boolean) => void;
}

// Create the Zustand store with persistence
const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initial state
      primary: '#FF6347', // Default primary color
      isCustom: false,    // Default to not a custom theme

      // Actions/setter functions
      setPrimary: (color: string) => set({primary: color}),
      setCustom: (isCustom: boolean) => set({isCustom: isCustom}),
    }),
    {
      name: 'theme-storage', // Unique name for the persisted state
      storage: createJSONStorage(() => zustandThemeStorage), // Use the custom storage adapter
    },
  ),
);

export default useThemeStore;
