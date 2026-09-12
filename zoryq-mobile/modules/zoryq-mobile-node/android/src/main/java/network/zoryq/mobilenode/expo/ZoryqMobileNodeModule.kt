package network.zoryq.mobilenode.expo

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import network.zoryq.mobilenode.NodeIdentity
import network.zoryq.mobilenode.NodeMode
import network.zoryq.mobilenode.WitnessService

class ZoryqMobileNodeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ZoryqMobileNode")

        AsyncFunction("start") {
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            val intent = Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_START)
            ContextCompat.startForegroundService(context, intent)
            status()
        }

        AsyncFunction("pause") {
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            val intent = Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_PAUSE)
            context.startService(intent)
            status()
        }

        AsyncFunction("stop") {
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            val intent = Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_STOP)
            context.startService(intent)
            status()
        }

        AsyncFunction("setPolicy") { mode: String, minBatteryPct: Int, chargingOnly: Boolean, wifiOnly: Boolean, mobileDataAllowed: Boolean ->
            val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
            val parsedMode = NodeMode.valueOf(mode)
            require(minBatteryPct in 5..80) { "minBatteryPct must be between 5 and 80" }
            context.getSharedPreferences("zoryq_mobile_node", android.content.Context.MODE_PRIVATE)
                .edit()
                .putString("mode", parsedMode.name)
                .putInt("minBatteryPct", minBatteryPct)
                .putBoolean("chargingOnly", chargingOnly)
                .putBoolean("wifiOnly", wifiOnly)
                .putBoolean("mobileDataAllowed", mobileDataAllowed)
                .apply()
            status()
        }

        AsyncFunction("getStatus") { status() }

        AsyncFunction("getNodeIdentity") {
            val identity = NodeIdentity().publicIdentity()
            mapOf(
                "nodeId" to identity.nodeId,
                "publicKeyBase64" to identity.publicKeyBase64,
                "hardwareBacked" to identity.hardwareBacked,
                "algorithm" to identity.algorithm,
                "walletKeyReused" to false,
            )
        }
    }

    private fun status(): Map<String, Any?> {
        val context = requireNotNull(appContext.reactContext) { "React context unavailable" }
        val prefs = context.getSharedPreferences("zoryq_mobile_node", android.content.Context.MODE_PRIVATE)
        return mapOf(
            "running" to prefs.getBoolean("running", false),
            "state" to (prefs.getString("state", "Offline") ?: "Offline"),
            "nodeId" to prefs.getString("nodeId", null),
            "nodeKeyHardwareBacked" to prefs.getBoolean("nodeKeyHardwareBacked", false),
            "lastBlock" to prefs.getLong("lastBlock", -1L),
            "lastHash" to prefs.getString("lastHash", null),
            "lastCheck" to prefs.getString("lastCheck", null),
            "lastCheckpoint" to prefs.getString("lastCheckpoint", null),
            "rpcHealthyCount" to prefs.getInt("rpcHealthyCount", 0),
            "rpcAgreementVotes" to prefs.getInt("rpcAgreementVotes", 0),
            "independentRpcAgreement" to prefs.getBoolean("independentRpcAgreement", false),
            "resourceDecision" to prefs.getString("resourceDecision", null),
            "mode" to (prefs.getString("mode", NodeMode.BALANCED.name) ?: NodeMode.BALANCED.name),
            "minBatteryPct" to prefs.getInt("minBatteryPct", 20),
            "chargingOnly" to prefs.getBoolean("chargingOnly", false),
            "wifiOnly" to prefs.getBoolean("wifiOnly", false),
            "mobileDataAllowed" to prefs.getBoolean("mobileDataAllowed", true),
            "lastLocalProofXp" to prefs.getInt("lastLocalProofXp", 0),
        )
    }
}
