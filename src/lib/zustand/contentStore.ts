import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {mainStorage} from '../storage/StorageService';
import {extensionStorage, ProviderExtension} from '../storage/extensionStorage';

// No cloud sync for providers — removed cloudSyncService import

const zustandMainStorage = {
  setItem: (name: string, value: string) => mainStorage.setString(name, value),
  getItem: (name: string) => mainStorage.getString(name) ?? null,
  removeItem: (name: string) => mainStorage.delete(name),
};

export interface Content {
  provider: ProviderExtension;
  setProvider: (type: ProviderExtension) => void;
  installedProviders: ProviderExtension[];
  availableProviders: ProviderExtension[];
  setInstalledProviders: (providers: ProviderExtension[]) => void;
  setAvailableProviders: (providers: ProviderExtension[]) => void;
  activeExtensionProvider: ProviderExtension | null;
  setActiveExtensionProvider: (provider: ProviderExtension | null) => void;
  rehydrate: () => void;
}

const EMPTY_PROVIDER: ProviderExtension = {
  value: '',
  display_name: '',
  type: 'global',
  installed: false,
  disabled: false,
  version: '0.0.1',
  icon: '',
  installedAt: 0,
  lastUpdated: 0,
};

const useContentStore = create<Content>()(
  persist(
    (set, _get) => ({
      provider: EMPTY_PROVIDER,
      installedProviders: extensionStorage
        .getInstalledProviders()
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
      availableProviders: [],
      activeExtensionProvider: null,

      rehydrate: () => {
        set({
          installedProviders: extensionStorage
            .getInstalledProviders()
            .sort((a, b) => a.display_name.localeCompare(b.display_name)),
        });
      },

      setProvider: (provider: ProviderExtension) => set({provider}),

      setInstalledProviders: (providers: ProviderExtension[]) => {
        const sorted = providers.sort((a, b) =>
          a.display_name.localeCompare(b.display_name),
        );
        set({installedProviders: sorted});
        // No cloud sync for providers
      },

      setAvailableProviders: (providers: ProviderExtension[]) =>
        set({availableProviders: providers}),

      setActiveExtensionProvider: (provider: ProviderExtension | null) =>
        set({activeExtensionProvider: provider}),
    }),
    {
      name: 'content-storage',
      storage: createJSONStorage(() => zustandMainStorage),
      partialize: state => ({
        provider: state.provider,
        activeExtensionProvider: state.activeExtensionProvider,
      }),
    },
  ),
);

export default useContentStore;