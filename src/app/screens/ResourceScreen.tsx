import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { resourceMonitorService, ResourceData } from '../services/ResourceMonitorService';

const { width } = Dimensions.get('window');

const ResourceScreen: React.FC = () => {
    const [data, setData] = useState<ResourceData | null>(null);

    useEffect(() => {
        resourceMonitorService.startMonitoring((newData) => {
            setData(newData);
        });

        return () => {
            resourceMonitorService.stopMonitoring();
        };
    }, []);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const ProgressBar = ({ label, used, total, color }: { label: string, used: number, total: number, color: string }) => {
        const percent = Math.min(Math.round((used / total) * 100), 100);
        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{label}</Text>
                    <Text style={styles.cardValue}>{percent}%</Text>
                </View>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: color }]} />
                </View>
                <Text style={styles.cardSubValue}>{formatBytes(used)} / {formatBytes(total)}</Text>
            </View>
        );
    };

    if (!data) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Đang lấy dữ liệu tài nguyên...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>📊 Resource Monitor</Text>

            {/* RAM */}
            <ProgressBar
                label="RAM Usage"
                used={data.ramUsed}
                total={data.ramTotal}
                color="#4285F4"
            />

            {/* ROM */}
            <ProgressBar
                label="Storage (ROM)"
                used={data.romTotal - data.romAvailable}
                total={data.romTotal}
                color="#34A853"
            />

            {/* CPU */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>CPU Usage</Text>
                    <Text style={[styles.cardValue, { color: '#EA4335' }]}>{data.cpuUsage.toFixed(1)}%</Text>
                </View>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${data.cpuUsage}%`, backgroundColor: '#EA4335' }]} />
                </View>
            </View>

            {/* Network */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Network Speed</Text>
                <View style={styles.networkRow}>
                    <View style={styles.networkItem}>
                        <Text style={styles.networkLabel}>⬇️ Download</Text>
                        <Text style={styles.networkValue}>{formatBytes(data.downloadSpeed)}/s</Text>
                    </View>
                    <View style={styles.networkItem}>
                        <Text style={styles.networkLabel}>⬆️ Upload</Text>
                        <Text style={styles.networkValue}>{formatBytes(data.uploadSpeed)}/s</Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Cập nhật mỗi 1 giây</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
    header: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#666' },
    cardValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    cardSubValue: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },
    progressContainer: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 4 },
    networkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    networkItem: { flex: 1 },
    networkLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
    networkValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    footer: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
    footerText: { fontSize: 12, color: '#999', fontStyle: 'italic' },
});

export default ResourceScreen;
