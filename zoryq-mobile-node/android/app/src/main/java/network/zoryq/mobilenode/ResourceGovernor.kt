package network.zoryq.mobilenode

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.StatFs

data class ResourceDecision(
    val allowed: Boolean,
    val reason: String,
    val mode: NodeMode,
    val intervalMs: Long
)

object ResourceGovernor {
    private const val DEFAULT_MIN_BATTERY = 20
    private const val MIN_FREE_STORAGE_BYTES = 128L * 1024L * 1024L

    fun evaluate(context: Context): ResourceDecision {
        val prefs = context.getSharedPreferences("zoryq_mobile_node", Context.MODE_PRIVATE)
        val mode = NodeMode.fromPreference(prefs.getString("nodeMode", NodeMode.BALANCED.name))
        val interval = mode.intervalMs

        if (mode == NodeMode.PAUSED) {
            return ResourceDecision(false, "Paused by contribution mode", mode, interval)
        }

        val battery = context.getSystemService(BatteryManager::class.java)
        val level = battery?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 100
        val charging = battery?.isCharging ?: false
        val minimumBattery = prefs.getInt("batteryMinimum", DEFAULT_MIN_BATTERY).coerceIn(10, 50)
        val chargingOnly = prefs.getBoolean("chargingOnly", false)

        if (level in 0 until minimumBattery && !charging) {
            return ResourceDecision(false, "Paused by resource governor • battery below $minimumBattery%", mode, interval)
        }
        if (chargingOnly && !charging) {
            return ResourceDecision(false, "Paused • charging required", mode, interval)
        }
        if (mode == NodeMode.MAX_CONTRIBUTION && !charging) {
            return ResourceDecision(false, "Paused • Max Contribution requires charging", mode, interval)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val power = context.getSystemService(PowerManager::class.java)
            if ((power?.currentThermalStatus ?: PowerManager.THERMAL_STATUS_NONE) >= PowerManager.THERMAL_STATUS_SEVERE) {
                return ResourceDecision(false, "Paused • device temperature is high", mode, interval)
            }
        }

        val freeStorage = StatFs(context.filesDir.absolutePath).availableBytes
        val configuredStorageFloor = prefs.getLong("minimumFreeStorageBytes", MIN_FREE_STORAGE_BYTES)
            .coerceAtLeast(MIN_FREE_STORAGE_BYTES)
        if (freeStorage < configuredStorageFloor) {
            return ResourceDecision(false, "Paused • low storage", mode, interval)
        }

        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val network = connectivity.activeNetwork ?: return ResourceDecision(false, "Paused • no network", mode, interval)
        val caps = connectivity.getNetworkCapabilities(network)
            ?: return ResourceDecision(false, "Paused • network unavailable", mode, interval)

        val hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        if (!hasInternet) return ResourceDecision(false, "Paused • internet not validated", mode, interval)

        val wifiOnly = prefs.getBoolean("wifiOnly", false)
        val onWifi = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        if (wifiOnly && !onWifi) {
            return ResourceDecision(false, "Paused • Wi-Fi only mode", mode, interval)
        }

        val allowMobileData = prefs.getBoolean("allowMobileData", true)
        val onCellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
        if (onCellular && !allowMobileData) {
            return ResourceDecision(false, "Paused • mobile data disabled", mode, interval)
        }

        val label = when (mode) {
            NodeMode.ECO -> "Eco ready"
            NodeMode.BALANCED -> if (charging) "Balanced • charging" else "Balanced"
            NodeMode.MAX_CONTRIBUTION -> "Max Contribution ready"
            NodeMode.PAUSED -> "Paused"
        }
        return ResourceDecision(true, label, mode, interval)
    }
}
