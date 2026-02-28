import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Languages } from 'lucide-react-native';

interface AppHeaderProps {
    colors: any;
}

const AppHeader: React.FC<AppHeaderProps> = memo(({ colors }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.5,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                })
            ])
        ).start();
    }, [pulseAnim]);

    return (
        <View style={styles.header}>
            <View style={styles.brandContainer}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                    <Languages size={20} color={colors.primaryForeground} />
                </View>
                <View>
                    <Text style={[styles.title, { color: colors.foreground }]}>
                        AITO
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                        AI Translate Overlay
                    </Text>
                </View>
            </View>

            <View style={styles.statusContainer}>
                <Animated.View
                    style={[
                        styles.statusDot,
                        { backgroundColor: colors.success, opacity: pulseAnim }
                    ]}
                />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Online</Text>
            </View>
        </View>
    );
});

AppHeader.displayName = 'AppHeader';

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    brandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '500',
    },
});

export default AppHeader;
