package edu.srcc.timetablewidget.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import edu.srcc.timetablewidget.model.WidgetProfile
import org.json.JSONObject
import java.net.URLDecoder

class WidgetProfileRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getProfile(widgetId: Int? = null): WidgetProfile {
        val key = if (widgetId != null && widgetId != 0) "profile_$widgetId" else KEY_DEFAULT_PROFILE
        val raw = prefs.getString(key, null) ?: prefs.getString(KEY_DEFAULT_PROFILE, null)
        if (raw != null) {
            try {
                val json = JSONObject(raw)
                return WidgetProfile(
                    course = json.optString("course", "B.Com (Hons)"),
                    sem = json.optString("sem", "Sem I"),
                    sec = json.optString("sec", "Sec A"),
                    batch = json.optString("batch", "ALL")
                )
            } catch (_: Exception) {}
        }
        return WidgetProfile()
    }

    fun saveProfile(profile: WidgetProfile, widgetId: Int? = null) {
        val json = JSONObject().apply {
            put("course", profile.course)
            put("sem", profile.sem)
            put("sec", profile.sec)
            put("batch", profile.batch)
        }
        prefs.edit().apply {
            putString(KEY_DEFAULT_PROFILE, json.toString())
            if (widgetId != null && widgetId != 0) {
                putString("profile_$widgetId", json.toString())
            }
            apply()
        }
    }

    fun parseFromImportString(input: String): WidgetProfile? {
        val trimmed = input.trim()
        val base64Payload = when {
            trimmed.contains("profile=") -> {
                val param = trimmed.substringAfter("profile=").substringBefore("&")
                try { URLDecoder.decode(param, "UTF-8") } catch (_: Exception) { param }
            }
            else -> trimmed
        }

        return try {
            val decodedBytes = Base64.decode(base64Payload, Base64.DEFAULT or Base64.URL_SAFE)
            val jsonStr = String(decodedBytes, Charsets.UTF_8)
            val json = JSONObject(jsonStr)
            WidgetProfile(
                course = json.optString("course", "B.Com (Hons)"),
                sem = json.optString("sem", "Sem I"),
                sec = json.optString("sec", "Sec A"),
                batch = json.optString("batch", "ALL")
            )
        } catch (_: Exception) {
            // Fallback direct JSON string
            try {
                val json = JSONObject(trimmed)
                WidgetProfile(
                    course = json.optString("course", "B.Com (Hons)"),
                    sem = json.optString("sem", "Sem I"),
                    sec = json.optString("sec", "Sec A"),
                    batch = json.optString("batch", "ALL")
                )
            } catch (_: Exception) {
                null
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "srcc_timetable_widget_prefs"
        private const val KEY_DEFAULT_PROFILE = "default_widget_profile"
    }
}
