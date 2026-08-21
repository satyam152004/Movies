package com.app.movieapp

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream

class BackupModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var exportPromise: Promise? = null
    private var exportData: String? = null
    private var importPromise: Promise? = null

    companion object {
        private const val REQUEST_CODE_CREATE_FILE = 20261
        private const val REQUEST_CODE_OPEN_FILE = 20262
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "BackupModule"
    }

    @ReactMethod
    fun exportBackup(backupData: String, promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_NULL", "Activity doesn't exist")
            return
        }

        exportPromise = promise
        exportData = backupData

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "MovieApp_Backup.json")
        }

        try {
            currentActivity.startActivityForResult(intent, REQUEST_CODE_CREATE_FILE)
        } catch (e: Exception) {
            promise.reject("E_FAILED_TO_START_PICKER", e.message)
            exportPromise = null
            exportData = null
        }
    }

    @ReactMethod
    fun importBackup(promise: Promise) {
        val currentActivity = currentActivity
        if (currentActivity == null) {
            promise.reject("E_ACTIVITY_NULL", "Activity doesn't exist")
            return
        }

        importPromise = promise

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*" // Use generic to ensure JSON files can be selected
            val mimeTypes = arrayOf("application/json")
            putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
        }

        try {
            currentActivity.startActivityForResult(intent, REQUEST_CODE_OPEN_FILE)
        } catch (e: Exception) {
            promise.reject("E_FAILED_TO_START_PICKER", e.message)
            importPromise = null
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_CREATE_FILE) {
            val promise = exportPromise
            val backupText = exportData
            exportPromise = null
            exportData = null

            if (resultCode != Activity.RESULT_OK || data == null) {
                promise?.reject("E_CANCELLED", "User cancelled file creation")
                return
            }

            val uri: Uri? = data.data
            if (uri == null) {
                promise?.reject("E_INVALID_URI", "No URI returned")
                return
            }

            try {
                reactContext.contentResolver.openOutputStream(uri)?.use { outputStream ->
                    outputStream.write(backupText?.toByteArray() ?: ByteArray(0))
                    outputStream.flush()
                }
                promise?.resolve(true)
            } catch (e: Exception) {
                promise?.reject("E_WRITE_ERROR", e.message)
            }
        } else if (requestCode == REQUEST_CODE_OPEN_FILE) {
            val promise = importPromise
            importPromise = null

            if (resultCode != Activity.RESULT_OK || data == null) {
                promise?.reject("E_CANCELLED", "User cancelled file selection")
                return
            }

            val uri: Uri? = data.data
            if (uri == null) {
                promise?.reject("E_INVALID_URI", "No URI returned")
                return
            }

            try {
                reactContext.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val reader = BufferedReader(InputStreamReader(inputStream))
                    val stringBuilder = StringBuilder()
                    var line: String? = reader.readLine()
                    while (line != null) {
                        stringBuilder.append(line)
                        line = reader.readLine()
                    }
                    promise?.resolve(stringBuilder.toString())
                }
            } catch (e: Exception) {
                promise?.reject("E_READ_ERROR", e.message)
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        // No-op
    }
}
