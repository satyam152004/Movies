package com.movieapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

class DownloadForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    companion object {
        private const val TAG = "DownloadForeground"
        const val CHANNEL_ID = "download_channel"
        const val NOTIFICATION_ID = 1001
        
        const val ACTION_START = "com.movieapp.ACTION_START"
        const val ACTION_STOP = "com.movieapp.ACTION_STOP"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_START) {
            Log.d(TAG, "[SERVICE_START] Foreground service start requested")
            startForegroundServiceCompat()
            acquireWakeLock()
        } else if (action == ACTION_STOP) {
            Log.d(TAG, "[SERVICE_STOP] Foreground service stop requested")
            releaseWakeLock()
            stopForeground(true)
            stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun startForegroundServiceCompat() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Downloading Movies")
            .setContentText("Downloads are running in the background...")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            try {
                val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MovieApp::DownloadWakeLock")
                wakeLock?.acquire()
                Log.d(TAG, "[WAKELOCK_ACQUIRE] WakeLock acquired successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to acquire WakeLock: ${e.message}", e)
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "[WAKELOCK_RELEASE] WakeLock released successfully")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to release WakeLock: ${e.message}", e)
        } finally {
            wakeLock = null
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Downloads Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Used for showing active download status in the background"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.d(TAG, "[SERVICE_STOP] Service onDestroy invoked, cleaning up resources")
        releaseWakeLock()
        super.onDestroy()
    }
}
