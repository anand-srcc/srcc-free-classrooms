package edu.srcc.timetablewidget.model

import java.io.Serializable

data class WidgetProfile(
    val course: String = "B.Com (Hons)",
    val sem: String = "Sem I",
    val sec: String = "Sec A",
    val batch: String = "ALL"
) : Serializable {
    fun toNormalizedKey(): String {
        fun clean(s: String): String = s.lowercase().replace(Regex("[^a-z0-9]"), "")
        return "${clean(course)}_${clean(sem)}_${clean(sec)}"
    }

    fun toDisplayString(): String {
        val b = if (batch.isNotEmpty() && batch != "ALL") " ($batch)" else ""
        val s = if (sec.isNotEmpty()) " · $sec" else ""
        return "$course · $sem$s$b"
    }
}

data class ClassCard(
    val slot: String,
    val subject: String,
    val room: String,
    val teacher: String,
    val teacherCode: String = "",
    val teacherId: String = "",
    val batch: String = "",
    val type: String = "Lecture",
    val isOnLeave: Boolean = false,
    val startMin: Int = 0,
    val endMin: Int = 0
) : Serializable {
    fun isOngoing(currentMin: Int): Boolean = currentMin in startMin..endMin
    fun isUpcoming(currentMin: Int): Boolean = currentMin < startMin
    fun isFinished(currentMin: Int): Boolean = currentMin > endMin
}

data class LeaveInfo(
    val teacherId: String,
    val teacherName: String,
    val teacherCode: String,
    val department: String,
    val startDate: String,
    val endDate: String,
    val isHalfDay: Boolean = false
) : Serializable

data class DailySchedule(
    val dayName: String,
    val dateText: String,
    val profile: WidgetProfile,
    val classes: List<ClassCard>,
    val leaves: List<LeaveInfo>,
    val isCollegeClosed: Boolean = false
) : Serializable
