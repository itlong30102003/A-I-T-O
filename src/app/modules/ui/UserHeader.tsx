import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../core/hooks/useAuth';
import { useSettings } from '../settings/SettingsContext';
import { Settings, LogOut } from 'lucide-react-native';

interface UserHeaderProps {
    colors: any;
    onSettingsPress: () => void;
    onLogoutPress?: () => void;
}

const UserHeader: React.FC<UserHeaderProps> = memo(({ colors, onSettingsPress, onLogoutPress }) => {
    const { user } = useAuth();
    const { t } = useSettings();

    const displayName = user?.displayName || user?.email?.split('@')[0] || t('main.noName');
    const displayEmail = user?.email || '';
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <View style={[styles.userSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.contentRow}>
                <View style={[styles.avatar, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
                </View>

                <View style={styles.infoContainer}>
                    <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <Text style={[styles.userEmail, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {displayEmail}
                    </Text>
                    <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: colors.primary + '1A' }]}>
                            <View style={[styles.badgeDot, { backgroundColor: colors.primary }]} />
                            <Text style={[styles.badgeText, { color: colors.primary }]}>Free</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
                        onPress={onSettingsPress}
                    >
                        <Settings size={18} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    {onLogoutPress && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: colors.destructive + '1A' }]}
                            onPress={onLogoutPress}
                        >
                            <LogOut size={18} color={colors.destructive} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

UserHeader.displayName = 'UserHeader';

const styles = StyleSheet.create({
    userSection: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    infoContainer: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.5,
    },
    userEmail: {
        fontSize: 12,
        marginTop: 2,
        fontFamily: 'monospace',
    },
    badgeRow: {
        marginTop: 8,
        flexDirection: 'row',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 6,
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'column',
        gap: 8,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default UserHeader;
