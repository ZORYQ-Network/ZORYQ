package network.zoryq.mobilenode

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Reboot recovery deliberately does NOT start the dataSync foreground service
 * from BOOT_COMPLETED. Android restricts that path and the user should remain
 * in control of persistent background work. If the node was active before the
 * reboot, we mark it stopped and offer an explicit notification to reopen the
 * Wallet and resume it.
 */
class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val CHANNEL = "zoryq_mobile_node_recovery"
        private const val NOTIFICATION_ID = 5919066
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED && intent?.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val prefs = context.getSharedPreferences("zoryq_mobile_node", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("running", false)) return

        prefs.edit()
            .putBoolean("running", false)
            .putString("state", "Resume required after reboot/update")
            .apply()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL, "ZORYQ Mobile Node recovery", NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = "Explicit resume prompt after reboot or application update"
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        val pending = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Resume ZORYQ Mobile Node")
            .setContentText("Android restarted. Open ZORYQ to resume background contribution.")
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification)
    }
}
