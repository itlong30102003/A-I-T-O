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
    Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { LoginManager, AccessToken, Profile } from 'react-native-fbsdk-next';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In (gọi 1 lần khi app khởi động)
GoogleSignin.configure({
    webClientId: '1088527046352-skeg741v3hp9rb9kp8lr5qkhkuacmclc.apps.googleusercontent.com', // Lấy từ Firebase Console > Authentication > Google
});

// Helper function to save user profile to Firestore
const saveUserProfile = async (user, additionalData = {}) => {
    try {
        const userRef = firestore().collection('users').doc(user.uid);
        const userData = {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || additionalData.name || null,
            photoURL: user.photoURL || additionalData.imageURL || null,
            provider: user.providerData[0]?.providerId || 'unknown',
            updatedAt: firestore.FieldValue.serverTimestamp(),
            lastLoginAt: firestore.FieldValue.serverTimestamp(),
            ...additionalData,
        };

        // Use set with merge to create or update
        await userRef.set(userData, { merge: true });
        console.log('User profile saved successfully:', user.uid);

        return true;
    } catch (error) {
        console.error('Error saving user profile:', error.message);
        // Don't block login if profile save fails
        return false;
    }
};

export default function LoginScreen({ onLoginSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleEmailAuth = async () => {
        if (!email || !password) {
            Alert.alert('Lỗi', 'Vui lòng nhập email và mật khẩu');
            return;
        }
        if (!isLogin && password !== confirmPassword) {
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);
        try {
            let userCredential;
            if (isLogin) {
                userCredential = await auth().signInWithEmailAndPassword(email, password);
            } else {
                userCredential = await auth().createUserWithEmailAndPassword(email, password);
            }

            // Save user profile to Firestore
            await saveUserProfile(userCredential.user);

            if (onLoginSuccess) onLoginSuccess();
        } catch (error) {
            let message = 'Đã có lỗi xảy ra';
            if (error.code === 'auth/email-already-in-use') {
                message = 'Email này đã được sử dụng';
            } else if (error.code === 'auth/invalid-email') {
                message = 'Email không hợp lệ';
            } else if (error.code === 'auth/weak-password') {
                message = 'Mật khẩu quá yếu (tối thiểu 6 ký tự)';
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = 'Email hoặc mật khẩu không đúng';
            }
            Alert.alert('Lỗi', message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleAuth = async () => {
        setLoading(true);
        try {
            // Check if Play Services are available
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Get the user's ID token
            const signInResult = await GoogleSignin.signIn();

            // Get idToken from the response
            const idToken = signInResult.data?.idToken;

            if (!idToken) {
                throw new Error('Không thể lấy ID token từ Google');
            }

            // Create a Google credential with the token
            const googleCredential = auth.GoogleAuthProvider.credential(idToken);

            // Sign-in the user with the credential
            const userCredential = await auth().signInWithCredential(googleCredential);

            // Save user profile to Firestore
            await saveUserProfile(userCredential.user, {
                googleId: signInResult.data?.user?.id || null,
            });

            if (onLoginSuccess) onLoginSuccess();
        } catch (error) {
            console.error('Google login error:', error);
            let message = 'Đã có lỗi xảy ra khi đăng nhập Google';

            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                message = 'Người dùng đã hủy đăng nhập';
            } else if (error.code === statusCodes.IN_PROGRESS) {
                message = 'Đang xử lý đăng nhập...';
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                message = 'Google Play Services không khả dụng';
            }

            Alert.alert('Lỗi đăng nhập Google', message);
        } finally {
            setLoading(false);
        }
    };

    const handleFacebookAuth = async () => {
        setLoading(true);
        try {
            // Attempt login with permissions (only public_profile for dev mode)
            const result = await LoginManager.logInWithPermissions(['public_profile']);

            if (result.isCancelled) {
                throw new Error('Người dùng đã hủy đăng nhập');
            }

            // Once signed in, get the users AccessToken
            const data = await AccessToken.getCurrentAccessToken();

            if (!data) {
                throw new Error('Không thể lấy access token');
            }

            // Create a Firebase credential with the AccessToken
            const facebookCredential = auth.FacebookAuthProvider.credential(data.accessToken);

            // Sign-in the user with the credential
            const userCredential = await auth().signInWithCredential(facebookCredential);

            // Get Facebook profile for additional data
            const fbProfile = await Profile.getCurrentProfile();

            // Save user profile to Firestore
            await saveUserProfile(userCredential.user, {
                facebookId: fbProfile?.userID || null,
                name: fbProfile?.name || null,
                firstName: fbProfile?.firstName || null,
                lastName: fbProfile?.lastName || null,
                imageURL: fbProfile?.imageURL || null,
            });

            if (onLoginSuccess) onLoginSuccess();
        } catch (error) {
            console.error('Facebook login error:', error);
            Alert.alert('Lỗi đăng nhập Facebook', error.message || 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
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
                    <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleAuth} disabled={loading}>
                        <Text style={styles.socialIcon}>G</Text>
                        <Text style={styles.socialText}>Tiếp tục với Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.socialBtn, styles.facebookBtn]}
                        onPress={handleFacebookAuth}
                        disabled={loading}
                    >
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