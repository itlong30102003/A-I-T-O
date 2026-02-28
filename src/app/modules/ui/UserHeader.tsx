import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../core/hooks/useAuth';
import { useSettings } from '../settings/SettingsContext';

interface UserHeaderProps {
    colors: {
        card: string;
        text: string;
        subtext: string;
        buttonBg: string;
    };
    onSettingsPress: () => void;
}

const UserHeader: React.FC<UserHeaderProps> = memo(({ colors, onSettingsPress }) => {
    const { user } = useAuth();
    const { t } = useSettings();

    return (
        <View style={[styles.userSection, { backgroundColor: colors.card }]}>
            <View style={styles.row}>
                <View style={styles.infoContainer}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                        {user?.displayName || user?.email || t('main.noName')}
                    </Text>
                    <Text style={[styles.userEmail, { color: colors.subtext }]}>
                        {user?.email}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.settingsBtn, { backgroundColor: colors.buttonBg }]}
                    onPress={onSettingsPress}
                >
                    <Text style={styles.settingsIcon}>⚙️</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

UserHeader.displayName = 'UserHeader';

const styles = StyleSheet.create({
    userSection: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        alignItems: 'center'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
    },
    infoContainer: {
        flex: 1
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    userEmail: {
        fontSize: 14,
        marginTop: 4
    },
    settingsBtn: {
        padding: 8,
        borderRadius: 8
    },
    settingsIcon: {
        fontSize: 20
    }
});

export default UserHeader;
