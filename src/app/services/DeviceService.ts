import { NativeModules } from 'react-native';

const { DeviceModule } = NativeModules;

class DeviceService {
    /**
     * Get total device RAM in GB
     */
    async getTotalRam(): Promise<number> {
        try {
            if (!DeviceModule) return 4; // Default to 4GB if module missing (safe side)
            return await DeviceModule.getTotalRam();
        } catch (error) {
            console.error('DeviceService.getTotalRam error:', error);
            return 4; // Default value
        }
    }
}

export default new DeviceService();
