package com.movieapp

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Environment
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.io.FileInputStream

class DownloadModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DownloadModule"

    private val downloadsFile: File by lazy {
        File(reactApplicationContext.filesDir, "downloads_state.json")
    }

    @ReactMethod
    fun enqueueDownload(url: String, title: String, filename: String, promise: Promise) {
        try {
            val downloadManager = reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setDescription("Downloading movie...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
                .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "CineApp/$filename")
            
            val id = downloadManager.enqueue(request)
            promise.resolve(id.toString())
        } catch (e: Exception) {
            promise.reject("ENQUEUE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDownloadStatus(downloadIdStr: String, promise: Promise) {
        try {
            val downloadId = downloadIdStr.toLongOrNull()
            if (downloadId == null) {
                promise.reject("INVALID_ID", "Download ID is invalid")
                return
            }

            val downloadManager = reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor: Cursor = downloadManager.query(query)

            if (cursor.moveToFirst()) {
                val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                val bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                val bytesTotalIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                val reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)

                val statusVal = if (statusIdx != -1) cursor.getInt(statusIdx) else DownloadManager.STATUS_FAILED
                val bytesDownloaded = if (bytesDownloadedIdx != -1) cursor.getLong(bytesDownloadedIdx) else 0L
                val bytesTotal = if (bytesTotalIdx != -1) cursor.getLong(bytesTotalIdx) else 0L
                val reasonVal = if (reasonIdx != -1) cursor.getInt(reasonIdx) else 0

                val statusStr = when (statusVal) {
                    DownloadManager.STATUS_PENDING -> "PENDING"
                    DownloadManager.STATUS_RUNNING -> "RUNNING"
                    DownloadManager.STATUS_PAUSED -> "PAUSED"
                    DownloadManager.STATUS_SUCCESSFUL -> "SUCCESSFUL"
                    DownloadManager.STATUS_FAILED -> "FAILED"
                    else -> "UNKNOWN"
                }

                val map = Arguments.createMap().apply {
                    putString("status", statusStr)
                    putDouble("bytesDownloaded", bytesDownloaded.toDouble())
                    putDouble("bytesTotal", bytesTotal.toDouble())
                    putInt("reason", reasonVal)
                }
                cursor.close()
                promise.resolve(map)
            } else {
                cursor.close()
                val map = Arguments.createMap().apply {
                    putString("status", "UNKNOWN")
                    putDouble("bytesDownloaded", 0.0)
                    putDouble("bytesTotal", 0.0)
                    putInt("reason", 0)
                }
                promise.resolve(map)
            }
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelDownload(downloadIdStr: String, promise: Promise) {
        try {
            val downloadId = downloadIdStr.toLongOrNull()
            if (downloadId == null) {
                promise.resolve(false)
                return
            }
            val downloadManager = reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val removedCount = downloadManager.remove(downloadId)
            promise.resolve(removedCount > 0)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun saveDownloadsData(jsonData: String, promise: Promise) {
        try {
            FileOutputStream(downloadsFile).use { fos ->
                fos.write(jsonData.toByteArray())
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun loadDownloadsData(promise: Promise) {
        try {
            if (!downloadsFile.exists()) {
                promise.resolve("")
                return
            }
            val size = downloadsFile.length().toInt()
            val bytes = ByteArray(size)
            FileInputStream(downloadsFile).use { fis ->
                fis.read(bytes)
            }
            promise.resolve(String(bytes))
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", e.message, e)
        }
    }
}
