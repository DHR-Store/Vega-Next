import {MMKVLoader} from 'react-native-mmkv-storage';
import {type MMKVStorage} from 'react-native-mmkv-storage/src/index';

/**
 * Interface for the StorageService class.
 */
export interface IStorageService {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getBool(key: string, defaultValue?: boolean): boolean | undefined;
  setBool(key: string, value: boolean): void;
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): void;
  getObject<T>(key: string): T | undefined;
  setObject<T>(key: string, value: T): void;
  getArray<T>(key: string): T[] | undefined;
  setArray<T>(key: string, value: T[]): void;
  delete(key: string): void;
  contains(key: string): boolean;
  clearAll(): void;
}

/**
 * Base storage service that wraps MMKV operations.
 */
export class StorageService implements IStorageService {
  private storage: MMKVStorage;

  constructor(instanceId?: string) {
    const loader = new MMKVLoader();
    this.storage = instanceId
      ? loader.withInstanceID(instanceId).initialize()
      : loader.initialize();
  }

  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  setString(key: string, value: string): void {
    this.storage.setString(key, value);
  }

  getBool(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.storage.getBool(key);
    return value === undefined ? defaultValue : value;
  }

  setBool(key: string, value: boolean): void {
    this.storage.setBool(key, value);
  }

  getNumber(key: string): number | undefined {
    return this.storage.getInt(key);
  }

  setNumber(key: string, value: number): void {
    this.storage.setInt(key, value);
  }

  getObject<T>(key: string): T | undefined {
    const json = this.storage.getString(key);
    if (!json) return undefined;
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      console.error(`Failed to parse stored object for key ${key}:`, e);
      return undefined;
    }
  }

  setObject<T>(key: string, value: T): void {
    this.storage.setString(key, JSON.stringify(value));
  }

  getArray<T>(key: string): T[] | undefined {
    return this.getObject<T[]>(key);
  }

  setArray<T>(key: string, value: T[]): void {
    this.setObject(key, value);
  }

  delete(key: string): void {
    this.storage.removeItem(key);
  }

  contains(key: string): boolean {
    return this.storage.hasKey(key);
  }

  clearAll(): void {
    this.storage.clearStore();
  }
}

// ─────────────────────────────────────────────────────────────
// Per-user storage manager
// When a user logs in we switch all stores to a user-scoped
// MMKV partition so their data is isolated and can be restored
// after reinstall by pulling from the cloud (CloudSyncService).
// ─────────────────────────────────────────────────────────────

const GUEST_PARTITION = 'main';
const CACHE_PARTITION = 'cache';

class UserStorageService {
  private _userId: string | null = null;
  private _main: IStorageService = new StorageService(GUEST_PARTITION);
  private _cache: IStorageService = new StorageService(CACHE_PARTITION);

  /**
   * Call this right after a successful sign-in / sign-out.
   * Pass `null` to revert to the guest (shared) partition.
   */
  setCurrentUser(userId: string | null): void {
    this._userId = userId;

    if (userId) {
      // Each user gets their own isolated MMKV partitions
      this._main = new StorageService(`user-main-${userId}`);
      this._cache = new StorageService(`user-cache-${userId}`);
    } else {
      this._main = new StorageService(GUEST_PARTITION);
      this._cache = new StorageService(CACHE_PARTITION);
    }
  }

  getCurrentUserId(): string | null {
    return this._userId;
  }

  isLoggedIn(): boolean {
    return this._userId !== null;
  }

  /** User-scoped main storage */
  get main(): IStorageService {
    return this._main;
  }

  /** User-scoped cache storage */
  get cache(): IStorageService {
    return this._cache;
  }
}

/**
 * storageService — singleton used by login.ts and the cloud sync
 * service to partition data per user.
 */
export const storageService = new UserStorageService();

// Convenience re-exports that always point at the active partition.
// All storage classes (WatchHistoryStorage, WatchListStorage, etc.)
// import these, so switching the user automatically redirects them.
export const mainStorage: IStorageService = new Proxy(
  {} as IStorageService,
  {
    get(_target, prop: keyof IStorageService) {
      return (storageService.main as any)[prop].bind(storageService.main);
    },
  },
);

export const cacheStorage: IStorageService = new Proxy(
  {} as IStorageService,
  {
    get(_target, prop: keyof IStorageService) {
      return (storageService.cache as any)[prop].bind(storageService.cache);
    },
  },
);