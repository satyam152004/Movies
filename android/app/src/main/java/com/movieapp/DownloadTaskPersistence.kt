package com.movieapp

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap

object DownloadTaskPersistence {
    private const val TAG = "DownloadTaskPersistence"
    private const val FILE_NAME = "active_tasks_state.json"
    private const val TMP_FILE_NAME = "active_tasks_state.json.tmp"

    fun saveTasks(context: Context, tasks: ConcurrentHashMap<String, DownloadModule.DownloadTask>) {
        synchronized(this) {
            val jsonFile = File(context.filesDir, FILE_NAME)
            val tmpFile = File(context.filesDir, TMP_FILE_NAME)

            try {
                val jsonArray = JSONArray()
                for (task in tasks.values) {
                    val jsonObj = JSONObject().apply {
                        put("id", task.id)
                        put("url", task.url)
                        put("title", task.title)
                        put("filename", task.filename)
                        put("destinationPath", task.destinationFile.absolutePath)
                        put("temporaryPath", task.temporaryFile.absolutePath)
                        put("bytesDownloaded", task.bytesDownloaded)
                        put("bytesTotal", task.bytesTotal)
                        put("status", task.status)
                        put("reason", task.reason)
                        put("retryCount", task.retryCount)
                        put("lastUpdated", task.lastUpdated)
                        put("addedAt", task.addedAt)
                    }
                    jsonArray.put(jsonObj)
                }

                val jsonString = jsonArray.toString()
                
                // Write to temp file first
                FileOutputStream(tmpFile).use { fos ->
                    fos.write(jsonString.toByteArray())
                    fos.flush()
                    // Force synchronization to disk
                    fos.channel.force(true)
                }

                // Atomic rename
                if (tmpFile.exists()) {
                    if (jsonFile.exists()) {
                        jsonFile.delete()
                    }
                    if (!tmpFile.renameTo(jsonFile)) {
                        Log.e(TAG, "Failed to rename temp file to active tasks file")
                    }
                }
                Unit
            } catch (e: Exception) {
                Log.e(TAG, "Error saving tasks atomically: ${e.message}", e)
            }
        }
    }

    fun loadTasks(context: Context): List<DownloadModule.DownloadTask> {
        synchronized(this) {
            val jsonFile = File(context.filesDir, FILE_NAME)
            if (!jsonFile.exists()) {
                return emptyList()
            }

            val list = mutableListOf<DownloadModule.DownloadTask>()
            try {
                val size = jsonFile.length().toInt()
                val bytes = ByteArray(size)
                FileInputStream(jsonFile).use { fis ->
                    fis.read(bytes)
                }
                val jsonString = String(bytes)
                val jsonArray = JSONArray(jsonString)

                for (i in 0 until jsonArray.length()) {
                    val jsonObj = jsonArray.getJSONObject(i)
                    val id = jsonObj.getString("id")
                    val url = jsonObj.getString("url")
                    val title = jsonObj.getString("title")
                    val filename = jsonObj.getString("filename")
                    val destinationFile = File(jsonObj.getString("destinationPath"))
                    val temporaryFile = File(jsonObj.getString("temporaryPath"))
                    
                    val task = DownloadModule.DownloadTask(
                        id = id,
                        url = url,
                        title = title,
                        filename = filename,
                        destinationFile = destinationFile,
                        temporaryFile = temporaryFile
                    ).apply {
                        bytesDownloaded = jsonObj.optLong("bytesDownloaded", 0L)
                        bytesTotal = jsonObj.optLong("bytesTotal", 0L)
                        status = jsonObj.optString("status", "PENDING")
                        reason = jsonObj.optInt("reason", 0)
                        retryCount = jsonObj.optInt("retryCount", 0)
                        lastUpdated = jsonObj.optLong("lastUpdated", System.currentTimeMillis())
                        addedAt = jsonObj.optLong("addedAt", System.currentTimeMillis())
                    }
                    list.add(task)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading tasks: ${e.message}", e)
            }
            return list
        }
    }
}
