package edu.srcc.timetablewidget.data

import android.content.Context
import edu.srcc.timetablewidget.model.ClassCard
import edu.srcc.timetablewidget.model.DailySchedule
import edu.srcc.timetablewidget.model.LeaveInfo
import edu.srcc.timetablewidget.model.WidgetProfile
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class WidgetFeedRepository(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val cacheFile: File
        get() = File(context.cacheDir, "widget_feed.json")

    private val istZone = TimeZone.getTimeZone("Asia/Kolkata")

    suspend fun getDailySchedule(profile: WidgetProfile, forceRefresh: Boolean = false): DailySchedule {
        if (forceRefresh || !cacheFile.exists() || isCacheStale()) {
            fetchFeedRemote()
        }

        val jsonStr = if (cacheFile.exists()) cacheFile.readText() else null
        return parseSchedule(jsonStr, profile)
    }

    private fun isCacheStale(): Boolean {
        if (!cacheFile.exists()) return true
        val diff = System.currentTimeMillis() - cacheFile.lastModified()
        return diff > 30 * 60 * 1000 // 30 minutes
    }

    private fun fetchFeedRemote() {
        try {
            val request = Request.Builder()
                .url(FEED_URL)
                .header("User-Agent", "SRCC-Timetable-Widget-Android/1.0")
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    if (!body.isNullOrEmpty()) {
                        cacheFile.writeText(body)
                    }
                }
            }
        } catch (_: Exception) {
            // Keep existing cache on network failure
        }
    }

    fun parseSchedule(jsonStr: String?, profile: WidgetProfile, testDate: Date? = null): DailySchedule {
        val cal = Calendar.getInstance(istZone)
        if (testDate != null) cal.time = testDate

        val dayFormat = SimpleDateFormat("EEEE", Locale.ENGLISH).apply { timeZone = istZone }
        val dayName = dayFormat.format(cal.time)

        val dateFormat = SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH).apply { timeZone = istZone }
        val dateText = dateFormat.format(cal.time)

        val isoFormat = SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH).apply { timeZone = istZone }
        val isoDate = isoFormat.format(cal.time)

        if (dayName.equals("Sunday", ignoreCase = true)) {
            return DailySchedule(
                dayName = "Sunday",
                dateText = dateText,
                profile = profile,
                classes = emptyList(),
                leaves = emptyList(),
                isCollegeClosed = true
            )
        }

        if (jsonStr.isNullOrEmpty()) {
            return DailySchedule(
                dayName = dayName,
                dateText = dateText,
                profile = profile,
                classes = emptyList(),
                leaves = emptyList()
            )
        }

        return try {
            val root = JSONObject(jsonStr)

            // Leaves
            val leavesList = mutableListOf<LeaveInfo>()
            val leavesArr = root.optJSONArray("leaves")
            if (leavesArr != null) {
                for (i in 0 until leavesArr.length()) {
                    val item = leavesArr.getJSONObject(i)
                    val sDate = item.optString("start_date")
                    val eDate = item.optString("end_date", sDate)
                    val coversToday = (isoDate >= sDate && isoDate <= eDate)

                    if (coversToday) {
                        leavesList.add(
                            LeaveInfo(
                                teacherId = item.optString("teacher_id"),
                                teacherName = item.optString("teacher_name"),
                                teacherCode = item.optString("teacher_code"),
                                department = item.optString("department"),
                                startDate = sDate,
                                endDate = eDate,
                                isHalfDay = item.optBoolean("half_day", false)
                            )
                        )
                    }
                }
            }

            // Schedule by group
            val normKey = profile.toNormalizedKey()
            val groups = root.optJSONObject("groups")
            val groupData = groups?.optJSONObject(normKey)
            val schedMap = groupData?.optJSONObject("sched")
            val dayArr = schedMap?.optJSONArray(dayName)

            val classCards = mutableListOf<ClassCard>()
            if (dayArr != null) {
                for (i in 0 until dayArr.length()) {
                    val obj = dayArr.getJSONObject(i)
                    val batch = obj.optString("b", "")

                    // Batch filter: match if profile batch is ALL, or slot has no batch, or matches
                    val matchesBatch = (profile.batch == "ALL" || batch.isEmpty() || batch.equals(profile.batch, ignoreCase = true))

                    if (matchesBatch) {
                        val slot = obj.optString("s")
                        val (startMin, endMin) = parseSlotMinutes(slot)
                        val tCode = obj.optString("tc")
                        val tId = obj.optString("tid")

                        // Teacher leave check
                        val isTeacherOnLeave = obj.optBoolean("leave", false) ||
                                leavesList.any { it.teacherId == tId || (it.teacherCode.isNotEmpty() && it.teacherCode.equals(tCode, ignoreCase = true)) }

                        classCards.add(
                            ClassCard(
                                slot = slot,
                                subject = obj.optString("sub"),
                                room = obj.optString("r"),
                                teacher = obj.optString("t"),
                                teacherCode = tCode,
                                teacherId = tId,
                                batch = batch,
                                type = obj.optString("tp", "Lecture"),
                                isOnLeave = isTeacherOnLeave,
                                startMin = startMin,
                                endMin = endMin
                            )
                        )
                    }
                }
            }

            // Sort chronologically by startMin
            classCards.sortBy { it.startMin }

            DailySchedule(
                dayName = dayName,
                dateText = dateText,
                profile = profile,
                classes = classCards,
                leaves = leavesList
            )
        } catch (_: Exception) {
            DailySchedule(
                dayName = dayName,
                dateText = dateText,
                profile = profile,
                classes = emptyList(),
                leaves = emptyList()
            )
        }
    }

    private fun parseSlotMinutes(slot: String): Pair<Int, Int> {
        return when {
            slot.startsWith("8:30") -> Pair(510, 570)
            slot.startsWith("9:30") -> Pair(570, 630)
            slot.startsWith("10:30") -> Pair(630, 690)
            slot.startsWith("11:30") -> Pair(690, 750)
            slot.startsWith("12:30") -> Pair(750, 810)
            slot.startsWith("2:00") -> Pair(840, 900)
            slot.startsWith("3:00") -> Pair(900, 960)
            slot.startsWith("4:00") -> Pair(960, 1020)
            slot.startsWith("5:00") -> Pair(1020, 1080)
            else -> Pair(0, 0)
        }
    }

    companion object {
        const val FEED_URL = "https://srccroomfinder.netlify.app/widget_feed.json"
    }
}
