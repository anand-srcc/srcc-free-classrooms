package edu.srcc.timetablewidget.update

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.appcompat.app.AlertDialog
import edu.srcc.timetablewidget.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object AppUpdateManager {

    private const val UPDATE_CONFIG_URL = "https://srccroomfinder.netlify.app/app_version.json"

    data class UpdateInfo(
        val minSupportedVersionCode: Int,
        val latestVersionCode: Int,
        val latestVersionName: String,
        val forceUpdate: Boolean,
        val updateTitle: String,
        val updateMessage: String,
        val downloadUrl: String
    )

    suspend fun checkUpdate(context: Context): UpdateInfo? = withContext(Dispatchers.IO) {
        val client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()

        try {
            val request = Request.Builder()
                .url("$UPDATE_CONFIG_URL?t=${System.currentTimeMillis()}")
                .header("User-Agent", "SRCC-Timetable-Widget-Android/${BuildConfig.VERSION_NAME}")
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: return@withContext null
                    val json = JSONObject(body)
                    return@withContext UpdateInfo(
                        minSupportedVersionCode = json.optInt("min_supported_version_code", 1),
                        latestVersionCode = json.optInt("version_code", 1),
                        latestVersionName = json.optString("version_name", "1.0.0"),
                        forceUpdate = json.optBoolean("force_update", true),
                        updateTitle = json.optString("update_title", "⚠️ Update Required"),
                        updateMessage = json.optString("update_message", "A new version of SRCC Timetable is required to continue. Please update the app to proceed."),
                        downloadUrl = json.optString("apk_download_url", "https://srccroomfinder.netlify.app/app-debug.apk")
                    )
                }
            }
        } catch (_: Exception) {}
        null
    }

    fun isUpdateRequired(info: UpdateInfo): Boolean {
        val current = BuildConfig.VERSION_CODE
        return current < info.minSupportedVersionCode || (info.forceUpdate && current < info.latestVersionCode)
    }

    fun showForceUpdateDialog(activity: Activity, updateInfo: UpdateInfo) {
        if (activity.isFinishing || activity.isDestroyed) return

        val builder = AlertDialog.Builder(activity)
            .setTitle(updateInfo.updateTitle)
            .setMessage(updateInfo.updateMessage)
            .setCancelable(false)
            .setOnCancelListener {
                activity.finishAffinity()
            }
            .setPositiveButton("Update Now ⬇️") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(updateInfo.downloadUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                activity.startActivity(intent)
                activity.finishAffinity()
            }
            .setNegativeButton("Exit") { _, _ ->
                activity.finishAffinity()
            }

        val dialog = builder.create()
        dialog.setCanceledOnTouchOutside(false)
        dialog.show()
    }
}
