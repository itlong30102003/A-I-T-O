import { useState, useEffect } from 'react';
import { getAuth, signOut } from '@react-native-firebase/auth';

export interface UserInfo {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    provider: string;
}

/**
 * Hook to manage Firebase authentication state.
 * Extracted from MainScreen to avoid prop-drilling user data.
 */
export const useAuth = () => {
    const [user, setUser] = useState<UserInfo | null>(null);

    useEffect(() => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            provider: currentUser.providerData[0]?.providerId || 'unknown',
        });
    }, []);

    const logout = async (): Promise<void> => {
        const auth = getAuth();
        await signOut(auth);
    };

    return { user, logout };
};

export default useAuth;
