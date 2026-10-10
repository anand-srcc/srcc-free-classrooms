package edu.srcc.timetablewidget.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import edu.srcc.timetablewidget.R
import edu.srcc.timetablewidget.data.WidgetFeedRepository
import edu.srcc.timetablewidget.data.WidgetProfileRepository
import edu.srcc.timetablewidget.model.DailySchedule
import edu.srcc.timetablewidget.sync.WidgetSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.TimeZone

abstract class BaseTimetableWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        WidgetSyncWorker.enqueuePeriodic(context)
        updateAllWidgets(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MANUAL_REFRESH) {
            WidgetSyncWorker.enqueueOneTime(context)
            updateAllWidgets(context, forceRefresh = true)
        }
    }

    companion object {
        const val ACTION_MANUAL_REFRESH = "edu.srcc.timetablewidget.ACTION_MANUAL_REFRESH"

        fun updateAllWidgets(context: Context, forceRefresh: Boolean = false) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val profileRepo = WidgetProfileRepository(context)
            val feedRepo = WidgetFeedRepository(context)

            CoroutineScope(Dispatchers.IO).launch {
                val profile = profileRepo.getProfile()
                val schedule = feedRepo.getDailySchedule(profile, forceRefresh)

                // 4x1
                val ids4x1 = appWidgetManager.getAppWidgetIds(ComponentName(context, TimetableWidget4x1Provider::class.java))
                for (id in ids4x1) {
                    val views = render4x1(context, schedule)
                    appWidgetManager.updateAppWidget(id, views)
                }

                // 4x2
                val ids4x2 = appWidgetManager.getAppWidgetIds(ComponentName(context, TimetableWidget4x2Provider::class.java))
                for (id in ids4x2) {
                    val views = render4x2(context, schedule)
                    appWidgetManager.updateAppWidget(id, views)
                }

                // 4x4
                val ids4x4 = appWidgetManager.getAppWidgetIds(ComponentName(context, TimetableWidget4x4Provider::class.java))
                for (id in ids4x4) {
                    val views = render4x4(context, schedule)
                    appWidgetManager.updateAppWidget(id, views)
                }
            }
        }

        private fun render4x1(context: Context, schedule: DailySchedule): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_4x1)
            val nowMin = getCurrentIstMinutes()

            if (schedule.isCollegeClosed) {
                views.setTextViewText(R.id.tv_4x1_time, "Closed")
                views.setTextViewText(R.id.tv_4x1_period, "Sunday")
                views.setTextViewText(R.id.tv_4x1_subject, "College is closed on Sunday")
                views.setTextViewText(R.id.tv_4x1_teacher, "Enjoy your weekend!")
                views.setTextViewText(R.id.tv_4x1_room, "—")
                views.setViewVisibility(R.id.tv_4x1_leave_tag, View.GONE)
            } else {
                val nextClass = schedule.classes.firstOrNull { it.isOngoing(nowMin) || it.isUpcoming(nowMin) }
                if (nextClass != null) {
                    val isOngoing = nextClass.isOngoing(nowMin)
                    views.setTextViewText(R.id.tv_4x1_time, nextClass.slot.split(" to ").firstOrNull() ?: nextClass.slot)
                    views.setTextViewText(R.id.tv_4x1_period, if (isOngoing) "LIVE NOW" else "NEXT UP")
                    views.setTextViewText(R.id.tv_4x1_subject, nextClass.subject)
                    views.setTextViewText(R.id.tv_4x1_teacher, nextClass.teacher)
                    views.setTextViewText(R.id.tv_4x1_room, nextClass.room)

                    if (nextClass.isOnLeave) {
                        views.setViewVisibility(R.id.tv_4x1_leave_tag, View.VISIBLE)
                    } else {
                        views.setViewVisibility(R.id.tv_4x1_leave_tag, View.GONE)
                    }
                } else {
                    views.setTextViewText(R.id.tv_4x1_time, "Done")
                    views.setTextViewText(R.id.tv_4x1_period, "Today")
                    views.setTextViewText(R.id.tv_4x1_subject, if (schedule.classes.isEmpty()) "No classes today" else "All classes completed")
                    views.setTextViewText(R.id.tv_4x1_teacher, schedule.profile.toDisplayString())
                    views.setTextViewText(R.id.tv_4x1_room, "✨")
                    views.setViewVisibility(R.id.tv_4x1_leave_tag, View.GONE)
                }
            }

            attachAppClickIntent(context, views, R.id.widget_4x1_root)
            return views
        }

        private fun render4x2(context: Context, schedule: DailySchedule): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_4x2)
            views.setTextViewText(R.id.tv_4x2_header_title, "SRCC · ${schedule.dayName}, ${schedule.dateText}")
            views.setTextViewText(R.id.tv_4x2_header_sub, schedule.profile.toDisplayString())

            attachRefreshIntent(context, views, R.id.btn_4x2_refresh)
            attachAppClickIntent(context, views, R.id.widget_4x2_root)

            if (schedule.isCollegeClosed || schedule.classes.isEmpty()) {
                views.setViewVisibility(R.id.tv_4x2_empty, View.VISIBLE)
                views.setTextViewText(R.id.tv_4x2_empty, if (schedule.isCollegeClosed) "College is closed today (Sunday)" else "No classes scheduled for today 🎉")
                views.setViewVisibility(R.id.row_4x2_class1, View.GONE)
                views.setViewVisibility(R.id.row_4x2_class2, View.GONE)
            } else {
                views.setViewVisibility(R.id.tv_4x2_empty, View.GONE)
                val c1 = schedule.classes.getOrNull(0)
                if (c1 != null) {
                    views.setViewVisibility(R.id.row_4x2_class1, View.VISIBLE)
                    views.setTextViewText(R.id.tv_4x2_c1_time, c1.slot.split(" to ").firstOrNull() ?: "")
                    views.setTextViewText(R.id.tv_4x2_c1_sub, c1.subject)
                    views.setTextViewText(R.id.tv_4x2_c1_prof, c1.teacher)
                    views.setTextViewText(R.id.tv_4x2_c1_room, c1.room)
                    views.setViewVisibility(R.id.tv_4x2_c1_leave, if (c1.isOnLeave) View.VISIBLE else View.GONE)
                } else {
                    views.setViewVisibility(R.id.row_4x2_class1, View.GONE)
                }

                val c2 = schedule.classes.getOrNull(1)
                if (c2 != null) {
                    views.setViewVisibility(R.id.row_4x2_class2, View.VISIBLE)
                    views.setTextViewText(R.id.tv_4x2_c2_time, c2.slot.split(" to ").firstOrNull() ?: "")
                    views.setTextViewText(R.id.tv_4x2_c2_sub, c2.subject)
                    views.setTextViewText(R.id.tv_4x2_c2_prof, c2.teacher)
                    views.setTextViewText(R.id.tv_4x2_c2_room, c2.room)
                    views.setViewVisibility(R.id.tv_4x2_c2_leave, if (c2.isOnLeave) View.VISIBLE else View.GONE)
                } else {
                    views.setViewVisibility(R.id.row_4x2_class2, View.GONE)
                }
            }

            return views
        }

        private fun render4x4(context: Context, schedule: DailySchedule): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_4x4)
            views.setTextViewText(R.id.tv_4x4_date_batch, "${schedule.dayName}, ${schedule.dateText} · ${schedule.profile.toDisplayString()}")

            attachRefreshIntent(context, views, R.id.btn_4x4_refresh)
            attachAppClickIntent(context, views, R.id.widget_4x4_root)

            // Classes 1, 2, 3
            val c1 = schedule.classes.getOrNull(0)
            if (c1 != null) {
                views.setViewVisibility(R.id.row_4x4_class1, View.VISIBLE)
                views.setTextViewText(R.id.tv_4x4_c1_time, c1.slot.split(" to ").firstOrNull() ?: "")
                views.setTextViewText(R.id.tv_4x4_c1_sub, c1.subject)
                views.setTextViewText(R.id.tv_4x4_c1_room, c1.room)
                views.setViewVisibility(R.id.tv_4x4_c1_leave, if (c1.isOnLeave) View.VISIBLE else View.GONE)
            } else {
                views.setViewVisibility(R.id.row_4x4_class1, View.GONE)
            }

            val c2 = schedule.classes.getOrNull(1)
            if (c2 != null) {
                views.setViewVisibility(R.id.row_4x4_class2, View.VISIBLE)
                views.setTextViewText(R.id.tv_4x4_c2_time, c2.slot.split(" to ").firstOrNull() ?: "")
                views.setTextViewText(R.id.tv_4x4_c2_sub, c2.subject)
                views.setTextViewText(R.id.tv_4x4_c2_room, c2.room)
                views.setViewVisibility(R.id.tv_4x4_c2_leave, if (c2.isOnLeave) View.VISIBLE else View.GONE)
            } else {
                views.setViewVisibility(R.id.row_4x4_class2, View.GONE)
            }

            val c3 = schedule.classes.getOrNull(2)
            if (c3 != null) {
                views.setViewVisibility(R.id.row_4x4_class3, View.VISIBLE)
                views.setTextViewText(R.id.tv_4x4_c3_time, c3.slot.split(" to ").firstOrNull() ?: "")
                views.setTextViewText(R.id.tv_4x4_c3_sub, c3.subject)
                views.setTextViewText(R.id.tv_4x4_c3_room, c3.room)
                views.setViewVisibility(R.id.tv_4x4_c3_leave, if (c3.isOnLeave) View.VISIBLE else View.GONE)
            } else {
                views.setViewVisibility(R.id.row_4x4_class3, View.GONE)
            }

            // Faculty on leave summary
            val leaveSummary = if (schedule.leaves.isEmpty()) {
                "No faculty reported on leave today."
            } else {
                schedule.leaves.joinToString(", ") { "${it.teacherName} (${it.department})" }
            }
            views.setTextViewText(R.id.tv_4x4_leaves_summary, leaveSummary)

            return views
        }

        private fun attachRefreshIntent(context: Context, views: RemoteViews, viewId: Int) {
            val intent = Intent(context, TimetableWidget4x1Provider::class.java).apply {
                action = ACTION_MANUAL_REFRESH
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, 1001, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(viewId, pendingIntent)
        }

        private fun attachAppClickIntent(context: Context, views: RemoteViews, viewId: Int) {
            val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://srccroomfinder.netlify.app/widget.html"))
            val pendingIntent = PendingIntent.getActivity(
                context, 2002, webIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(viewId, pendingIntent)
        }

        private fun getCurrentIstMinutes(): Int {
            val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"))
            return cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        }
    }
}

class TimetableWidget4x1Provider : BaseTimetableWidgetProvider()
class TimetableWidget4x2Provider : BaseTimetableWidgetProvider()
class TimetableWidget4x4Provider : BaseTimetableWidgetProvider()
