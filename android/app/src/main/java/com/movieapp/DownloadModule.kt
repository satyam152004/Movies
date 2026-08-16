package com.movieapp

import android.content.Context
import android.os.Environment
import com.facebook.react.bridge.*
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Future

class DownloadModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DownloadModule"

    private val downloadsFile: File by lazy {
        File(reactApplicationContext.filesDir, "downloads_state.json")
    }

    private val executor = Executors.newFixedThreadPool(4)
    private val activeTasks = ConcurrentHashMap<String, DownloadTask>()

    class DownloadTask(
        val id: String,
        val url: String,
        val title: String,
        val filename: String,
        val destinationFile: File
    ) {
        @Volatile var bytesDownloaded: Long = 0L
        @Volatile var bytesTotal: Long = 0L
        @Volatile var status: String = "PENDING"
        @Volatile var reason: Int = 0
        
        var future: Future<*>? = null
        @Volatile var isPaused: Boolean = false
        @Volatile var isCancelled: Boolean = false
    }

    @ReactMethod
    fun enqueueDownload(id: String, url: String, title: String, filename: String, promise: Promise) {
        try {
            activeTasks[id]?.let { existingTask ->
                existingTask.isCancelled = true
                existingTask.future?.cancel(true)
                activeTasks.remove(id)
            }

            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val cineAppDir = File(downloadsDir, "CineApp")
            if (!cineAppDir.exists()) {
                cineAppDir.mkdirs()
            }
            val destinationFile = File(cineAppDir, filename)

            val task = DownloadTask(id, url, title, filename, destinationFile)
            activeTasks[id] = task

            val future = executor.submit {
                runDownload(task)
            }
            task.future = future

            promise.resolve(id)
        } catch (e: Exception) {
            promise.reject("ENQUEUE_ERROR", e.message, e)
        }
    }

    private fun runDownload(task: DownloadTask) {
        var connection: HttpURLConnection? = null
        var inputStream: InputStream? = null
        var outputStream: RandomAccessFile? = null
        
        try {
            task.status = "RUNNING"
            val existingLength = if (task.destinationFile.exists()) task.destinationFile.length() else 0L
            task.bytesDownloaded = existingLength

            val url = URL(task.url)
            connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 15000

            var isResume = false
            if (existingLength > 0) {
                connection.setRequestProperty("Range", "bytes=$existingLength-")
            }

            connection.connect()
            val responseCode = connection.responseCode

            if (responseCode == HttpURLConnection.HTTP_PARTIAL) {
                isResume = true
            }

            outputStream = RandomAccessFile(task.destinationFile, "rw")
            if (isResume) {
                outputStream.seek(existingLength)
                task.bytesDownloaded = existingLength
            } else {
                outputStream.setLength(0)
                task.bytesDownloaded = 0L
            }

            val contentLength = connection.contentLengthLong
            if (contentLength != -1L) {
                task.bytesTotal = if (isResume) existingLength + contentLength else contentLength
            } else {
                task.bytesTotal = 0L
            }

            inputStream = BufferedInputStream(connection.inputStream)
            val buffer = ByteArray(8192)
            var bytesRead: Int

            while (true) {
                if (task.isPaused) {
                    task.status = "PAUSED"
                    break
                }
                if (task.isCancelled) {
                    task.status = "CANCELLED"
                    break
                }
                bytesRead = inputStream.read(buffer)
                if (bytesRead == -1) {
                    task.status = "SUCCESSFUL"
                    break
                }
                outputStream.write(buffer, 0, bytesRead)
                task.bytesDownloaded += bytesRead
            }
        } catch (e: Exception) {
            if (!task.isPaused && !task.isCancelled) {
                task.status = "FAILED"
                task.reason = 1
            }
        } finally {
            try { inputStream?.close() } catch (e: Exception) {}
            try { outputStream?.close() } catch (e: Exception) {}
            try { connection?.disconnect() } catch (e: Exception) {}
        }
    }

    @ReactMethod
    fun getDownloadStatus(id: String, promise: Promise) {
        try {
            val task = activeTasks[id]
            if (task != null) {
                val map = Arguments.createMap().apply {
                    putString("status", task.status)
                    putDouble("bytesDownloaded", task.bytesDownloaded.toDouble())
                    putDouble("bytesTotal", task.bytesTotal.toDouble())
                    putInt("reason", task.reason)
                }
                promise.resolve(map)
            } else {
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
    fun pauseDownload(id: String, promise: Promise) {
        try {
            val task = activeTasks[id]
            if (task != null) {
                task.isPaused = true
                task.future?.cancel(true)
                task.status = "PAUSED"
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelDownload(id: String, promise: Promise) {
        try {
            val task = activeTasks[id]
            if (task != null) {
                task.isCancelled = true
                task.future?.cancel(true)
                task.status = "CANCELLED"
                activeTasks.remove(id)
            }
            task?.destinationFile?.let { file ->
                if (file.exists()) {
                    file.delete()
                }
            }
            promise.resolve(true)
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
