package edu.srcc.timetablewidget.ui

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import edu.srcc.timetablewidget.R
import edu.srcc.timetablewidget.data.WidgetProfileRepository
import edu.srcc.timetablewidget.model.WidgetProfile
import edu.srcc.timetablewidget.widget.BaseTimetableWidgetProvider

class WidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var profileRepo: WidgetProfileRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)
        setContentView(R.layout.activity_widget_config)

        profileRepo = WidgetProfileRepository(this)

        val intent = intent
        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        val spnCourse = findViewById<Spinner>(R.id.spn_config_course)
        val spnSem = findViewById<Spinner>(R.id.spn_config_sem)
        val spnSec = findViewById<Spinner>(R.id.spn_config_sec)
        val spnBatch = findViewById<Spinner>(R.id.spn_config_batch)
        val etCode = findViewById<EditText>(R.id.et_config_code)
        val btnSave = findViewById<Button>(R.id.btn_save_config)

        // Setup spinners
        val courses = arrayOf("B.Com (Hons)", "B.A. (Hons) Economics", "M.Com", "GBO", "SEC", "VAC")
        val sems = arrayOf("Sem I", "Sem III", "Sem V", "Sem VII")
        val secs = arrayOf("Sec A", "Sec B", "Sec C", "Sec D", "Sec E", "Sec F", "Sec G", "Sec H", "Sec I", "Sec J", "Sec K", "Sec L", "Sec M", "Sec N")
        val batches = arrayOf("ALL", "Batch 1", "Batch 2", "Batch 3", "Batch 4")

        spnCourse.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, courses)
        spnSem.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, sems)
        spnSec.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, secs)
        spnBatch.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, batches)

        // Preload default
        val cur = profileRepo.getProfile()
        spnCourse.setSelection(courses.indexOf(cur.course).coerceAtLeast(0))
        spnSem.setSelection(sems.indexOf(cur.sem).coerceAtLeast(0))
        spnSec.setSelection(secs.indexOf(cur.sec).coerceAtLeast(0))
        spnBatch.setSelection(batches.indexOf(cur.batch).coerceAtLeast(0))

        btnSave.setOnClickListener {
            val rawCode = etCode.text.toString().trim()
            val profile = if (rawCode.isNotEmpty()) {
                val parsed = profileRepo.parseFromImportString(rawCode)
                if (parsed == null) {
                    Toast.makeText(this, "Could not parse code. Using spinner selections.", Toast.LENGTH_SHORT).show()
                    buildProfileFromSpinners(spnCourse, spnSem, spnSec, spnBatch)
                } else {
                    parsed
                }
            } else {
                buildProfileFromSpinners(spnCourse, spnSem, spnSec, spnBatch)
            }

            profileRepo.saveProfile(profile, appWidgetId)
            BaseTimetableWidgetProvider.updateAllWidgets(this, forceRefresh = true)

            val resultValue = Intent().apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            setResult(Activity.RESULT_OK, resultValue)
            Toast.makeText(this, "Pinned ${profile.toDisplayString()}", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun buildProfileFromSpinners(
        c: Spinner, s: Spinner, sec: Spinner, b: Spinner
    ): WidgetProfile {
        return WidgetProfile(
            course = c.selectedItem?.toString() ?: "B.Com (Hons)",
            sem = s.selectedItem?.toString() ?: "Sem I",
            sec = sec.selectedItem?.toString() ?: "Sec A",
            batch = b.selectedItem?.toString() ?: "ALL"
        )
    }
}
