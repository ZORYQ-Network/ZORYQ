package network.zoryq.mobilenode

import android.content.Context
import android.net.TrafficStats
import android.os.Process
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max

object MobileDataMeter {
    private const val PREFS = "zoryq_mobile_node"
    private const val KEY_DAY = "mobileDataDayUtc"
    private const val KEY_BYTES_TODAY = "mobileDataBytesToday"
    private const val KEY_UID_TOTAL = "mobileDataUidTotalBaseline"
    private const val KEY_PREVIOUS_CELLULAR = "mobileDataPreviousTransportCellular"

    fun sample(context: Context, currentlyCellular: Boolean): Long {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val today = utcDay()
        val currentTotal = uidTotalBytes()
        val storedDay = prefs.getString(KEY_DAY, null)
        val previousTotal = prefs.getLong(KEY_UID_TOTAL, currentTotal)
        val previousWasCellular = prefs.getBoolean(KEY_PREVIOUS_CELLULAR, false)

        var bytesToday = if (storedDay == today) prefs.getLong(KEY_BYTES_TODAY, 0L) else 0L
        if (storedDay == today && currentTotal >= 0L && previousTotal >= 0L && previousWasCellular) {
            bytesToday += max(0L, currentTotal - previousTotal)
        }

        prefs.edit()
            .putString(KEY_DAY, today)
            .putLong(KEY_BYTES_TODAY, bytesToday)
            .putLong(KEY_UID_TOTAL, currentTotal)
            .putBoolean(KEY_PREVIOUS_CELLULAR, currentlyCellular)
            .apply()
        return bytesToday
    }

    fun bytesToday(context: Context): Long {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val today = utcDay()
        return if (prefs.getString(KEY_DAY, null) == today) prefs.getLong(KEY_BYTES_TODAY, 0L) else 0L
    }

    private fun utcDay(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())

    private fun uidTotalBytes(): Long {
        val rx = TrafficStats.getUidRxBytes(Process.myUid())
        val tx = TrafficStats.getUidTxBytes(Process.myUid())
        if (rx == TrafficStats.UNSUPPORTED.toLong() || tx == TrafficStats.UNSUPPORTED.toLong()) return -1L
        return rx + tx
    }
}
