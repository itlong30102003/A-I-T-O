import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';

export default function LoginScreen({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailAuth = () => {
        if (!email || !password) {
            alert('Vui lòng nhập email và mật khẩu');
            return;
        }
        if (!isLogin && password !== confirmPassword) {
            alert('Mật khẩu xác nhận không khớp');
            return;
        }
        setLoading(true);
        // TODO: Implement Firebase email auth
        console.log(isLogin ? 'Login' : 'Register', { email, password });
        setTimeout(() => {
            setLoading(false);
            if (onLoginSuccess) onLoginSuccess();
        }, 1500);
    };

    const handleGoogleAuth = () => {
        // TODO: Implement Firebase Google OAuth
        console.log('Google OAuth');
    };

    const handleFacebookAuth = () => {
        // TODO: Implement Firebase Facebook OAuth
        console.log('Facebook OAuth');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>AITO</Text>
                    <Text style={styles.tagline}>AI Translate Overlay</Text>
                </View>

                {/* Tab Switch */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, isLogin && styles.tabActive]}
                        onPress={() => setIsLogin(true)}
                    >
                        <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>Đăng nhập</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, !isLogin && styles.tabActive]}
                        onPress={() => setIsLogin(false)}
                    >
                        <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>Đăng ký</Text>
                    </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#888"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Mật khẩu"
                        placeholderTextColor="#888"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    {!isLogin && (
                        <TextInput
                            style={styles.input}
                            placeholder="Xác nhận mật khẩu"
                            placeholderTextColor="#888"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    )}

                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.btnDisabled]}
                        onPress={handleEmailAuth}
                        disabled={loading}
                    >
                        <Text style={styles.primaryBtnText}>
                            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
                        </Text>
                    </TouchableOpacity>

                    {isLogin && (
                        <TouchableOpacity style={styles.forgotBtn}>
                            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>hoặc</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Social Auth */}
                <View style={styles.socialContainer}>
                    <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleAuth}>
                        <Text style={styles.socialIcon}>G</Text>
                        <Text style={styles.socialText}>Tiếp tục với Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.socialBtn, styles.facebookBtn]} onPress={handleFacebookAuth}>
                        <Text style={styles.socialIcon}>f</Text>
                        <Text style={[styles.socialText, styles.facebookText]}>Tiếp tục với Facebook</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <Text style={styles.footer}>
                    Bằng việc đăng nhập, bạn đồng ý với{' '}
                    <Text style={styles.link}>Điều khoản dịch vụ</Text> và{' '}
                    <Text style={styles.link}>Chính sách bảo mật</Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 6,
    },
    tagline: {
        fontSize: 14,
        color: '#888',
        marginTop: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#4f46e5',
    },
    tabText: {
        fontSize: 15,
        color: '#888',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#fff',
    },
    form: {
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#fff',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2a2a3e',
    },
    primaryBtn: {
        backgroundColor: '#4f46e5',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    forgotBtn: {
        alignItems: 'center',
        marginTop: 16,
    },
    forgotText: {
        color: '#4f46e5',
        fontSize: 14,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#2a2a3e',
    },
    dividerText: {
        color: '#666',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    socialContainer: {
        gap: 12,
        marginBottom: 32,
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 14,
        gap: 10,
    },
    socialIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    socialText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    facebookBtn: {
        backgroundColor: '#1877f2',
    },
    facebookText: {
        color: '#fff',
    },
    footer: {
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        lineHeight: 20,
    },
    link: {
        color: '#4f46e5',
    },
});
