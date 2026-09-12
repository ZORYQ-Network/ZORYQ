package network.zoryq.mobilenode

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

class WitnessService : Service() {
    companion object {
        const val ACTION_START = "network.zoryq.mobilenode.START"
        const val ACTION_STOP = "network.zoryq.mobilenode.STOP"
        private const val CHANNEL = "zoryq_mobile_node"
        private const val NOTIFICATION_ID = 5919065
        private const val RPC = "https://zoryq-evm-node-live-production.up.railway.app/rpc"
        private const val CHAIN_ID = 5919065L
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private var witnessJob: Job? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopWitness()
            return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, notification("Starting witness verification…"))
        startWitness()
        return START_STICKY
    }

    private fun startWitness() {
        if (witnessJob?.isActive == true) return
        val prefs = getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE)
        prefs.edit().putBoolean("running", true).apply()
        witnessJob = scope.launch {
            var previousBlock = prefs.getLong("lastBlock", -1)
            while (isActive) {
                try {
                    val chainHex = rpc("eth_chainId", "[]")
                    val chainId = chainHex.removePrefix("0x").toLong(16)
                    require(chainId == CHAIN_ID) { "Chain ID mismatch: $chainId" }

                    val block = rpcObject("eth_getBlockByNumber", "[\"latest\",false]")
                    val numberHex = block.getString("number")
                    val blockNumber = numberHex.removePrefix("0x").toLong(16)
                    require(block.has("hash") && block.getString("hash").startsWith("0x")) { "Missing block hash" }
                    require(block.has("parentHash") && block.getString("parentHash").startsWith("0x")) { "Missing parent hash" }
                    require(previousBlock < 0 || blockNumber >= previousBlock) { "Block height moved backwards" }

                    previousBlock = blockNumber
                    prefs.edit()
                        .putLong("lastBlock", blockNumber)
                        .putString("lastCheck", Instant.now().toString())
                        .putString("state", "Verified • block $blockNumber")
                        .apply()
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIFICATION_ID, notification("Verified ZORYQ block $blockNumber"))
                } catch (e: Exception) {
                    prefs.edit()
                        .putString("lastCheck", Instant.now().toString())
                        .putString("state", "Verification warning")
                        .apply()
                    getSystemService(NotificationManager::class.java)
                        .notify(NOTIFICATION_ID, notification("Verification warning • ${e.message ?: "RPC unavailable"}"))
                }
                delay(20_000)
            }
        }
    }

    private fun stopWitness() {
        witnessJob?.cancel()
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putBoolean("running", false)
            .putString("state", "Stopped")
            .apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun rpc(method: String, paramsJson: String): String {
        val obj = rpcResponse(method, paramsJson)
        return obj.getString("result")
    }

    private fun rpcObject(method: String, paramsJson: String): JSONObject {
        val obj = rpcResponse(method, paramsJson)
        return obj.getJSONObject("result")
    }

    private fun rpcResponse(method: String, paramsJson: String): JSONObject {
        val payload = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$paramsJson}"
        val request = Request.Builder()
            .url(RPC)
            .post(payload.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            require(response.isSuccessful) { "HTTP ${response.code}" }
            val json = JSONObject(response.body?.string() ?: error("Empty RPC response"))
            require(!json.has("error")) { json.optJSONObject("error")?.optString("message") ?: "RPC error" }
            return json
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL, "ZORYQ Mobile Node", NotificationManager.IMPORTANCE_LOW)
            channel.description = "Visible status for active ZORYQ witness verification"
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun notification(text: String) = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(android.R.drawable.stat_notify_sync)
        .setContentTitle("ZORYQ Mobile Node")
        .setContentText(text)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .build()

    override fun onDestroy() {
        witnessJob?.cancel()
        super.onDestroy()
    }
}
