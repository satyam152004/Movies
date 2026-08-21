package com.app.movieapp

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.util.Log
import com.facebook.react.bridge.*
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Future

class DownloadModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DownloadModule"

    override fun initialize() {
        super.initialize()
        recoverTasks()
    }

    private val downloadsFile: File by lazy {
        File(reactApplicationContext.filesDir, "downloads_state.json")
    }

    companion object {
        private const val TAG = "DownloadModule"
        val executor = Executors.newFixedThreadPool(4)
        val activeTasks = ConcurrentHashMap<String, DownloadTask>()
    }

    private fun updateServiceState() {
        val context = reactApplicationContext
        val hasActive = activeTasks.values.any { 
            it.status == "RUNNING" || it.status == "PENDING" || it.status == "RETRYING" 
        }
        if (hasActive) {
            val intent = Intent(context, DownloadForegroundService::class.java).apply {
                action = DownloadForegroundService.ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } else {
            val intent = Intent(context, DownloadForegroundService::class.java).apply {
                action = DownloadForegroundService.ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private fun recoverTasks() {
        try {
            val persisted = DownloadTaskPersistence.loadTasks(reactApplicationContext)
            Log.d(TAG, "Loaded ${persisted.size} persisted tasks from disk")
            for (task in persisted) {
                activeTasks[task.id] = task
                if (task.status == "RUNNING" || task.status == "PENDING" || task.status == "RETRYING") {
                    Log.d(TAG, "[DOWNLOAD_RESUME] Recovering and resuming task: ${task.id} (status: ${task.status})")
                    task.isPaused = false
                    task.isCancelled = false
                    task.future = executor.submit {
                        runDownload(task)
                    }
                }
            }
            updateServiceState()
        } catch (e: Exception) {
            Log.e(TAG, "Error recovering tasks: ${e.message}", e)
        }
    }

    class DownloadTask(
        val id: String,
        val url: String,
        val title: String,
        val filename: String,
        val destinationFile: File,
        val temporaryFile: File
    ) {
        @Volatile var bytesDownloaded: Long = 0L
        @Volatile var bytesTotal: Long = 0L
        @Volatile var status: String = "PENDING"
        @Volatile var reason: Int = 0
        @Volatile var retryCount: Int = 0
        @Volatile var lastUpdated: Long = System.currentTimeMillis()
        @Volatile var addedAt: Long = System.currentTimeMillis()
        
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
            val temporaryFile = File(cineAppDir, "$filename.part")

            Log.d(TAG, "[DOWNLOAD_START] Enqueuing new download: $filename (ID: $id)")

            val task = DownloadTask(id, url, title, filename, destinationFile, temporaryFile)
            activeTasks[id] = task
            DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)

            val future = executor.submit {
                runDownload(task)
            }
            task.future = future

            updateServiceState()
            promise.resolve(id)
        } catch (e: Exception) {
            promise.reject("ENQUEUE_ERROR", e.message, e)
        }
    }

    private fun runDownload(task: DownloadTask) {
        val maxRetries = 10
        task.status = "RUNNING"
        DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)

        while (task.retryCount < maxRetries && !task.isPaused && !task.isCancelled) {
            var connection: HttpURLConnection? = null
            var inputStream: InputStream? = null
            var outputStream: RandomAccessFile? = null
            var success = false

            try {
                // authorative check of .part file size on disk
                val existingLength = if (task.temporaryFile.exists()) task.temporaryFile.length() else 0L
                task.bytesDownloaded = existingLength
                task.lastUpdated = System.currentTimeMillis()

                Log.d(TAG, "[RANGE_REQUEST] Task ${task.id} connecting. Local offset = $existingLength bytes")

                val url = URL(task.url)
                connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 30000
                connection.readTimeout = 30000

                var isResume = false
                if (existingLength > 0) {
                    connection.setRequestProperty("Range", "bytes=$existingLength-")
                }

                connection.connect()
                val responseCode = connection.responseCode

                // Fast-fail check on permanent errors
                val isPermanentError = when (responseCode) {
                    400, 401, 403, 404, 405, 410 -> true
                    else -> false
                }
                if (isPermanentError) {
                    Log.e(TAG, "[HTTP_ERROR] Permanent error response: $responseCode for task ${task.id}")
                    task.status = "FAILED"
                    task.reason = responseCode
                    DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)
                    break
                }

                // Handle HTTP 416 (Range Not Satisfiable)
                if (responseCode == HttpURLConnection.HTTP_REQ_TOO_LONG || responseCode == 416) {
                    val contentRange = connection.getHeaderField("Content-Range")
                    var totalFromServer = 0L
                    if (contentRange != null) {
                        val parts = contentRange.split("/")
                        if (parts.size == 2) {
                            totalFromServer = parts[1].trim().toLongOrNull() ?: 0L
                        }
                    }
                    val targetTotal = if (totalFromServer > 0) totalFromServer else task.bytesTotal
                    
                    if (targetTotal > 0 && existingLength >= targetTotal) {
                        Log.d(TAG, "Reconciled range. Local .part is already complete ($existingLength / $targetTotal bytes)")
                        task.bytesTotal = targetTotal
                        task.bytesDownloaded = targetTotal
                        task.status = "SUCCESSFUL"
                        success = true
                    } else {
                        Log.e(TAG, "Range error 416 but local file is not complete. Truncating and starting over.")
                        task.temporaryFile.delete()
                        task.bytesDownloaded = 0L
                        throw IOException("HTTP 416 Range Not Satisfiable recovery triggered restart")
                    }
                } else {
                    if (responseCode == HttpURLConnection.HTTP_PARTIAL) {
                        isResume = true
                        Log.d(TAG, "[DOWNLOAD_RESUME] Server accepted range request (HTTP 206) for task ${task.id}")
                    } else if (responseCode != HttpURLConnection.HTTP_OK && responseCode != HttpURLConnection.HTTP_CREATED) {
                        throw IOException("Unexpected HTTP response code: $responseCode")
                    }

                    outputStream = RandomAccessFile(task.temporaryFile, "rw")
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
                    } else if (task.bytesTotal == 0L) {
                        task.bytesTotal = 0L
                    }

                    inputStream = BufferedInputStream(connection.inputStream)
                    val buffer = ByteArray(8192)
                    var bytesRead: Int

                    while (true) {
                        if (task.isPaused) {
                            Log.d(TAG, "[DOWNLOAD_PAUSED] Task ${task.id} was paused manually")
                            task.status = "PAUSED"
                            success = true
                            break
                        }
                        if (task.isCancelled) {
                            Log.d(TAG, "[DOWNLOAD_CANCELLED] Task ${task.id} was cancelled manually")
                            task.status = "CANCELLED"
                            success = true
                            break
                        }
                        bytesRead = inputStream.read(buffer)
                        if (bytesRead == -1) {
                            Log.d(TAG, "[DOWNLOAD_COMPLETE] Stream EOF reached for task ${task.id}")
                            task.status = "SUCCESSFUL"
                            success = true
                            break
                        }
                        outputStream.write(buffer, 0, bytesRead)
                        task.bytesDownloaded += bytesRead
                        task.lastUpdated = System.currentTimeMillis()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "[NETWORK_ERROR] Task ${task.id} encountered exception: ${e.message}", e)
                
                // Exponential backoff logic: 2s -> 4s -> 8s -> 16s -> 30s
                val delays = listOf(2000L, 4000L, 8000L, 16000L, 30000L)
                val delay = if (task.retryCount < delays.size) delays[task.retryCount] else 30000L
                task.retryCount++

                if (task.retryCount >= maxRetries) {
                    if (!task.isPaused && !task.isCancelled) {
                        Log.e(TAG, "[DOWNLOAD_FAILED] Task ${task.id} failed after maximum retries")
                        task.status = "FAILED"
                        task.reason = 1
                    }
                } else {
                    Log.d(TAG, "[RETRY] Retrying task ${task.id} in ${delay / 1000} seconds...")
                    task.status = "RETRYING"
                    DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)
                    try {
                        Thread.sleep(delay)
                    } catch (ie: InterruptedException) {
                        break
                    }
                }
            } finally {
                try { inputStream?.close() } catch (e: Exception) {}
                try { outputStream?.close() } catch (e: Exception) {}
                try { connection?.disconnect() } catch (e: Exception) {}
            }

            if (success) {
                break
            }
        }

        // Finalize completed download: rename .part to final target file
        if (task.status == "SUCCESSFUL") {
            try {
                if (task.temporaryFile.exists()) {
                    if (task.destinationFile.exists()) {
                        task.destinationFile.delete()
                    }
                    if (!task.temporaryFile.renameTo(task.destinationFile)) {
                        // Rename failure workaround (copy and delete)
                        task.temporaryFile.inputStream().use { input ->
                            task.destinationFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        task.temporaryFile.delete()
                    }
                    Log.d(TAG, "File finalized successfully: ${task.destinationFile.absolutePath}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error renaming completed .part file: ${e.message}", e)
                task.status = "FAILED"
                task.reason = 2
            }
        }

        DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)
        updateServiceState()
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
                DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)
                updateServiceState()
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
                DownloadTaskPersistence.saveTasks(reactApplicationContext, activeTasks)
            }
            task?.temporaryFile?.let { file ->
                if (file.exists()) {
                    file.delete()
                }
            }
            task?.destinationFile?.let { file ->
                if (file.exists()) {
                    file.delete()
                }
            }
            updateServiceState()
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

    @ReactMethod
    fun playVideo(filename: String, promise: Promise) {
        try {
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val cineAppDir = File(downloadsDir, "CineApp")
            val file = File(cineAppDir, filename)
            
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: ${file.absolutePath}")
                return
            }

            // Disable strict mode file URI exposure check
            try {
                val m = android.os.StrictMode::class.java.getMethod("disableDeathOnFileUriExposure")
                m.invoke(null)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to disable StrictMode file exposure check: ${e.message}")
            }

            val uri = android.net.Uri.fromFile(file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/*")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }
}
