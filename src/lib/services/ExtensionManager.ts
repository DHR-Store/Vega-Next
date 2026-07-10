import axios from 'axios';
import {
  extensionStorage,
  ProviderExtension,
  ProviderModule,
} from '../storage/extensionStorage';

// Extend the interface locally so TypeScript knows about sourceUrl and original_value
export interface DynamicProviderExtension extends ProviderExtension {
  sourceUrl?: string;
  original_value?: string; // Track original folder name to avoid 404s
}

/**
 * Extension manager service for handling dynamic provider loading
 */
export class ExtensionManager {
  private static instance: ExtensionManager;
  
  private baseUrl =
    'https://raw.githubusercontent.com/DHR-Store/vega-provider/refs/heads/main';

  // --- ADDED: Your Fine-grained GitHub PAT ---
  private githubToken = 'YOUR GITHUB PERSONAL ACCESS TOKEN';

  private testMode = false;
  private baseUrlTestMode = '';

  private manifestUrl = `${this.baseUrl}/manifest.json`;

  // Test mode configuration
  private testModuleCacheExpiry = 200000;
  private testModuleCache = new Map<
    string,
    {module: ProviderModule; cachedAt: number}
  >();

  static getInstance(): ExtensionManager {
    if (!ExtensionManager.instance) {
      ExtensionManager.instance = new ExtensionManager();
    }
    return ExtensionManager.instance;
  }

  // --- Parse the input string into a valid raw GitHub URL ---
  public getBaseUrlFromInput(input: string): string {
    if (input.startsWith('http')) return input;
    const parts = input.trim().split('/');
    const user = parts[0];
    const repo = parts.length > 1 ? `${parts[1]}-vega-providers` : 'vega-providers';
    return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/main`;
  }

  // --- Format shorthand for Namespacing ---
  public getRepoShorthand(input: string): string {
    if (input.startsWith('http')) {
      const stripped = input.replace('https://raw.githubusercontent.com/', '');
      const parts = stripped.split('/');
      const user = parts[0];
      const repo = parts[1];
      if (repo === 'vega-providers') return user;
      if (repo.endsWith('-vega-providers')) return `${user}/${repo.replace('-vega-providers', '')}`;
      return `${user}/${repo}`;
    }
    const parts = input.trim().split('/');
    return parts.length > 1 ? `${parts[0]}-${parts[1]}` : parts[0];
  }

  // --- Fetch manifest from a custom repository with Token & Cache Busting ---
  async fetchCustomManifest(repoInput: string): Promise<DynamicProviderExtension[]> {
    try {
      const customBaseUrl = this.getBaseUrlFromInput(repoInput);
      const repoShorthand = this.getRepoShorthand(repoInput);
      
      // ADDED ?t=Date.now() to bypass GitHub's aggressive 5-minute CDN cache
      const manifestUrl = `${customBaseUrl}/manifest.json?t=${Date.now()}`;
      console.log('Fetching custom manifest from:', manifestUrl);
      
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      };

      const response = await axios.get(manifestUrl, { 
        timeout: 10000, 
        headers 
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid manifest format');
      }

      const providers: DynamicProviderExtension[] = response.data.map((item: any) => ({
        // NAMESPACE the value so identical providers from different repos don't conflict
        value: `${repoShorthand}_${item.value}`, 
        original_value: item.value, // Save the actual name to fetch the correct folders
        display_name: `${item.display_name} (${repoShorthand})`,
        disabled: item.disabled || false,
        version: item.version,
        icon: item.icon || '',
        type: item.type || 'global',
        category: item.category || '',
        installed: false,
        sourceUrl: customBaseUrl, // Attach the custom URL
      }));

      return providers;
    } catch (error) {
      console.error('Failed to fetch custom manifest:', error);
      throw error;
    }
  }

  /**
   * Fetch latest manifest from GitHub
   */
  async fetchManifest(force = false): Promise<ProviderExtension[]> {
    try {
      // Check cache first
      if (!force && !extensionStorage.isManifestCacheExpired()) {
        const cached = extensionStorage.getManifestCache();
        if (cached.length > 0) {
          return cached;
        }
      }

      // ADDED ?t=Date.now() to bypass GitHub CDN cache
      const manifestUrl = this.testMode
        ? `${this.baseUrlTestMode}/manifest.json?t=${Date.now()}`
        : `${this.manifestUrl}?t=${Date.now()}`;
      console.log('Fetching manifest from:', manifestUrl);
      
      const headers: Record<string, string> = this.testMode ? {} : {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      };

      const response = await axios.get(manifestUrl, {
        timeout: 10000,
        headers
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid manifest format');
      }

      const providers: ProviderExtension[] = response.data.map((item: any) => ({
        value: item.value,
        display_name: item.display_name,
        disabled: item.disabled || false,
        version: item.version,
        icon: item.icon || '',
        type: item.type || 'global',
        category: item.category || '',
        installed: false,
      }));

      // Cache the manifest
      extensionStorage.setManifestCache(providers);
      extensionStorage.setAvailableProviders(providers);

      return providers;
    } catch (error) {
      console.error('Failed to fetch manifest:', error);

      // Return cached data if available
      const cached = extensionStorage.getManifestCache();
      if (cached.length > 0) {
        return cached;
      }

      throw error;
    }
  }

  /**
   * Download and cache provider modules
   * MODIFIED: Uses originalValue parameter to construct correct paths
   */
  async downloadProviderModules(
    providerValue: string,
    version: string,
    sourceUrl?: string,
    originalValue?: string
  ): Promise<ProviderModule> {
    // If a custom sourceUrl is provided, we bypass test mode to ensure we fetch from the remote repo
    if (this.testMode && !sourceUrl) {
      return this.downloadTestProviderModule(providerValue);
    }
    try {
      const requiredFiles = ['posts', 'meta', 'stream', 'catalog'];
      const optionalFiles = ['episodes'];
      const allFiles = [...requiredFiles, ...optionalFiles];

      const activeBaseUrl = sourceUrl || this.baseUrl;
      const downloadFolder = originalValue || providerValue; // Use original un-prefixed folder name

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      };

      const modules: Record<string, string> = {};
      const downloadPromises = allFiles.map(async fileName => {
        try {
          // CACHE BUSTING ADDED HERE to fetch fresh .js files
          const url = `${activeBaseUrl}/dist/${downloadFolder}/${fileName}.js?t=${Date.now()}`;
          console.log(`Downloading: ${url}`);

          const response = await axios.get(url, {
            timeout: 15000,
            headers
          });

          if (response.data) {
            modules[fileName] = response.data;
          }
        } catch (error) {
          if (requiredFiles.includes(fileName)) {
            console.error(
              `Failed to download ${fileName}.js for ${providerValue}:`,
              error,
            );
            throw error;
          } else {
            console.warn(
              `Optional file ${fileName}.js not found for ${providerValue}`,
            );
          }
        }
      });

      await Promise.all(downloadPromises);

      const missingRequired = requiredFiles.filter(file => !modules[file]);
      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required files: ${missingRequired.join(', ')}`,
        );
      }

      const providerModule: ProviderModule = {
        value: providerValue, // Maintain prefixed cache state globally
        version,
        modules: {
          posts: modules.posts,
          meta: modules.meta,
          stream: modules.stream,
          catalog: modules.catalog,
          episodes: modules.episodes,
        },
        cachedAt: Date.now(),
      };

      // Cache the modules
      extensionStorage.cacheProviderModules(providerModule);

      return providerModule;
    } catch (error) {
      console.error(`Failed to download modules for ${providerValue}:`, error);
      throw error;
    }
  }

  async downloadTestProviderModule(
    providerValue: string,
  ): Promise<ProviderModule> {
    try {
      const url = `${this.baseUrlTestMode}/dist/${providerValue}/`;
      const requiredFiles = ['posts', 'meta', 'stream', 'catalog'];
      const optionalFiles = ['episodes'];
      const allFiles = [...requiredFiles, ...optionalFiles];
      const modules: Record<string, string> = {};
      const downloadPromises = allFiles.map(async fileName => {
        try {
          // CACHE BUSTING ADDED HERE
          const fileUrl = `${url}${fileName}.js?t=${Date.now()}`;
          console.log(`Downloading test module: ${fileUrl}`);

          const response = await axios.get(fileUrl, {
            timeout: 15000,
          });

          if (response.data) {
            modules[fileName] = response.data;
          } else {
            throw new Error(`No data received for ${fileName}`);
          }
        } catch (error) {
          if (requiredFiles.includes(fileName)) {
            console.error(
              `Failed to download ${fileName}.js for ${providerValue}:`,
              error,
            );
            throw error;
          } else {
            console.warn(
              `Optional file ${fileName}.js not found for ${providerValue}`,
            );
          }
        }
      });

      await Promise.all(downloadPromises);

      if (!modules.posts) {
        throw new Error(`No data received for ${providerValue}`);
      }

      const providerModule: ProviderModule = {
        value: providerValue,
        version: 'test',
        modules: {
          posts: modules.posts,
          meta: modules.meta,
          stream: modules.stream,
          catalog: modules.catalog,
          episodes: modules.episodes,
        },
        cachedAt: Date.now(),
      };

      this.testModuleCache.set(providerValue, {
        module: providerModule,
        cachedAt: Date.now(),
      });

      return providerModule;
    } catch (error) {
      console.error(
        `Failed to download test module for ${providerValue}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Install a provider
   * MODIFIED: Support sourceUrl and original_value extraction
   */
  async installProvider(provider: DynamicProviderExtension): Promise<void> {
    try {
      await this.downloadProviderModules(provider.value, provider.version, provider.sourceUrl, provider.original_value);
      extensionStorage.installProvider(provider);
      console.log(`Successfully installed provider: ${provider.display_name}`);
    } catch (error) {
      console.error(
        `Failed to install provider ${provider.display_name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Uninstall a provider
   */
  uninstallProvider(providerValue: string): void {
    extensionStorage.uninstallProvider(providerValue);
    console.log(`Uninstalled provider: ${providerValue}`);
  }

  /**
   * Update a provider
   * MODIFIED: Support sourceUrl and original_value extraction
   */
  async updateProvider(provider: DynamicProviderExtension): Promise<void> {
    try {
      await this.downloadProviderModules(provider.value, provider.version, provider.sourceUrl, provider.original_value);
      extensionStorage.installProvider(provider);
      console.log(`Successfully updated provider: ${provider.display_name}`);
    } catch (error) {
      console.error(
        `Failed to update provider ${provider.display_name}:`,
        error,
      );
      throw error;
    }
  }

  getProviderModules(providerValue: string): ProviderModule | undefined {
    if (this.testMode) {
      const cached = this.testModuleCache.get(providerValue);
      if (cached) {
        this.refreshTestModuleInBackground(providerValue);
        return cached.module;
      }
      this.refreshTestModuleInBackground(providerValue);
      console.warn(
        `No test module cache found for ${providerValue}, falling back to regular cache`,
      );
    }
    return extensionStorage.getProviderModules(providerValue);
  }

  checkForUpdates(): ProviderExtension[] {
    return extensionStorage.getProvidersNeedingUpdate();
  }

  async initialize(): Promise<void> {
    try {
      const installed = extensionStorage.getInstalledProviders();
      const available = extensionStorage.getAvailableProviders();
      console.log(`Loaded ${installed.length} installed providers`);
      console.log(`Loaded ${available.length} available providers`);
      if (extensionStorage.isManifestCacheExpired()) {
        try {
          await this.fetchManifest(false);
        } catch (error) {
          console.warn('Failed to refresh manifest on startup:', error);
        }
      }
    } catch (error) {
      console.error('Failed to initialize extension system:', error);
    }
  }

  setTestMode(enabled: boolean): void {
    this.testMode = enabled;
    console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  // --- FIXED: Dynamically handles changing target test addresses ---
  setBaseUrlTestMode(url: string): void {
    this.baseUrlTestMode = url;
    console.log(`Test Base URL set to: ${url}`);
  }

  private isTestModuleCacheExpired(providerValue: string): boolean {
    const cached = this.testModuleCache.get(providerValue);
    if (!cached) {
      return true;
    }
    return Date.now() - cached.cachedAt > this.testModuleCacheExpiry;
  }

  async preFetchTestModules(providerValues: string[]): Promise<void> {
    if (!this.testMode) {
      return;
    }
    console.log('Pre-fetching test modules for:', providerValues);
    const fetchPromises = providerValues.map(async providerValue => {
      try {
        const module = await this.downloadTestProviderModule(providerValue);
        this.testModuleCache.set(providerValue, {
          module,
          cachedAt: Date.now(),
        });
        console.log(`Pre-fetched test module for: ${providerValue}`);
      } catch (error) {
        console.error(
          `Failed to pre-fetch test module for ${providerValue}:`,
          error,
        );
      }
    });
    await Promise.allSettled(fetchPromises);
  }

  private refreshTestModuleInBackground(providerValue: string): void {
    if (!this.testMode) {
      return;
    }
    this.downloadTestProviderModule(providerValue)
      .then(module => {
        this.testModuleCache.set(providerValue, {
          module,
          cachedAt: Date.now(),
        });
        console.log(`Background refreshed test module for: ${providerValue}`);
      })
      .catch(error => {
        console.error(
          `Failed to background refresh test module for ${providerValue}:`,
          error,
        );
      });
  }
}

export const extensionManager = ExtensionManager.getInstance();