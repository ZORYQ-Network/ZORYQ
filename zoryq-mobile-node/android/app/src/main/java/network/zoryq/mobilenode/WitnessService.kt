package network.zoryq.mobilenode

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
        const val ACTION_PAUSE = "network.zoryq.mobilenode.PAUSE"
        private const val CHANNEL = "zoryq_mobile_node"
        private const val NOTIFICATION_ID = 5919065
        private const val RPC = "https://zoryq-evm-node-live-production.up.railway.app/rpc"
        private const val CHAIN_ID = 5919065L
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private var witnessJob: Job? = null
    private val nodeIdentity = NodeIdentity()
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
        when (intent?.action) {
            ACTION_STOP -> {
                stopWitness("Stopped")
                return START_NOT_STICKY
            }
            ACTION_PAUSE -> {
                getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
                    .putString("mode", NodeMode.PAUSED.name)
                    .apply()
                stopWitness("Paused")
                return START_NOT_STICKY
            }
        }

        val identity = nodeIdentity.publicIdentity()
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putString("nodeId", identity.nodeId)
            .putBoolean("nodeKeyHardwareBacked", identity.hardwareBacked)
            .apply()

        startForeground(NOTIFICATION_ID, notification("Starting witness verification…"))
        startWitness()
        return START_STICKY
    }

    private fun startWitness() {
        if (witnessJob?.isActive == true) return
        val prefs = getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE)
        val governor = ResourceGovernor(this)
        prefs.edit().putBoolean("running", true).apply()
        witnessJob = scope.launch {
            var previousBlock = prefs.getLong("lastBlock", -1)
            while (isActive) {
                val mode = runCatching {
                    NodeMode.valueOf(prefs.getString("mode", NodeMode.BALANCED.name) ?: NodeMode.BALANCED.name)
                }.getOrDefault(NodeMode.BALANCED)
                val policy = ResourceGovernor.Policy(
                    mode = mode,
                    minBatteryPct = prefs.getInt("minBatteryPct", 20).coerceIn(5, 80),
                    chargingOnly = prefs.getBoolean("chargingOnly", false),
                    wifiOnly = prefs.getBoolean("wifiOnly", false),
                    mobileDataAllowed = prefs.getBoolean("mobileDataAllowed", true),
                )
                val decision = governor.evaluate(policy)
                prefs.edit().putString("resourceDecision", decision.reason).apply()
                if (!decision.allowed) {
                    val state = "Resource governor • ${decision.reason}"
                    prefs.edit().putString("state", state).putString("lastCheck", Instant.now().toString()).apply()
                    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(state))
                    delay(decision.intervalMs.coerceAtMost(60_000L))
                    continue
                }

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

                    val hash = block.getString("hash")
                    val parentHash = block.getString("parentHash")
                    val observedAt = Instant.now().toString()
                    val proofPayload = "zoryq-mobile-observation-v1|$CHAIN_ID|$blockNumber|$hash|$parentHash|$observedAt"
                    val proofSignature = nodeIdentity.signUtf8(proofPayload)

                    previousBlock = blockNumber
                    prefs.edit()
                        .putLong("lastBlock", blockNumber)
                        .putString("lastHash", hash)
                        .putString("lastCheck", observedAt)
                        .putString("lastLocalProofPayload", proofPayload)
                        .putString("lastLocalProofSignature", proofSignature)
                        .putInt("lastLocalProofXp", 0)
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
                delay(decision.intervalMs)
            }
        }
    }

    private fun stopWitness(state: String) {
        witnessJob?.cancel()
        witnessJob = null
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putBoolean("running", false)
            .putString("state", state)
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

    private fun notification(text: String): android.app.Notification {
        val pauseIntent = Intent(this, WitnessService::class.java).setAction(ACTION_PAUSE)
        val pausePendingIntent = PendingIntent.getService(
            this,
            5919065,
            pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("ZORYQ Mobile Node")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePendingIntent)
            .build()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        stopWitness("Android background time limit reached")
    }

    override fun onDestroy() {
        witnessJob?.cancel()
        witnessJob = null
        super.onDestroy()
    }
}
