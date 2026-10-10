package edu.srcc.timetablewidget

import edu.srcc.timetablewidget.model.ClassCard
import edu.srcc.timetablewidget.model.WidgetProfile
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class WidgetScheduleTest {

    @Test
    fun testProfileKeyNormalization() {
        val p1 = WidgetProfile("B.Com (Hons)", "Sem I", "Sec A", "ALL")
        assertEquals("bcomhons_semi_seca", p1.toNormalizedKey())

        val p2 = WidgetProfile("B.A. (Hons) Economics", "Sem III", "Sec B", "Batch 1")
        assertEquals("bahonseconomics_semiii_secb", p2.toNormalizedKey())

        val p3 = WidgetProfile("GBO", "Sem I", "Sec A")
        assertEquals("gbo_semi_seca", p3.toNormalizedKey())
    }

    @Test
    fun testClassTimingStates() {
        // 8:30 AM to 9:30 AM -> 510 to 570 mins
        val card = ClassCard(
            slot = "8:30 AM to 9:30 AM",
            subject = "Business Law",
            room = "R1",
            teacher = "Prof. Sharma",
            startMin = 510,
            endMin = 570
        )

        // Before class (8:00 AM = 480 min)
        assertTrue(card.isUpcoming(480))
        assertFalse(card.isOngoing(480))
        assertFalse(card.isFinished(480))

        // During class (9:00 AM = 540 min)
        assertFalse(card.isUpcoming(540))
        assertTrue(card.isOngoing(540))
        assertFalse(card.isFinished(540))

        // After class (10:00 AM = 600 min)
        assertFalse(card.isUpcoming(600))
        assertFalse(card.isOngoing(600))
        assertTrue(card.isFinished(600))
    }

    @Test
    fun testFacultyLeaveMatching() {
        val leavesJson = JSONArray().apply {
            put(JSONObject().apply {
                put("teacher_id", "538")
                put("teacher_name", "Ms. Anju Verma")
                put("teacher_code", "AUV")
                put("start_date", "2026-10-09")
                put("end_date", "2026-10-12")
            })
        }

        val testDate = "2026-10-10"
        var matches = false
        for (i in 0 until leavesJson.length()) {
            val item = leavesJson.getJSONObject(i)
            val s = item.getString("start_date")
            val e = item.getString("end_date")
            if (testDate in s..e && item.getString("teacher_code") == "AUV") {
                matches = true
            }
        }
        assertTrue("Faculty leave covering target date should match", matches)
    }

    @Test
    fun testAsiaKolkataTimezoneIntegrity() {
        val tz = TimeZone.getTimeZone("Asia/Kolkata")
        val cal = Calendar.getInstance(tz)
        assertNotNull(cal)
        assertEquals("Asia/Kolkata", tz.id)
        // Offset for IST should be 5 hours 30 mins = 19800000 ms
        assertEquals(19800000, tz.rawOffset)
    }
}
