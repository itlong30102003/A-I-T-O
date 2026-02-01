# A-I-T-O MVP Implementation Plan

Triển khai bản MVP cho ứng dụng OCR Translator với 4 chức năng core: Screen Capture → Text Detection → OCR → Overlay Display.

## Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native (JS/TS)                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ScreenCaptureHook│  │ TextDetection   │  │ OverlayHook │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
│           │                    │                   │         │
└───────────┼────────────────────┼───────────────────┼─────────┘
            │    Native Bridge   │                   │
┌───────────▼────────────────────▼───────────────────▼─────────┐
│                      Android Native (Java)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ScreenCapture    │  │ TextDetection   │  │ Overlay     │  │
│  │    Module       │  │    Module       │  │   Module    │  │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘  │
│           │                    │                   │         │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌──────▼──────┐  │
│  │ScreenCapture    │  │   ML Kit Text   │  │  Overlay    │  │
│  │   Service       │  │   Recognition   │  │   Service   │  │
│  │(ForegroundSvc)  │  │                 │  │(WindowMgr)  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Permissions Cần Thiết

### AndroidManifest.xml
```xml
<!-- Screen Capture -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>

<!-- Overlay -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>

<!-- Existing -->
<uses-permission android:name="android.permission.INTERNET"/>
```

---

## Phase 1: Screen Capture Implementation

### 1.1 ScreenCaptureModule.java
**Location:** `android/app/src/main/java/com/aito/screencapture/`

```java
// Pseudo-code structure
public class ScreenCaptureModule extends ReactContextBaseJavaModule {
    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    
    @ReactMethod
    public void requestPermission(Promise promise) {
        // Create screen capture intent
        Intent intent = projectionManager.createScreenCaptureIntent();
        // Start activity for result
        currentActivity.startActivityForResult(intent, REQUEST_CODE);
    }
    
    @ReactMethod
    public void startCapture(ReadableMap options, Promise promise) {
        // Start foreground service
        // Create VirtualDisplay with ImageReader
        // Setup OnImageAvailableListener
    }
    
    @ReactMethod
    public void stopCapture(Promise promise) {
        // Release VirtualDisplay
        // Stop service
    }
}
```

### 1.2 ScreenCaptureService.java
```java
public class ScreenCaptureService extends Service {
    private static final String CHANNEL_ID = "screen_capture_channel";
    
    @Override
    public void onCreate() {
        createNotificationChannel();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Start as foreground with notification
        startForeground(1, createNotification());
        
        // Get MediaProjection from intent
        // Setup VirtualDisplay
        return START_STICKY;
    }
    
    private void captureFrame() {
        // Get image from ImageReader
        // Convert to Bitmap
        // Send to TextDetectionModule or emit to JS
    }
}
```

---

## Phase 2: Text Detection Implementation

### 2.1 Dependencies (build.gradle)
```gradle
dependencies {
    // ML Kit Text Recognition (On-device)
    implementation 'com.google.mlkit:text-recognition:16.0.0'
    
    // For Vietnamese/Latin scripts
    implementation 'com.google.mlkit:text-recognition-latin:16.0.0'
}
```

### 2.2 TextDetectionModule.java
```java
public class TextDetectionModule extends ReactContextBaseJavaModule {
    private TextRecognizer recognizer;
    
    public TextDetectionModule(ReactApplicationContext context) {
        super(context);
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
    }
    
    @ReactMethod
    public void detectText(String imagePath, Promise promise) {
        // Load bitmap from path
        Bitmap bitmap = BitmapFactory.decodeFile(imagePath);
        InputImage image = InputImage.fromBitmap(bitmap, 0);
        
        recognizer.process(image)
            .addOnSuccessListener(text -> {
                WritableArray blocks = Arguments.createArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    WritableMap blockData = Arguments.createMap();
                    blockData.putString("text", block.getText());
                    
                    Rect bounds = block.getBoundingBox();
                    WritableMap bbox = Arguments.createMap();
                    bbox.putInt("x", bounds.left);
                    bbox.putInt("y", bounds.top);
                    bbox.putInt("width", bounds.width());
                    bbox.putInt("height", bounds.height());
                    blockData.putMap("boundingBox", bbox);
                    
                    blocks.pushMap(blockData);
                }
                promise.resolve(blocks);
            })
            .addOnFailureListener(e -> promise.reject("ERROR", e.getMessage()));
    }
}
```

---

## Phase 3: Overlay Display Implementation

### 3.1 OverlayModule.java
```java
public class OverlayModule extends ReactContextBaseJavaModule {
    private WindowManager windowManager;
    private View overlayView;
    
    @ReactMethod
    public void checkPermission(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
        } else {
            promise.resolve(true);
        }
    }
    
    @ReactMethod
    public void requestPermission() {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getReactApplicationContext().getPackageName())
        );
        getCurrentActivity().startActivity(intent);
    }
    
    @ReactMethod
    public void showOverlay(String text, int x, int y, int width, int height) {
        // Create TextView
        TextView textView = new TextView(getReactApplicationContext());
        textView.setText(text);
        textView.setBackgroundColor(Color.parseColor("#CC000000"));
        textView.setTextColor(Color.WHITE);
        
        // Window params
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            width, height, x, y,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        
        windowManager.addView(textView, params);
        overlayView = textView;
    }
    
    @ReactMethod
    public void hideOverlay() {
        if (overlayView != null) {
            windowManager.removeView(overlayView);
            overlayView = null;
        }
    }
}
```

---

## Phase 4: React Native Integration

### 4.1 Native Module Bridge (NativeModules.ts)
```typescript
import { NativeModules, NativeEventEmitter } from 'react-native';

const { ScreenCaptureModule, TextDetectionModule, OverlayModule } = NativeModules;

export const screenCapture = {
  requestPermission: () => ScreenCaptureModule.requestPermission(),
  startCapture: (options: CaptureOptions) => ScreenCaptureModule.startCapture(options),
  stopCapture: () => ScreenCaptureModule.stopCapture(),
};

export const textDetection = {
  detectText: (imagePath: string) => TextDetectionModule.detectText(imagePath),
};

export const overlay = {
  checkPermission: () => OverlayModule.checkPermission(),
  requestPermission: () => OverlayModule.requestPermission(),
  showOverlay: (text: string, x: number, y: number, w: number, h: number) => 
    OverlayModule.showOverlay(text, x, y, w, h),
  hideOverlay: () => OverlayModule.hideOverlay(),
};
```

### 4.2 Main Flow Hook (useOCRCapture.ts)
```typescript
export function useOCRCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  
  const startOCR = async () => {
    // 1. Check permissions
    const hasOverlay = await overlay.checkPermission();
    if (!hasOverlay) {
      overlay.requestPermission();
      return;
    }
    
    // 2. Request screen capture
    await screenCapture.requestPermission();
    
    // 3. Start capture with callback
    await screenCapture.startCapture({
      onFrame: async (imagePath: string) => {
        // 4. Detect text
        const blocks = await textDetection.detectText(imagePath);
        
        // 5. Show overlay for each block
        for (const block of blocks) {
          overlay.showOverlay(
            block.text,
            block.boundingBox.x,
            block.boundingBox.y,
            block.boundingBox.width,
            block.boundingBox.height
          );
        }
      }
    });
    
    setIsCapturing(true);
  };
  
  return { isCapturing, startOCR, stopOCR };
}
```

---

## Data Flow

```
User taps "Start" 
    ↓
Request MediaProjection permission
    ↓ (granted)
Start ScreenCaptureService (Foreground)
    ↓
VirtualDisplay + ImageReader captures frames
    ↓ (every ~500ms)
Frame saved as temp bitmap
    ↓
TextDetectionModule.detectText(bitmap)
    ↓
ML Kit returns: [{text, boundingBox}, ...]
    ↓
OverlayModule.showOverlay(text, x, y, w, h)
    ↓
User sees translated text on screen
```

---

## Files to Create

| File | Type | Description |
|------|------|-------------|
| `ScreenCaptureModule.java` | Native | Bridge module for screen capture |
| `ScreenCaptureService.java` | Native | Foreground service for MediaProjection |
| `ScreenCapturePackage.java` | Native | Package to register modules |
| `TextDetectionModule.java` | Native | ML Kit text recognition wrapper |
| `TextDetectionPackage.java` | Native | Package to register text module |
| `OverlayModule.java` | Native | Floating overlay management |
| `OverlayService.java` | Native | Service for overlay display |
| `OverlayPackage.java` | Native | Package to register overlay module |
| `NativeModules.ts` | JS | TypeScript bindings |
| `useOCRCapture.ts` | JS | Custom hook for main flow |
| `ScreenCaptureScreen.tsx` | JS | UI component |

---

## Testing Checklist

- [ ] Install on physical device (not emulator)
- [ ] Grant MediaProjection permission
- [ ] Grant SYSTEM_ALERT_WINDOW permission
- [ ] Start capture → open browser with text
- [ ] Verify bounding boxes appear correctly
- [ ] Verify overlay shows detected text
- [ ] Stop capture → verify cleanup
