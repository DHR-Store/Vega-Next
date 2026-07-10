import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CfStoreState {
  isSolving: boolean;
  targetUrl: string;
  savedUserAgent: string | null;
  resolvePromise: ((data: { userAgent: string }) => void) | null;
  rejectPromise: ((error: Error) => void) | null;
  triggerCfSolver: (url: string) => Promise<{ userAgent: string }>;
  completeSolver: (userAgent: string) => void;
  cancelSolver: () => void;
}

export const useCfStore = create<CfStoreState>()(
  persist(
    (set, get) => ({
      isSolving: false,
      targetUrl: '',
      savedUserAgent: null,
      resolvePromise: null,
      rejectPromise: null,

      triggerCfSolver: (url) => {
        return new Promise((resolve, reject) => {
          set({
            isSolving: true,
            targetUrl: url,
            resolvePromise: resolve,
            rejectPromise: reject,
          });
        });
      },

      completeSolver: (userAgent) => {
        const { resolvePromise } = get();
        if (resolvePromise) resolvePromise({ userAgent });
        
        set({ 
          isSolving: false, 
          targetUrl: '', 
          savedUserAgent: userAgent, // This will now be permanently saved!
          resolvePromise: null, 
          rejectPromise: null 
        });
      },

      cancelSolver: () => {
        const { rejectPromise } = get();
        if (rejectPromise) rejectPromise(new Error('Captcha cancelled by user'));
        set({ isSolving: false, targetUrl: '', resolvePromise: null, rejectPromise: null });
      },
    }),
    {
      name: 'cloudflare-store', // Unique name for local storage key
      storage: createJSONStorage(() => AsyncStorage),
      // CRITICAL: We ONLY want to save the User-Agent. 
      // We do not want to accidentally save promises or 'isSolving' states across app restarts.
      partialize: (state) => ({ savedUserAgent: state.savedUserAgent }),
    }
  )
);