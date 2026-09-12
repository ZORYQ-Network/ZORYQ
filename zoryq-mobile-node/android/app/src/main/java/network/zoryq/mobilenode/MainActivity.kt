package network.zoryq.mobilenode

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val status = findViewById<TextView>(R.id.statusText)
        val detail = findViewById<TextView>(R.id.detailText)
        val start = findViewById<Button>(R.id.startButton)
        val stop = findViewById<Button>(R.id.stopButton)

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        }

        val prefs = getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE)
        fun render() {
            val running = prefs.getBoolean("running", false)
            val lastBlock = prefs.getLong("lastBlock", -1)
            val lastCheck = prefs.getString("lastCheck", "never")
            val state = prefs.getString("state", if (running) "Starting" else "Offline")
            status.text = if (running) "🟢 $state" else "⚪ Offline"
            detail.text = buildString {
                append("Witness Node • Chain 5919065\n")
                append("Mode: Balanced • Not a validator\n")
                append("Last verified block: ")
                append(if (lastBlock >= 0) lastBlock else "—")
                append("\nLast check: ")
                append(lastCheck)
            }
        }
        render()

        start.setOnClickListener {
            prefs.edit().putBoolean("running", true).putString("state", "Starting").apply()
            ContextCompat.startForegroundService(this, Intent(this, WitnessService::class.java).setAction(WitnessService.ACTION_START))
            render()
        }
        stop.setOnClickListener {
            startService(Intent(this, WitnessService::class.java).setAction(WitnessService.ACTION_STOP))
            prefs.edit().putBoolean("running", false).putString("state", "Stopped").apply()
            render()
        }
    }

    override fun onResume() {
        super.onResume()
        val status = findViewByIdOrNull<TextView>(R.id.statusText) ?: return
        val prefs = getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE)
        val running = prefs.getBoolean("running", false)
        status.text = if (running) "🟢 ${prefs.getString("state", "Online")}" else "⚪ Offline"
    }

    private fun <T : android.view.View> findViewByIdOrNull(id: Int): T? = try { findViewById(id) } catch (_: Exception) { null }
}
