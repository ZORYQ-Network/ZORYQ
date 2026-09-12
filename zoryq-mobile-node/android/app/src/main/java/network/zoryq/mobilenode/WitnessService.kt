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
        const val ACTION_PAUSE = "network.zoryq.mobilenode.PAUSE"
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
        when (intent?.action) {
            ACTION_PAUSE -> {
                pauseWitness()
                return START_NOT_STICKY
            }
            ACTION_STOP -> {
                stopWitness()
                return START_NOT_STICKY
            }
        }
        startForeground(NOTIFICATION_ID, notification("Starting secure witness verification…"))
        startWitness()
        return START_STICKY
    }

    private fun startWitness() {
        if (witnessJob?.isActive == true) return
        val prefs = getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE)
        val nodeId = try {
            NodeIdentity.nodeId()
        } catch (e: Exception) {
            prefs.edit().putBoolean("running", false).putString("state", "Node identity unavailable").apply()
            getSystemService(NotificationManager::class.java)
                .notify(NOTIFICATION_ID, notification("Node identity unavailable"))
            stopSelf()
            return
        }
        val publicKey = NodeIdentity.publicKeyBase64()
        if (!prefs.contains("nodeMode")) prefs.edit().putString("nodeMode", NodeMode.BALANCED.name).apply()
        if (!prefs.contains("batteryMinimum")) prefs.edit().putInt("batteryMinimum", 20).apply()
        if (!prefs.contains("allowMobileData")) prefs.edit().putBoolean("allowMobileData", true).apply()
        if (!prefs.contains("wifiOnly")) prefs.edit().putBoolean("wifiOnly", false).apply()
        if (!prefs.contains("chargingOnly")) prefs.edit().putBoolean("chargingOnly", false).apply()
        prefs.edit()
            .putBoolean("running", true)
            .putBoolean("paused", false)
            .putBoolean("userEnabled", true)
            .putBoolean("resumeRequired", false)
            .putString("nodeId", nodeId)
            .putString("state", "Starting")
            .apply()

        witnessJob = scope.launch {
            var registered = false
            while (isActive) {
                val resourceDecision = ResourceGovernor.evaluate(this@WitnessService)
                prefs.edit()
                    .putString("effectiveNodeMode", resourceDecision.mode.name)
                    .putLong("effectiveIntervalMs", resourceDecision.intervalMs)
                    .apply()

                if (!resourceDecision.allowed) {
                    prefs.edit()
                        .putString("lastCheck", Instant.now().toString())
                        .putString("state", resourceDecision.reason)
                        .putString("proofStatus", "No XP • ${resourceDecision.reason}")
                        .apply()
                    getSystemService(NotificationManager::class.java)
                        .notify(NOTIFICATION_ID, notification(resourceDecision.reason))
                    delay(resourceDecision.intervalMs)
                    continue
                }

                try {
                    val chainHex = rpc("eth_chainId", "[]")
                    val chainId = chainHex.removePrefix("0x").toLong(16)
                    require(chainId == CHAIN_ID) { "Chain ID mismatch: $chainId" }

                    if (!registered) {
                        MobileNodeApi.register(nodeId, publicKey)
                        registered = true
                        prefs.edit().putBoolean("serverRegistered", true).apply()
                    }

                    val challenge = try {
                        MobileNodeApi.challenge(nodeId)
                    } catch (e: IllegalStateException) {
                        if (e.message == "NODE_NOT_REGISTERED") {
                            registered = false
                            prefs.edit().putBoolean("serverRegistered", false).apply()
                        }
                        throw e
                    }
                    require(challenge.chainId == CHAIN_ID) { "Challenge chain mismatch" }

                    val blockTag = "0x${challenge.targetBlock.toString(16)}"
                    val block = rpcObject("eth_getBlockByNumber", "[\"$blockTag\",false]")
                    val blockNumber = block.getString("number").removePrefix("0x").toLong(16)
                    val blockHash = block.getString("hash")
                    val parentHash = block.getString("parentHash")
                    require(blockNumber == challenge.targetBlock) { "Challenge block mismatch" }
                    require(blockHash.matches(Regex("^0x[0-9a-fA-F]{64}$"))) { "Invalid block hash" }
                    require(parentHash.matches(Regex("^0x[0-9a-fA-F]{64}$"))) { "Invalid parent hash" }

                    val observedAt = Instant.now().toString()
                    val receipt = MobileNodeApi.submitProof(challenge, nodeId, blockHash, parentHash, observedAt)

                    prefs.edit()
                        .putLong("lastBlock", blockNumber)
                        .putString("lastBlockHash", blockHash)
                        .putString("lastCheck", observedAt)
                        .putString("lastVerifiedProofHash", receipt.proofHash)
                        .putString("lastXpEventId", receipt.eventId)
                        .putLong("lastXpAwarded", receipt.xpAwarded)
                        .putLong("totalXp", receipt.totalXp)
                        .putString("proofStatus", "Server verified • +${receipt.xpAwarded} XP")
                        .putString("state", "${resourceDecision.mode.name} • verified block $blockNumber")
                        .apply()
                    getSystemService(NotificationManager::class.java)
                        .notify(NOTIFICATION_ID, notification("${resourceDecision.mode.name} • verified block $blockNumber • +${receipt.xpAwarded} XP"))
                } catch (e: Exception) {
                    prefs.edit()
                        .putString("lastCheck", Instant.now().toString())
                        .putString("state", "Verification warning")
                        .putString("proofStatus", "No XP • ${safeError(e)}")
                        .apply()
                    getSystemService(NotificationManager::class.java)
                        .notify(NOTIFICATION_ID, notification("Verification warning • no XP"))
                }
                delay(resourceDecision.intervalMs)
            }
        }
    }

    private fun safeError(e: Exception): String {
        val message = e.message.orEmpty()
        return when {
            message.contains("CHALLENGE_ALREADY_USED") -> "challenge already used"
            message.contains("CHALLENGE_EXPIRED") -> "challenge expired"
            message.contains("TASK_CHALLENGE_PENDING") -> "challenge already pending"
            message.contains("TASK_CHALLENGE_COOLDOWN") -> "challenge cooldown active"
            message.contains("XP_RATE_LIMITED") -> "XP rate limit reached"
            message.contains("INVALID_NODE_SIGNATURE") -> "signature rejected"
            message.contains("BLOCK_PROOF_MISMATCH") -> "block proof rejected"
            message.contains("NODE_NOT_REGISTERED") -> "node registration required"
            message.contains("Chain ID", ignoreCase = true) -> "wrong chain"
            else -> "verification unavailable"
        }
    }

    private fun pauseWitness() {
        witnessJob?.cancel()
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putBoolean("running", false)
            .putBoolean("paused", true)
            .putBoolean("userEnabled", false)
            .putString("nodeMode", NodeMode.PAUSED.name)
            .putString("state", "Paused by user")
            .apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopWitness() {
        witnessJob?.cancel()
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putBoolean("running", false)
            .putBoolean("paused", false)
            .putBoolean("userEnabled", false)
            .putBoolean("resumeRequired", false)
            .putString("state", "Stopped")
            .apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        witnessJob?.cancel()
        getSharedPreferences("zoryq_mobile_node", MODE_PRIVATE).edit()
            .putBoolean("running", false)
            .putBoolean("resumeRequired", true)
            .putString("state", "Android background limit reached • reopen app to resume")
            .putString("proofStatus", "No XP • background session stopped safely")
            .apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
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
        val pauseIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, WitnessService::class.java).setAction(ACTION_PAUSE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            this,
            2,
            Intent(this, WitnessService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("ZORYQ Mobile Node")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "Pause", pauseIntent)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    override fun onDestroy() {
        witnessJob?.cancel()
        super.onDestroy()
    }
}
