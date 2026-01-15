---
description: Async Pipeline Flow for Capture + OCR + Translate + Overlay
---

# Realtime Translation Pipeline

## Overview

The realtime translation pipeline processes screen captures through OCR detection, translation, and overlay display. The pipeline uses an **async, non-blocking architecture** to prevent app overload.

## Architecture

```
┌─────────────┐     ┌───────────┐     ┌──────────────┐     ┌──────────┐
│   Capture   │────▶│    OCR    │────▶│  Translation │────▶│  Overlay │
│   Service   │     │  Worker   │     │    Worker    │     │  Display │
└─────────────┘     └───────────┘     └──────────────┘     └──────────┘
      │                   │                  │                   │
      │    Debounce      │    Latest-       │    Latest-        │
      │    (150ms)       │    wins          │    wins           │
      │                   │    strategy     │    strategy       │
      ▼                   ▼                  ▼                   ▼
   Frame 1 ───────────▶ OCR 1 ──────────▶ Trans 1 ──────────▶ Draw 1
   Frame 2 (dropped)     │                  │
   Frame 3 ───────────▶ OCR 3 ──────────▶ Trans 3 ──────────▶ Draw 3
```

## Key Features

### 1. Non-blocking Processing
Each stage runs independently. A slow translation won't block new OCR tasks.

### 2. Latest-wins Strategy
If a newer frame is captured while an older one is still processing, the older result is discarded. This ensures the overlay always shows the most recent content.

### 3. Debouncing (150ms default)
Prevents rapid-fire processing when content changes quickly (e.g., scrolling).

### 4. Queue Management
- **maxPendingOCR**: Maximum OCR tasks before dropping oldest (default: 2)
- **maxPendingTranslation**: Maximum translation tasks before dropping oldest (default: 2)

### 5. Graceful Error Handling
- Translation errors fall back to showing original text
- Errors don't crash the pipeline

## Files Involved

| File | Description |
|------|-------------|
| `ScreenCaptureService.ts` | Captures frames from selected app |
| `TextDetectionService.ts` | ML Kit OCR text detection |
| `TranslationManager.ts` | Translation orchestration |
| `MLKitTranslationService.ts` | On-device ML Kit translation |
| `OverlayService.ts` | Display overlay on screen |
| `RealtimePipelineService.ts` | **NEW** - Async pipeline coordinator |

## Usage

### Starting the Pipeline

```typescript
import { realtimePipelineService } from './services/RealtimePipelineService';

realtimePipelineService.start({
    script: 'latin',  // or 'chinese' for CJK
    sourceLanguage: 'en',
    targetLanguage: 'vi',
    debounceMs: 150,
    maxPendingOCR: 2,
    maxPendingTranslation: 2,
});
```

### Stopping the Pipeline

```typescript
realtimePipelineService.stop();
```

### Checking Status

```typescript
const status = realtimePipelineService.getStatus();
console.log(status);
// {
//   status: 'running',
//   pendingOCR: 1,
//   pendingTranslation: 0,
//   stats: {
//     framesReceived: 100,
//     framesDropped: 5,
//     ocrCompleted: 95,
//     translationsCompleted: 90,
//     overlayUpdates: 88,
//     errors: 2
//   }
// }
```

## Performance Tuning

| Parameter | Lower Value | Higher Value |
|-----------|-------------|--------------|
| `debounceMs` | More responsive, higher CPU | Smoother, may miss rapid changes |
| `maxPendingOCR` | Less memory, more drops | More buffering, higher latency |
| `maxPendingTranslation` | Drop stale translations quickly | Buffer translations longer |
| `intervalMs` (capture) | More updates, higher battery | Less updates, lower battery |

## Recommended Settings

### High Performance Device (flagship phones)
```typescript
{
    debounceMs: 100,
    maxPendingOCR: 3,
    maxPendingTranslation: 3,
}
```

### Low Power Mode
```typescript
{
    debounceMs: 300,
    maxPendingOCR: 1,
    maxPendingTranslation: 1,
}
```

## Debugging

Check logs for pipeline status:
```
RealtimePipeline: Starting pipeline {...}
RealtimePipeline: OCR task cancelled mid-process
RealtimePipeline: Dropped old translation task (queue full)
RealtimePipeline: Stats {framesReceived: 100, ...}
```
