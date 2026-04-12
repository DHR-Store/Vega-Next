// FIX: Import the StorageService class directly instead of the partitioned mainStorage
import {StorageService} from './StorageService';

// Create a GLOBAL storage instance that is tied to the device, NOT the user.
// This prevents extension data from vanishing when a user logs in or out.
const globalExtensionStorage = new StorageService('extensions-global-storage');

/**
 * Provider extension metadata
 */
export interface ProviderExtension {
  value: string;
  display_name: string;
  version: string;
  icon: string;
  disabled: boolean;
  type: 'global' | 'english' | 'india' | 'italy' | 'anime' | 'drama';
  installed: boolean;
  installedAt?: number;
  lastUpdated?: number;
}

/**
 * Provider module cache
 */
export interface ProviderModule {
  value: string;
  version: string;
  modules: {
    posts?: string;
    meta?: string;
    stream?: string;
    catalog?: string;
    episodes?: string;
  };
  cachedAt: number;
}

/**
 * Storage keys for extensions
 */
export enum ExtensionKeys {
  INSTALLED_PROVIDERS = 'installedProviders',
  AVAILABLE_PROVIDERS = 'availableProviders',
  PROVIDER_MODULES = 'providerModules',
  MANIFEST_CACHE = 'manifestCache',
  LAST_MANIFEST_FETCH = 'lastManifestFetch',
  SELECTED_PROVIDER = 'selectedProvider', // <-- NEW: Key to store the chosen provider
}

/**
 * Extension storage manager
 */
export class ExtensionStorage {
  /**
   * Get installed providers
   */
  getInstalledProviders(): ProviderExtension[] {
    return (
      globalExtensionStorage.getArray<ProviderExtension>(
        ExtensionKeys.INSTALLED_PROVIDERS,
      ) || []
    );
  }

  /**
   * Set installed providers
   */
  setInstalledProviders(providers: ProviderExtension[]): void {
    globalExtensionStorage.setArray(ExtensionKeys.INSTALLED_PROVIDERS, providers);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ProviderExtension[] {
    return (
      globalExtensionStorage.getArray<ProviderExtension>(
        ExtensionKeys.AVAILABLE_PROVIDERS,
      ) || []
    );
  }

  /**
   * Set available providers
   */
  setAvailableProviders(providers: ProviderExtension[]): void {
    globalExtensionStorage.setArray(ExtensionKeys.AVAILABLE_PROVIDERS, providers);
  }

  /**
   * Install a provider
   */
  installProvider(provider: ProviderExtension): void {
    const installed = this.getInstalledProviders();
    const existing = installed.find(p => p.value === provider.value);

    if (existing) {
      // Update existing provider
      existing.version = provider.version;
      existing.lastUpdated = Date.now();
    } else {
      // Add new provider
      installed.push({
        ...provider,
        installed: true,
        installedAt: Date.now(),
      });
    }

    this.setInstalledProviders(installed);
  }

  /**
   * Uninstall a provider
   */
  uninstallProvider(providerValue: string): void {
    const installed = this.getInstalledProviders();
    const filtered = installed.filter(p => p.value !== providerValue);
    this.setInstalledProviders(filtered);

    // Also remove cached modules
    this.removeProviderModules(providerValue);

    // If the uninstalled provider was the selected one, clear the selection
    if (this.getSelectedProvider() === providerValue) {
      globalExtensionStorage.delete(ExtensionKeys.SELECTED_PROVIDER);
    }
  }

  /**
   * Check if provider is installed
   */
  isProviderInstalled(providerValue: string): boolean {
    const installed = this.getInstalledProviders();
    return installed.some(p => p.value === providerValue);
  }

  /**
   * Get provider modules cache
   */
  getProviderModules(providerValue: string): ProviderModule | undefined {
    const allModules =
      globalExtensionStorage.getArray<ProviderModule>(ExtensionKeys.PROVIDER_MODULES) ||
      [];
    return allModules.find(m => m.value === providerValue);
  }

  /**
   * Cache provider modules
   */
  cacheProviderModules(modules: ProviderModule): void {
    const allModules =
      globalExtensionStorage.getArray<ProviderModule>(ExtensionKeys.PROVIDER_MODULES) ||
      [];

    const existingIndex = allModules.findIndex(m => m.value === modules.value);

    if (existingIndex >= 0) {
      allModules[existingIndex] = modules;
    } else {
      allModules.push(modules);
    }

    globalExtensionStorage.setArray(ExtensionKeys.PROVIDER_MODULES, allModules);
  }

  /**
   * Remove provider modules from cache
   */
  removeProviderModules(providerValue: string): void {
    const allModules =
      globalExtensionStorage.getArray<ProviderModule>(ExtensionKeys.PROVIDER_MODULES) ||
      [];

    const filtered = allModules.filter(m => m.value !== providerValue);
    globalExtensionStorage.setArray(ExtensionKeys.PROVIDER_MODULES, filtered);
  }

  /**
   * Get manifest cache
   */
  getManifestCache(): ProviderExtension[] {
    return (
      globalExtensionStorage.getArray<ProviderExtension>(ExtensionKeys.MANIFEST_CACHE) ||
      []
    );
  }

  /**
   * Set manifest cache
   */
  setManifestCache(manifest: ProviderExtension[]): void {
    globalExtensionStorage.setArray(ExtensionKeys.MANIFEST_CACHE, manifest);
    globalExtensionStorage.setNumber(ExtensionKeys.LAST_MANIFEST_FETCH, Date.now());
  }

  /**
   * Get last manifest fetch time
   */
  getLastManifestFetch(): number {
    return globalExtensionStorage.getNumber(ExtensionKeys.LAST_MANIFEST_FETCH) || 0;
  }

  /**
   * Check if manifest cache is expired (24 hours)
   */
  isManifestCacheExpired(): boolean {
    const lastFetch = this.getLastManifestFetch();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return now - lastFetch > twentyFourHours;
  }

  /**
   * Get providers that need updates
   */
  getProvidersNeedingUpdate(): ProviderExtension[] {
    const installed = this.getInstalledProviders();
    const available = this.getAvailableProviders();

    return installed.filter(installedProvider => {
      const availableProvider = available.find(
        p => p.value === installedProvider.value,
      );
      return (
        availableProvider &&
        availableProvider.version !== installedProvider.version
      );
    });
  }

  // =========================================================================
  // NEW METHODS: Store & Retrieve the Currently Selected Provider
  // =========================================================================

  /**
   * Get the currently selected provider (survives app restart & user login)
   */
  getSelectedProvider(): string | undefined {
    return globalExtensionStorage.getString(ExtensionKeys.SELECTED_PROVIDER);
  }

  /**
   * Set the currently selected provider
   */
  setSelectedProvider(providerValue: string): void {
    globalExtensionStorage.setString(ExtensionKeys.SELECTED_PROVIDER, providerValue);
  }

  /**
   * Clear all extension data
   */
  clearAll(): void {
    globalExtensionStorage.delete(ExtensionKeys.INSTALLED_PROVIDERS);
    globalExtensionStorage.delete(ExtensionKeys.AVAILABLE_PROVIDERS);
    globalExtensionStorage.delete(ExtensionKeys.PROVIDER_MODULES);
    globalExtensionStorage.delete(ExtensionKeys.MANIFEST_CACHE);
    globalExtensionStorage.delete(ExtensionKeys.LAST_MANIFEST_FETCH);
    globalExtensionStorage.delete(ExtensionKeys.SELECTED_PROVIDER);
  }
}

/**
 * Global extension storage instance
 */
export const extensionStorage = new ExtensionStorage();