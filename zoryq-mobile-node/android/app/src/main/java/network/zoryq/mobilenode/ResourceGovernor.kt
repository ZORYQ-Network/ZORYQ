package network.zoryq.mobilenode

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.StatFs

class ResourceGovernor(private val context: Context) {
    data class Policy(
        val mode: NodeMode,
        val minBatteryPct: Int = 20,
        val chargingOnly: Boolean = false,
        val wifiOnly: Boolean = false,
        val minFreeStorageBytes: Long = 256L * 1024L * 1024L,
    )

    data class Decision(
        val allowed: Boolean,
        val reason: String,
        val intervalMs: Long,
    )

    fun evaluate(policy: Policy): Decision {
        if (policy.mode == NodeMode.PAUSED) return Decision(false, "Paused by user", Long.MAX_VALUE)

        val battery = context.getSystemService(BatteryManager::class.java)
        val batteryPct = battery?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 100
        val charging = battery?.isCharging ?: false
        if (batteryPct in 0 until policy.minBatteryPct) {
            return Decision(false, "Battery below ${policy.minBatteryPct}%", policy.mode.intervalMs)
        }
        if (policy.chargingOnly && !charging) {
            return Decision(false, "Waiting for charger", policy.mode.intervalMs)
        }

        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val network = connectivity?.activeNetwork
        val caps = network?.let { connectivity.getNetworkCapabilities(it) }
        val validated = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
        if (!validated) return Decision(false, "No validated network", policy.mode.intervalMs)
        if (policy.wifiOnly && caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) != true) {
            return Decision(false, "Waiting for Wi-Fi", policy.mode.intervalMs)
        }

        val stat = StatFs(context.filesDir.absolutePath)
        if (stat.availableBytes < policy.minFreeStorageBytes) {
            return Decision(false, "Storage pressure", policy.mode.intervalMs)
        }

        return Decision(true, "Allowed", policy.mode.intervalMs)
    }
}
