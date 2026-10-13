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
import edu.srcc.timetablewidget.update.AppUpdateManager
import edu.srcc.timetablewidget.widget.BaseTimetableWidgetProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var profileRepo: WidgetProfileRepository
    private var isUpdateBlocked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)
        setContentView(R.layout.activity_widget_config)

        checkAppUpdate()

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
        val courses = arrayOf("B.Com (Hons)", "B.A. (Hons) Economics", "SEC", "VAC")
        val sems = arrayOf("Sem I", "Sem III", "Sem V", "Sem VII")
        val batches = arrayOf("ALL", "Batch 1", "Batch 2", "Batch 3", "Batch 4")

        fun getSectionsForCourse(course: String): Array<String> {
            return when (course) {
                "B.A. (Hons) Economics" -> arrayOf("Sec A", "Sec B", "Sec C", "Sec D")
                "SEC" -> arrayOf("Joint", "Sec 1", "Sec 2", "Sec 3", "Sec 6", "Sec 7", "Sec 8", "Sec 9", "Sec 10", "Sec 11", "Sec 12", "Sec 13", "Sec 14", "Sec 15", "Sec 16", "Sec 17", "Sec 18", "Sec 19", "Sec 20", "Sec 22")
                "VAC" -> arrayOf("Joint", "VAC 16", "VAC 17", "VAC 20")
                else -> arrayOf("Sec A", "Sec B", "Sec C", "Sec D", "Sec E", "Sec F", "Sec G", "Sec H", "Sec I", "Sec J", "Sec K", "Sec L", "Sec M", "Sec N")
            }
        }

        spnCourse.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, courses)
        spnSem.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, sems)
        spnBatch.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, batches)

        // Preload default
        val cur = profileRepo.getProfile(if (appWidgetId > 0) appWidgetId else null)
        val initialCourseIdx = courses.indexOf(cur.course).coerceAtLeast(0)
        spnCourse.setSelection(initialCourseIdx)
        spnSem.setSelection(sems.indexOf(cur.sem).coerceAtLeast(0))

        val initialSecs = getSectionsForCourse(courses[initialCourseIdx])
        spnSec.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, initialSecs)
        spnSec.setSelection(initialSecs.indexOf(cur.sec).coerceAtLeast(0))
        spnBatch.setSelection(batches.indexOf(cur.batch).coerceAtLeast(0))

        spnCourse.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val selectedCourse = courses[position]
                val secList = getSectionsForCourse(selectedCourse)
                val curSec = spnSec.selectedItem?.toString()
                spnSec.adapter = ArrayAdapter(this@WidgetConfigActivity, android.R.layout.simple_spinner_dropdown_item, secList)
                spnSec.setSelection(secList.indexOf(curSec).coerceAtLeast(0))
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }

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
            if (appWidgetId > 0) {
                BaseTimetableWidgetProvider.updateWidget(this, appWidgetId)
            }
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

    private fun checkAppUpdate() {
        CoroutineScope(Dispatchers.Main).launch {
            val updateInfo = AppUpdateManager.checkUpdate(this@WidgetConfigActivity)
            if (updateInfo != null && AppUpdateManager.isUpdateRequired(updateInfo)) {
                isUpdateBlocked = true
                findViewById<Button>(R.id.btn_save_config)?.isEnabled = false
                AppUpdateManager.showForceUpdateDialog(this@WidgetConfigActivity, updateInfo)
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (isUpdateBlocked) {
            finishAffinity()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
