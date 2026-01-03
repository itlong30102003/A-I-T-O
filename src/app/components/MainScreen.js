import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';

export default function MainScreen({ onLogout }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Get current user
        const currentUser = auth().currentUser;
        if (currentUser) {
            setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                provider: currentUser.providerData[0]?.providerId || 'unknown',
            });
        }
    }, []);

    const handleLogout = async () => {
        try {
            await auth().signOut();
            if (onLogout) onLogout();
        } catch (error) {
            Alert.alert('Lỗi', 'Không thể đăng xuất');
        }
    };

    return (
        <View>
            <Text>
                {user?.displayName || user?.email || 'Chưa có tên'}
            </Text>
            {/* Logout Button */}
            <TouchableOpacity onPress={handleLogout}>
                <Text>Đăng xuất</Text>
            </TouchableOpacity>
        </View>
    );
}