import { cacheStorage } from './StorageService'; // Assuming this imports an instance or an object with storage methods

/**
 * Cache storage manager for storing temporary data.
 * This class acts as a wrapper around the underlying `cacheStorage`
 * from `StorageService` to provide a consistent interface.
 */
export class CacheStorage {

    /**
     * Set a string value in cache.
     * @param key The key to store the value under.
     * @param value The string value to store.
     */
    setString(key: string, value: string): void {
        // It's good practice to ensure the value is actually a string
        // before passing it to the underlying storage, though TypeScript helps here.
        if (typeof value !== 'string') {
            console.warn(`CacheStorage.setString: Value for key '${key}' is not a string. Coercing.`);
        }
        cacheStorage.setString(key, value);
    }

    /**
     * Get a string value from cache.
     * @param key The key of the string value to retrieve.
     * @returns The string value, or `undefined` if not found.
     */
    getString(key: string): string | undefined {
        return cacheStorage.getString(key);
    }

    /**
     * Set a boolean value in cache.
     * Note: Most underlying storage (like localStorage) stores everything as strings.
     * The `StorageService` should handle the serialization/deserialization.
     * @param key The key to store the boolean under.
     * @param value The boolean value to store.
     */
    setBool(key: string, value: boolean): void {
        if (typeof value !== 'boolean') {
            console.warn(`CacheStorage.setBool: Value for key '${key}' is not a boolean. Coercing.`);
        }
        cacheStorage.setBool(key, value);
    }

    /**
     * Get a boolean value from cache.
     * IMPORTANT: The original code passed `undefined` as a default.
     * This method might internally expect a boolean default or handle `undefined`
     * differently based on the `StorageService` implementation.
     * We'll assume `StorageService.getBool` already handles the `undefined` case correctly.
     * If not, you might need to adjust the `StorageService` implementation or wrap it here.
     * @param key The key of the boolean value to retrieve.
     * @returns The boolean value, or `undefined` if not found.
     */
    getBool(key: string): boolean | undefined {
        // Assuming cacheStorage.getBool already returns `undefined` if not found
        // or if the underlying storage cannot parse it as a boolean.
        // If your StorageService.getBool signature is `getBool(key: string, defaultValue: boolean): boolean;`
        // then you'd need to provide a default here: `return cacheStorage.getBool(key, false);` or `null` if appropriate.
        // However, the current signature `getBool(key: string): boolean | undefined` is better.
        return cacheStorage.getBool(key); // Removed the `undefined` argument as it's redundant if the method already handles it.
    }

    /**
     * Set an object value in cache.
     * The `StorageService` should handle the JSON serialization (`JSON.stringify`).
     * @param key The key to store the object under.
     * @param value The object value to store.
     */
    setObject<T>(key: string, value: T): void {
        // The underlying cacheStorage.setObject should handle `JSON.stringify`.
        // Add a check here if `value` could be `undefined` or `null` and you want to explicitly handle that.
        // For instance, if `value` is `undefined`, you might want to delete the key.
        if (value === undefined) {
             console.warn(`CacheStorage.setObject: Value for key '${key}' is undefined. Deleting key.`);
             cacheStorage.delete(key); // Or handle as per your application's logic
             return;
        }
        cacheStorage.setObject(key, value);
    }

    /**
     * Get an object value from cache.
     * The `StorageService` should handle the JSON deserialization (`JSON.parse`).
     * @param key The key of the object value to retrieve.
     * @returns The object value, or `undefined` if not found or parsing fails.
     */
    getObject<T>(key: string): T | undefined {
        return cacheStorage.getObject<T>(key);
    }

    /**
     * Delete a value from cache.
     * @param key The key of the value to delete.
     */
    delete(key: string): void {
        cacheStorage.delete(key);
    }

    /**
     * Check if a key exists in cache.
     * @param key The key to check for existence.
     * @returns `true` if the key exists, `false` otherwise.
     */
    contains(key: string): boolean {
        return cacheStorage.contains(key);
    }

    /**
     * Clear all cache.
     * This will remove all items stored by the underlying `cacheStorage`.
     */
    clearAll(): void {
        cacheStorage.clearAll();
    }
}

// Export singleton instance for easy access throughout the application
export const cacheStorageService = new CacheStorage();
