package com.aito.overlay;

import android.app.ActivityManager;
import android.content.Context;
import android.net.TrafficStats;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;

import java.io.RandomAccessFile;
import java.io.IOException;

public class ResourceMonitorModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private long lastRxBytes = 0;
    private long lastTxBytes = 0;
    private long lastTime = 0;

    public ResourceMonitorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.lastRxBytes = TrafficStats.getTotalRxBytes();
        this.lastTxBytes = TrafficStats.getTotalTxBytes();
        this.lastTime = System.currentTimeMillis();
    }

    @Override
    public String getName() {
        return "ResourceMonitor";
    }

    @ReactMethod
    public void getResourceUsage(Promise promise) {
        try {
            WritableMap map = Arguments.createMap();
            
            // RAM
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            ActivityManager activityManager = (ActivityManager) reactContext.getSystemService(Context.ACTIVITY_SERVICE);
            activityManager.getMemoryInfo(mi);
            map.putDouble("ramTotal", mi.totalMem);
            map.putDouble("ramUsed", mi.totalMem - mi.availMem);
            map.putDouble("ramAvailable", mi.availMem);

            // ROM
            StatFs stat = new StatFs(Environment.getDataDirectory().getPath());
            long blockSize = stat.getBlockSizeLong();
            long totalBlocks = stat.getBlockCountLong();
            long availableBlocks = stat.getAvailableBlocksLong();
            map.putDouble("romTotal", totalBlocks * blockSize);
            map.putDouble("romAvailable", availableBlocks * blockSize);

            // CPU (Simplified percent calculation based on /proc/stat if possible, or Os.sysconf)
            map.putDouble("cpuUsage", getCpuUsage());

            // Network
            long currentRxBytes = TrafficStats.getTotalRxBytes();
            long currentTxBytes = TrafficStats.getTotalTxBytes();
            long currentTime = System.currentTimeMillis();
            
            long timeDiff = currentTime - lastTime;
            if (timeDiff > 0) {
                double rxSpeed = (double) (currentRxBytes - lastRxBytes) / (timeDiff / 1000.0);
                double txSpeed = (double) (currentTxBytes - lastTxBytes) / (timeDiff / 1000.0);
                map.putDouble("downloadSpeed", rxSpeed);
                map.putDouble("uploadSpeed", txSpeed);
            } else {
                map.putDouble("downloadSpeed", 0);
                map.putDouble("uploadSpeed", 0);
            }

            lastRxBytes = currentRxBytes;
            lastTxBytes = currentTxBytes;
            lastTime = currentTime;

            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("E_RESOURCE_MONITOR", e.getMessage());
        }
    }

    private double getCpuUsage() {
        try {
            RandomAccessFile reader = new RandomAccessFile("/proc/stat", "r");
            String load = reader.readLine();
            reader.close();

            String[] toks = load.split(" +");
            long idle = Long.parseLong(toks[4]);
            long cpu = Long.parseLong(toks[1]) + Long.parseLong(toks[2]) + Long.parseLong(toks[3])
                    + Long.parseLong(toks[5]) + Long.parseLong(toks[6]) + Long.parseLong(toks[7]);

            // Note: This is a simplified snapshot. For real percentage, we usually need 2 samples.
            // For now, we'll return a raw value or a placeholder if multi-sampling is needed.
            return (double) cpu / (cpu + idle) * 100;
        } catch (IOException ex) {
            ex.printStackTrace();
        }
        return 0;
    }
}
