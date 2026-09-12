package network.zoryq.mobilenode

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object MobileNodeApi {
    private const val BASE = "https://zoryq-wallet-swap-production.up.railway.app"
    private val JSON = "application/json".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    data class TaskChallenge(
        val id: String,
        val nonce: String,
        val chainId: Long,
        val targetBlock: Long,
        val issuedAt: String,
        val expiresAt: String
    )

    data class ProofReceipt(
        val xpAwarded: Long,
        val totalXp: Long,
        val proofHash: String,
        val eventId: String
    )

    fun register(nodeId: String, publicKey: String) {
        val challenge = post("/mobile-node/registration-challenge", JSONObject()
            .put("nodeId", nodeId)
            .put("publicKey", publicKey))
        val challengeId = challenge.getString("id")
        val registrationPayload = challenge.getString("registrationPayload")
        val signature = NodeIdentity.sign(registrationPayload.toByteArray(Charsets.UTF_8))
        post("/mobile-node/register", JSONObject()
            .put("challengeId", challengeId)
            .put("nodeId", nodeId)
            .put("publicKey", publicKey)
            .put("signature", signature))
    }

    fun challenge(nodeId: String): TaskChallenge {
        val j = post("/mobile-node/challenge", JSONObject().put("nodeId", nodeId))
        return TaskChallenge(
            id = j.getString("id"),
            nonce = j.getString("nonce"),
            chainId = j.getLong("chainId"),
            targetBlock = j.getLong("targetBlock"),
            issuedAt = j.getString("issuedAt"),
            expiresAt = j.getString("expiresAt")
        )
    }

    fun submitProof(
        challenge: TaskChallenge,
        nodeId: String,
        blockHash: String,
        parentHash: String,
        observedAt: String
    ): ProofReceipt {
        val payload = listOf(
            "zoryq-mobile-proof-v1",
            challenge.id,
            challenge.nonce,
            nodeId,
            challenge.chainId.toString(),
            challenge.targetBlock.toString(),
            blockHash,
            parentHash,
            observedAt
        ).joinToString("|")
        val signature = NodeIdentity.sign(payload.toByteArray(Charsets.UTF_8))
        val j = post("/mobile-node/proof", JSONObject()
            .put("challengeId", challenge.id)
            .put("nonce", challenge.nonce)
            .put("nodeId", nodeId)
            .put("chainId", challenge.chainId)
            .put("blockNumber", challenge.targetBlock)
            .put("blockHash", blockHash)
            .put("parentHash", parentHash)
            .put("observedAt", observedAt)
            .put("signature", signature))
        return ProofReceipt(
            xpAwarded = j.getLong("xpAwarded"),
            totalXp = j.getLong("totalXp"),
            proofHash = j.getString("proofHash"),
            eventId = j.getString("eventId")
        )
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url(BASE + path)
            .post(body.toString().toRequestBody(JSON))
            .build()
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val json = try { JSONObject(raw) } catch (_: Exception) { JSONObject().put("error", "INVALID_BACKEND_RESPONSE") }
            if (!response.isSuccessful || json.optBoolean("ok", false) != true) {
                throw IllegalStateException(json.optString("error", "BACKEND_HTTP_${response.code}"))
            }
            return json
        }
    }
}
