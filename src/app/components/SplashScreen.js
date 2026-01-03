import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    Animated,
    StatusBar,
} from "react-native";


// Logo Screen - Simple centered logo
const LogoScreen = ({ onFinish }) => {
    useEffect(() => {
        const timer = setTimeout(onFinish, 2200);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <View style={styles.logoScreen}>
            <Image source={require("../assets/LogoAITO.png")} style={styles.logo} resizeMode="contain" />
        </View>
    );
};

// Content Screen
const ContentScreen = ({ data, index, total, onNext, onBack, onComplete }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;
    const isLast = index === total - 1;

    useEffect(() => {
        opacity.setValue(0);
        translateY.setValue(30);
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
    }, [index, opacity, translateY]);

    return (
        <View style={styles.gradientBg}>
            <StatusBar barStyle="light-content" />

            {/* Icon area */}
            <View style={styles.iconArea}>
                <Animated.View style={[styles.iconCard, { opacity, transform: [{ translateY }] }]}>
                    <Image source={data.icon} style={styles.iconImg} resizeMode="contain" />
                </Animated.View>
            </View>

            {/* Content area */}
            <View style={styles.contentArea}>
                <Animated.View style={{ opacity, transform: [{ translateY }] }}>
                    <Text style={styles.title}>{data.title}</Text>
                    <Text style={styles.desc}>{data.desc}</Text>
                </Animated.View>
            </View>

            {/* Bottom area */}
            <View style={styles.bottomArea}>
                {/* Dots */}
                <View style={styles.dots}>
                    {Array.from({ length: total }).map((_, i) => (
                        <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                    ))}
                </View>

                {/* Buttons */}
                <View style={styles.buttons}>
                    {index > 0 ? (
                        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                            <Text style={styles.backText}>← Quay lại</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.spacer} />
                    )}
                    <TouchableOpacity
                        style={[styles.nextBtn, isLast && styles.startBtn]}
                        onPress={isLast ? onComplete : onNext}
                    >
                        <Text style={[styles.nextText, isLast && styles.startText]}>
                            {isLast ? "Bắt đầu ngay" : "Tiếp tục"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// Data
const DATA = [
    {
        icon: require("../assets/LogoAITO.png"),
        title: "Chào mừng đến với AITO",
        desc: "Ứng dụng dịch thuật AI thông minh với công nghệ overlay hiện đại.",
    },
    {
        icon: require("../assets/AITranslate.png"),
        title: "Dịch 100+ ngôn ngữ",
        desc: "Hỗ trợ dịch nhanh và chính xác hơn 100 ngôn ngữ trên thế giới.",
    },
    {
        icon: require("../assets/OverlayIcon.png"),
        title: "Overlay thông minh",
        desc: "Dịch văn bản trực tiếp trên màn hình mà không cần rời ứng dụng.",
    },
    {
        icon: require("../assets/AIIcon.png"),
        title: "Powered by AI",
        desc: "Công nghệ AI tiên tiến giúp nhận diện và dịch văn bản tự động.",
    },
];

// Main
export default function SplashScreen({ onComplete }) {
    const [step, setStep] = useState(-1);

    if (step === -1) {
        return <LogoScreen onFinish={() => setStep(0)} />;
    }

    return (
        <ContentScreen
            key={step}
            data={DATA[step]}
            index={step}
            total={DATA.length}
            onNext={() => setStep(step + 1)}
            onBack={() => setStep(step - 1)}
            onComplete={onComplete}
        />
    );
}

const styles = StyleSheet.create({
    // Logo screen - dark, centered
    logoScreen: {
        flex: 1,
        backgroundColor: "#0f0f23",
        justifyContent: "center",
        alignItems: "center",
    },
    // Content screen background
    gradientBg: {
        flex: 1,
        backgroundColor: "#4f46e5",
    },
    logo: {
        width: 140,
        height: 140,
    },
    // Content screen layout
    iconArea: {
        flex: 1.2,
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 30,
    },
    iconCard: {
        width: 140,
        height: 140,
        borderRadius: 35,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    iconImg: {
        width: 80,
        height: 80,
    },
    contentArea: {
        flex: 1,
        paddingHorizontal: 32,
        justifyContent: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#fff",
        textAlign: "center",
        marginBottom: 14,
    },
    desc: {
        fontSize: 16,
        color: "rgba(255,255,255,0.85)",
        textAlign: "center",
        lineHeight: 24,
    },
    bottomArea: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    dots: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 24,
        gap: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "rgba(255,255,255,0.4)",
    },
    dotActive: {
        width: 28,
        backgroundColor: "#fff",
    },
    buttons: {
        flexDirection: "row",
        gap: 12,
    },
    spacer: {
        flex: 1,
    },
    backBtn: {
        flex: 1,
        height: 54,
        borderRadius: 27,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
    },
    backText: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "500",
    },
    nextBtn: {
        flex: 1.5,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    nextText: {
        fontSize: 16,
        color: "#4f46e5",
        fontWeight: "700",
    },
    startBtn: {
        backgroundColor: "#fbbf24", // Yellow accent
    },
    startText: {
        color: "#000",
    },
});