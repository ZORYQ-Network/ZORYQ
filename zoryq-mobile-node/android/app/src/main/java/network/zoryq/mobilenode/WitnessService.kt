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
import okhttp3.OkHttpClient
import java.time.Instant
import java.util.concurrent.TimeUnit

class WitnessService : Service() {
    companion object {
        const val ACTION_START = "network.zoryq.mobilenode.START"
        const val ACTION_STOP = "network.zoryq.mobilenode.STOP"
        const val ACTION_PAUSE = "network.zoryq.mobilenode.PAUSE"
        private const val CHANNEL = "zoryq_mobile_node"
        private const val NOTIFICATION_ID = 5919065
        private const val DEFAULT_RPC = "https://zoryq-evm-node-live-production.up.railway.app/rpc"
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
        val multiRpc = MultiRpcVerifier(client)
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
                    val configured = prefs.getString("rpcEndpoints", DEFAULT_RPC) ?: DEFAULT_RPC
                    val endpoints = configured.split(',').map { it.trim() }.filter { it.isNotEmpty() }.distinct()
                    val result = multiRpc.verify(endpoints, CHAIN_ID)
                    require(result.observations.isNotEmpty()) { "No healthy ZORYQ RPC" }
                    val best = result.observations.maxBy { it.blockNumber }
                    require(previousBlock < 0 || best.blockNumber >= previousBlock) { "Block height moved backwards" }

                    val observedAt = Instant.now().toString()
                    val checkpoint = result.checkpoint ?: "${best.blockNumber}:${best.blockHash}"
                    val proofPayload = listOf(
                        "zoryq-mobile-observation-v1",
                        CHAIN_ID,
                        best.blockNumber,
                        best.blockHash,
                        best.parentHash,
                        checkpoint,
                        result.votes,
                        result.independentAgreement,
                        observedAt,
                    ).joinToString("|")
                    val proofSignature = nodeIdentity.signUtf8(proofPayload)

                    previousBlock = best.blockNumber
                    val state = if (result.independentAgreement) {
                        "Verified multi-RPC • block ${best.blockNumber}"
                    } else {
                        "Verified observer • independent RPC quorum unavailable"
                    }
                    prefs.edit()
                        .putLong("lastBlock", best.blockNumber)
                        .putString("lastHash", best.blockHash)
                        .putString("lastCheck", observedAt)
                        .putString("lastCheckpoint", checkpoint)
                        .putInt("rpcHealthyCount", result.observations.size)
                        .putInt("rpcAgreementVotes", result.votes)
                        .putBoolean("independentRpcAgreement", result.independentAgreement)
                        .putString("lastLocalProofPayload", proofPayload)
                        .putString("lastLocalProofSignature", proofSignature)
                        .putInt("lastLocalProofXp", 0)
                        .putString("state", state)
                        .apply()
                    getSystemService(NotificationManager::class.java)
                        .notify(NOTIFICATION_ID, notification(state))
                } catch (e: Exception) {
                    prefs.edit()
                        .putString("lastCheck", Instant.now().toString())
                        .putBoolean("independentRpcAgreement", false)
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
