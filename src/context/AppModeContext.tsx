import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {MMKV} from 'react-native-mmkv';

// Define the shape of our context data
interface AppModeContextType {
  appMode: 'video' | 'music';
  setAppMode: (mode: 'video' | 'music') => void;
}

// Create the context with a default value
const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

// Initialize the storage
const storage = new MMKV();

// Create the provider component
export const AppModeProvider = ({children}: {children: ReactNode}) => {
  const [appMode, setAppMode] = useState<'video' | 'music'>('video');

  // Load the app mode from storage on initial render
  useEffect(() => {
    const savedMode = storage.getString('appMode') as
      | 'video'
      | 'music'
      | undefined;
    if (savedMode) {
      setAppMode(savedMode);
    }
  }, []);

  // Wrap the setter to also update storage
  const setAppModeWithStorage = (newMode: 'video' | 'music') => {
    setAppMode(newMode);
    storage.set('appMode', newMode);
  };

  const value = {appMode, setAppMode: setAppModeWithStorage};

  return (
    <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
  );
};

// Create a custom hook to use the context easily
export const useAppMode = () => {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
};
