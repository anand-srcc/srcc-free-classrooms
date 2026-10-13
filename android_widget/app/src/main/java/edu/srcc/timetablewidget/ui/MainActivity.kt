package edu.srcc.timetablewidget.ui

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import edu.srcc.timetablewidget.R
import edu.srcc.timetablewidget.update.AppUpdateManager
import edu.srcc.timetablewidget.widget.TimetableWidget4x2Provider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineLayout: LinearLayout
    private lateinit var btnRetry: Button
    private lateinit var btnSetupWidget: Button

    private var isUpdateBlocked = false
    private val webPortalUrl = "https://srccroomfinder.netlify.app/"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.main_webview)
        swipeRefresh = findViewById(R.id.swipe_refresh_layout)
        progressBar = findViewById(R.id.web_progress_bar)
        offlineLayout = findViewById(R.id.offline_layout)
        btnRetry = findViewById(R.id.btn_retry_network)
        btnSetupWidget = findViewById(R.id.btn_setup_widget)

        setupWebView()
        setupListeners()
        checkAppUpdate()

        loadPortal()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.cacheMode = if (isNetworkAvailable()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK

        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                progressBar.progress = 10
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                offlineLayout.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && !isNetworkAvailable()) {
                    // Fall back smoothly to bundled local web app
                    view?.loadUrl("file:///android_asset/web_app/index.html")
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("https://srccroomfinder.netlify.app") || url.startsWith("file:///android_asset") || url.startsWith("http://") || url.startsWith("https://")) {
                    return false
                }
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    true
                } catch (_: Exception) {
                    false
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                }
            }
        }
    }

    private fun setupListeners() {
        swipeRefresh.setColorSchemeResources(R.color.srcc_navy)
        swipeRefresh.setOnRefreshListener {
            loadPortal()
        }

        btnRetry.setOnClickListener {
            offlineLayout.visibility = View.GONE
            loadPortal()
        }

        btnSetupWidget.setOnClickListener {
            showWidgetActionDialog()
        }
    }

    private fun loadPortal() {
        offlineLayout.visibility = View.GONE
        if (isNetworkAvailable()) {
            webView.loadUrl(webPortalUrl)
        } else {
            webView.loadUrl("file:///android_asset/web_app/index.html")
        }
    }

    private fun showWidgetActionDialog() {
        val options = arrayOf(
            "📌 Pin Widget to Home Screen",
            "⚙️ Configure Section / Batch"
        )

        AlertDialog.Builder(this)
            .setTitle("SRCC Home Screen Widget")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> requestPinWidget()
                    1 -> {
                        val intent = Intent(this, WidgetConfigActivity::class.java)
                        startActivity(intent)
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun requestPinWidget() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val appWidgetManager = getSystemService(AppWidgetManager::class.java)
            val provider = ComponentName(this, TimetableWidget4x2Provider::class.java)
            if (appWidgetManager.isRequestPinAppWidgetSupported) {
                val successCallback = PendingIntent.getActivity(
                    this, 0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                appWidgetManager.requestPinAppWidget(provider, null, successCallback)
                Toast.makeText(this, "Adding SRCC Widget to Home Screen...", Toast.LENGTH_SHORT).show()
                return
            }
        }

        // Fallback for older devices or custom launchers
        AlertDialog.Builder(this)
            .setTitle("Add Widget")
            .setMessage("Long-press on your phone's Home Screen -> Tap 'Widgets' -> Select 'SRCC Timetable' to add your schedule widget!")
            .setPositiveButton("OK", null)
            .show()
    }

    private fun checkAppUpdate() {
        CoroutineScope(Dispatchers.Main).launch {
            val updateInfo = AppUpdateManager.checkUpdate(this@MainActivity)
            if (updateInfo != null && AppUpdateManager.isUpdateRequired(updateInfo)) {
                isUpdateBlocked = true
                AppUpdateManager.showForceUpdateDialog(this@MainActivity, updateInfo)
            }
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (isUpdateBlocked) {
            finishAffinity()
        } else if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
