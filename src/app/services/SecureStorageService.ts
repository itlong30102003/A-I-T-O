import EncryptedStorage from 'react-native-encrypted-storage';

/**
 * SecureStorageService - Wrapper for EncryptedSharedPreferences (Android) / Keychain (iOS).
 * 
 * Use this for app-level sensitive data (user preferences, cached settings, etc.).
 * NOTE: Firebase Auth tokens are managed automatically by the Firebase SDK — 
 * do NOT store Firebase tokens here.
 */
class SecureStorageService {
    /**
     * Save a value securely.
     */
    async save(key: string, value: string): Promise<void> {
        try {
            await EncryptedStorage.setItem(key, value);
        } catch (error) {
            console.error('SecureStorage: Error saving', key, error);
        }
    }

    /**
     * Save an object as JSON securely.
     */
    async saveObject(key: string, value: object): Promise<void> {
        try {
            await EncryptedStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('SecureStorage: Error saving object', key, error);
        }
    }

    /**
     * Retrieve a stored value.
     */
    async get(key: string): Promise<string | null> {
        try {
            return await EncryptedStorage.getItem(key);
        } catch (error) {
            console.error('SecureStorage: Error reading', key, error);
            return null;
        }
    }

    /**
     * Retrieve and parse a stored JSON object.
     */
    async getObject<T = any>(key: string): Promise<T | null> {
        try {
            const raw = await EncryptedStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.error('SecureStorage: Error reading object', key, error);
            return null;
        }
    }

    /**
     * Remove a specific key.
     */
    async remove(key: string): Promise<void> {
        try {
            await EncryptedStorage.removeItem(key);
        } catch (error) {
            console.error('SecureStorage: Error removing', key, error);
        }
    }

    /**
     * Clear all encrypted storage data.
     * Use with caution — this removes ALL encrypted data.
     */
    async clearAll(): Promise<void> {
        try {
            await EncryptedStorage.clear();
            console.log('SecureStorage: All data cleared');
        } catch (error) {
            console.error('SecureStorage: Error clearing all', error);
        }
    }
}

export const secureStorageService = new SecureStorageService();
export default secureStorageService;
