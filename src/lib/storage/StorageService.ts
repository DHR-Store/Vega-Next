import { MMKVLoader } from 'react-native-mmkv-storage';
import { type MMKVStorage } from 'react-native-mmkv-storage/src/index';

/**
 * Interface for the StorageService class.
 * This has been updated to reflect more robust return types.
 */
export interface IStorageService {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  // getBool now correctly returns `boolean | undefined` when no defaultValue is provided.
  getBool(key: string, defaultValue?: boolean): boolean | undefined;
  setBool(key: string, value: boolean): void;
  // getNumber is now more versatile.
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): void;
  getObject<T>(key: string): T | undefined;
  setObject<T>(key: string, value: T): void;
  getArray<T>(key: string): T[] | undefined;
  setArray<T>(key: string, value: T[]): void;
  delete(key: string): void;
  // 'contains' is now a more efficient operation.
  contains(key: string): boolean;
  clearAll(): void;
}

/**
 * Base storage service that wraps MMKV operations.
 * This version includes several fixes for improved functionality and efficiency.
 */
export class StorageService implements IStorageService {
  // Use a more specific type for the MMKV instance for better type safety.
  private storage: MMKVStorage;

  constructor(instanceId?: string) {
    const loader = new MMKVLoader();
    this.storage = instanceId
      ? loader.withInstanceID(instanceId).initialize()
      : loader.initialize();
  }

  // String operations
  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  setString(key: string, value: string): void {
    this.storage.setString(key, value);
  }

  // Boolean operations
  // FIX: This method is updated to correctly handle the optional defaultValue.
  // If no defaultValue is provided and the value is not found, it now returns `undefined`.
  getBool(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.storage.getBool(key);
    // If MMKV returns undefined, we return the provided defaultValue, which can also be undefined.
    // This allows for clearer logic in the calling code.
    return value === undefined ? defaultValue : value;
  }

  setBool(key: string, value: boolean): void {
    this.storage.setBool(key, value);
  }

  // Number operations
  // FIX: Using the correct MMKV methods for numbers.
  // `getInt` is used to retrieve a number, which aligns with how MMKV stores numbers.
  getNumber(key: string): number | undefined {
    return this.storage.getInt(key);
  }

  // FIX: Using the correct MMKV method for numbers.
  // `setInt` is the appropriate method to store number values in the MMKV store.
  setNumber(key: string, value: number): void {
    this.storage.setInt(key, value);
  }

  // Object operations
  getObject<T>(key: string): T | undefined {
    const json = this.storage.getString(key);
    if (!json) {
      return undefined;
    }
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

  // Array operations
  getArray<T>(key: string): T[] | undefined {
    return this.getObject<T[]>(key);
  }

  setArray<T>(key: string, value: T[]): void {
    this.setObject(key, value);
  }

  // Delete operations
  delete(key: string): void {
    this.storage.removeItem(key);
  }

  // Check if key exists
  // FIX: This is a significant performance improvement.
  // The original code performed up to three read operations.
  // The MMKV `hasKey` method provides a single, highly optimized check.
  contains(key: string): boolean {
    return this.storage.hasKey(key);
  }

  // Clear all storage
  clearAll(): void {
    this.storage.clearStore();
  }
}

// Create and export default instances
export const mainStorage: IStorageService = new StorageService();
export const cacheStorage: IStorageService = new StorageService('cache');
