import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';

export interface UserInfo {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    provider: string;
}

/**
 * Hook to manage Firebase authentication state.
 * Uses onAuthStateChanged listener for real-time auth state tracking.
 * Firebase SDK automatically persists sessions — no manual token storage needed.
 */
export const useAuth = () => {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    provider: firebaseUser.providerData[0]?.providerId || 'unknown',
                });
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const logout = async (): Promise<void> => {
        const auth = getAuth();
        await signOut(auth);
    };

    return { user, loading, logout };
};

export default useAuth;
