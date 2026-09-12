package network.zoryq.mobilenode.expo

import android.content.Intent
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import network.zoryq.mobilenode.NodeIdentity
import network.zoryq.mobilenode.NodeMode
import network.zoryq.mobilenode.WitnessService
import org.json.JSONObject

class ZoryqMobileNodeModule : Module() {
    companion object {
        private const val CHAIN_ID = 5919065L
    }

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

        // Domain-specific signing only. The JS layer cannot ask the node key to
        // sign arbitrary wallet or application payloads.
        AsyncFunction("signRegistrationChallenge") { challenge: String ->
            val identity = NodeIdentity()
            val public = identity.publicIdentity()
            val payload = registrationSigningPayload(challenge)
            require(payload.nodeId == public.nodeId) { "Registration challenge belongs to another Node ID" }
            require(payload.chainId == CHAIN_ID) { "Registration challenge targets wrong chain" }
            identity.signUtf8(payload.canonical)
        }

        AsyncFunction("signProof") { challenge: String, nodeId: String, bestBlock: Long, checkpoint: String, votes: Int ->
            val identity = NodeIdentity()
            val public = identity.publicIdentity()
            require(nodeId == public.nodeId) { "Proof Node ID does not match device Node Identity" }
            require(bestBlock >= 0) { "Invalid proof block" }
            require(checkpoint.startsWith("$bestBlock:0x")) { "Proof checkpoint does not match block" }
            require(votes >= 2) { "Independent RPC agreement requires at least two votes" }
            require(challenge.isNotBlank()) { "Proof challenge is required" }
            val canonical = listOf(
                "zoryq-node-proof-v1",
                1,
                CHAIN_ID,
                nodeId,
                challenge,
                bestBlock,
                checkpoint,
                votes,
            ).joinToString("|")
            identity.signUtf8(canonical)
        }
    }

    private data class RegistrationPayload(
        val chainId: Long,
        val nodeId: String,
        val canonical: String,
    )

    private fun registrationSigningPayload(challenge: String): RegistrationPayload {
        val parts = challenge.split('.')
        require(parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) { "Malformed registration challenge" }
        val decoded = Base64.decode(
            parts[0],
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING,
        ).toString(Charsets.UTF_8)
        val json = JSONObject(decoded)
        val version = json.getInt("v")
        val chainId = json.getLong("chainId")
        val nodeId = json.getString("nodeId")
        val nonce = json.getString("nonce")
        val issuedAt = json.getLong("issuedAt")
        val expiresAt = json.getLong("expiresAt")
        require(version == 1) { "Unsupported registration protocol version" }
        require(nodeId.matches(Regex("^[0-9a-f]{64}$"))) { "Invalid registration Node ID" }
        require(nonce.isNotBlank()) { "Registration nonce is required" }
        require(expiresAt > issuedAt) { "Invalid registration challenge time window" }
        val canonical = listOf(
            "zoryq-node-registration-v1",
            version,
            chainId,
            nodeId,
            nonce,
            issuedAt,
            expiresAt,
        ).joinToString("|")
        return RegistrationPayload(chainId = chainId, nodeId = nodeId, canonical = canonical)
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
