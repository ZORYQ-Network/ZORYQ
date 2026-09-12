package network.zoryq.mobilenode

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager

data class ResourceDecision(val allowed: Boolean, val reason: String)

object ResourceGovernor {
    fun evaluate(context: Context): ResourceDecision {
        val battery = context.getSystemService(BatteryManager::class.java)
        val level = battery?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 100
        val charging = battery?.isCharging ?: false

        if (level in 0..19 && !charging) {
            return ResourceDecision(false, "Paused by resource governor • low battery")
        }

        val connectivity = context.getSystemService(ConnectivityManager::class.java)
        val network = connectivity.activeNetwork ?: return ResourceDecision(false, "Paused • no network")
        val caps = connectivity.getNetworkCapabilities(network)
            ?: return ResourceDecision(false, "Paused • network unavailable")

        val hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        if (!hasInternet) return ResourceDecision(false, "Paused • internet not validated")

        return ResourceDecision(true, if (charging) "Contributor ready" else "Balanced")
    }
}
