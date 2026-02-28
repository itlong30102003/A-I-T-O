import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { screenCaptureService } from '../../../services/ScreenCaptureService';
import { overlayService } from '../../../services/OverlayService';

/**
 * Hook to manage screen capture state.
 * Extracted from MainScreen for reusability and clean separation.
 */
export const useCaptureState = () => {
    const [captureState, setCaptureState] = useState(screenCaptureService.state);
    const [duration, setDuration] = useState('00:00');

    useEffect(() => {
        screenCaptureService.initialize();

        const unsubscribe = screenCaptureService.onStateChange((state) => {
            console.log('useCaptureState: Capture State Update ->', state.isCapturing ? 'CAPTURING' : 'STOPPED');
            setCaptureState(state);
        });

        return () => {
            unsubscribe();
            screenCaptureService.cleanup();
        };
    }, []);

    // Duration timer effect
    useEffect(() => {
        if (!captureState.isCapturing) return;

        const interval = setInterval(() => {
            setDuration(screenCaptureService.formatDuration());
        }, 1000);

        return () => clearInterval(interval);
    }, [captureState.isCapturing]);

    // Select app for capture (Android 14+)
    const handleSelectApp = useCallback(async () => {
        try {
            const granted = await screenCaptureService.selectApp();
            if (!granted) {
                console.warn('Quyền bị từ chối: Bạn cần cấp quyền để capture màn hình.');
                return false;
            }
            await screenCaptureService.startCapture({ intervalMs: 1000 });
            return true;
        } catch (error: any) {
            const isPermissionDenied = error.message?.includes('PERMISSION_DENIED');
            console.error('Lỗi Select App:', isPermissionDenied ? 'Bạn đã hủy việc chọn app.' : error.message);
            return false;
        }
    }, []);

    // Select entire screen (for Selection mode)
    const handleSelectEntireScreen = useCallback(async () => {
        const hasOverlayPermission = await overlayService.checkPermission();
        if (!hasOverlayPermission) {
            Alert.alert(
                'Quyền Overlay',
                'Ứng dụng cần quyền "Hiển thị trên các ứng dụng khác" để hiển thị bản dịch.',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Cấp quyền', onPress: () => overlayService.requestPermission() }
                ]
            );
            return false;
        }

        try {
            console.log('📺 Starting Selection Mode with Entire Screen...');
            const granted = await screenCaptureService.selectEntireScreen();
            if (!granted) {
                console.warn('Quyền bị từ chối: Bạn cần cấp quyền để capture màn hình.');
                return false;
            }
            await screenCaptureService.startCapture({ intervalMs: 1000 });
            console.log('✅ Selection Mode started with entire screen capture');
            return true;
        } catch (error: any) {
            const isPermissionDenied = error.message?.includes('PERMISSION_DENIED');
            console.error('Lỗi Select Entire Screen:', isPermissionDenied ? 'Bạn đã hủy việc cấp quyền.' : error.message);
            return false;
        }
    }, []);

    // Start capture
    const handleStartCapture = useCallback(async () => {
        if (!captureState.permissionGranted) {
            console.warn('Chưa chọn nguồn: Vui lòng chọn app trước khi bắt đầu!');
            return false;
        }

        const hasOverlayPermission = await overlayService.checkPermission();
        if (!hasOverlayPermission) {
            Alert.alert(
                'Quyền Overlay',
                'Ứng dụng cần quyền "Hiển thị trên các ứng dụng khác" để hiển thị bản dịch.',
                [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Cấp quyền', onPress: () => overlayService.requestPermission() }
                ]
            );
            return false;
        }

        try {
            await screenCaptureService.startCapture({ intervalMs: 1000 });
            return true;
        } catch (error: any) {
            console.error('Lỗi khởi động capture:', error.message || 'Không thể bắt đầu capture.');
            return false;
        }
    }, [captureState.permissionGranted]);

    // Stop capture
    const handleStopCapture = useCallback(async () => {
        try {
            await screenCaptureService.stopCapture();
            return true;
        } catch (error: any) {
            console.error('Lỗi dừng capture:', error.message || 'Không thể dừng capture');
            return false;
        }
    }, []);

    // Change app
    const handleChangeApp = useCallback(() => {
        if (!screenCaptureService.supportsAppSelection) {
            console.warn('Không hỗ trợ: Cần Android 14+ để chọn app cụ thể.');
            return;
        }
        Alert.alert(
            '🔄 Đổi App Capture',
            captureState.isCapturing
                ? 'Capture hiện tại sẽ dừng và bạn có thể chọn app mới.'
                : 'Bạn có muốn chọn app khác để capture?',
            [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Đổi App', onPress: handleSelectApp }
            ]
        );
    }, [captureState.isCapturing, handleSelectApp]);

    return {
        captureState,
        duration,
        handleSelectApp,
        handleSelectEntireScreen,
        handleStartCapture,
        handleStopCapture,
        handleChangeApp,
    };
};

export default useCaptureState;
