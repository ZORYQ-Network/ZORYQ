package network.zoryq.mobilenode

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val prefs = context.getSharedPreferences("zoryq_mobile_node", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("userEnabled", false)) return

        prefs.edit()
            .putBoolean("running", false)
            .putBoolean("resumeRequired", true)
            .putString("state", "Resume required after reboot")
            .apply()

        val manager = context.getSystemService(NotificationManager::class.java)
        val channelId = "zoryq_mobile_node_resume"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(channelId, "ZORYQ Node Resume", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "User-controlled resume notice after device restart"
                }
            )
        }
        val open = PendingIntent.getActivity(
            context,
            5919065,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        manager.notify(
            5919066,
            NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("Resume ZORYQ Mobile Node")
                .setContentText("Android requires you to reopen ZORYQ before background contribution resumes.")
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
        )
    }
}
