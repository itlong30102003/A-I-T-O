import { NativeModules, DeviceEventEmitter } from 'react-native';

const { ResourceMonitor } = NativeModules;

export interface ResourceData {
    ramTotal: number;
    ramUsed: number;
    ramAvailable: number;
    romTotal: number;
    romAvailable: number;
    cpuUsage: number;
    downloadSpeed: number; // Bytes per second
    uploadSpeed: number;   // Bytes per second
}

class ResourceMonitorService {
    private intervalId: any = null;
    private updateInterval: number = 1000; // 1 second

    startMonitoring(onUpdate?: (data: ResourceData) => void) {
        if (this.intervalId) return;

        this.intervalId = setInterval(async () => {
            try {
                const data: ResourceData = await ResourceMonitor.getResourceUsage();
                if (onUpdate) {
                    onUpdate(data);
                }
                DeviceEventEmitter.emit('onResourceUpdate', data);
            } catch (error) {
                console.error('Failed to get resource usage:', error);
            }
        }, this.updateInterval);
    }

    stopMonitoring() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    setUpdateInterval(ms: number) {
        this.updateInterval = ms;
        if (this.intervalId) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }
}

export const resourceMonitorService = new ResourceMonitorService();
