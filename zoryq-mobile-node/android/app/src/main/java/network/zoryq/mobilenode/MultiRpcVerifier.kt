package network.zoryq.mobilenode

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MultiRpcVerifier(private val client: OkHttpClient) {
    data class Observation(val url: String, val blockNumber: Long, val blockHash: String, val parentHash: String)
    data class Result(val observations: List<Observation>, val checkpoint: String?, val votes: Int, val independentAgreement: Boolean)

    fun verify(endpoints: List<String>, chainIdExpected: Long): Result {
        val unique = endpoints.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
        val observations = unique.mapNotNull { endpoint -> runCatching { observe(endpoint, chainIdExpected) }.getOrNull() }
        val maxHeight = observations.maxOfOrNull { it.blockNumber }
        val nearTip = if (maxHeight == null) emptyList() else observations.filter { maxHeight - it.blockNumber <= 2 }
        val winner = nearTip.groupingBy { "${it.blockNumber}:${it.blockHash}" }.eachCount().maxByOrNull { it.value }
        val votes = winner?.value ?: 0
        return Result(observations, winner?.key, votes, unique.size >= 2 && votes >= 2)
    }

    private fun observe(url: String, chainIdExpected: Long): Observation {
        val chainHex = rpc(url, "eth_chainId", "[]").getString("result")
        val chainId = chainHex.removePrefix("0x").toLong(16)
        require(chainId == chainIdExpected) { "Chain ID mismatch: $chainId" }
        val block = rpc(url, "eth_getBlockByNumber", "[\"latest\",false]").getJSONObject("result")
        val blockNumber = block.getString("number").removePrefix("0x").toLong(16)
        val hash = block.getString("hash")
        val parentHash = block.getString("parentHash")
        require(hash.startsWith("0x") && hash.length >= 4) { "Missing block hash" }
        require(parentHash.startsWith("0x") && parentHash.length >= 4) { "Missing parent hash" }
        return Observation(url, blockNumber, hash, parentHash)
    }

    private fun rpc(url: String, method: String, paramsJson: String): JSONObject {
        val payload = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":$paramsJson}"
        val request = Request.Builder().url(url).post(payload.toRequestBody("application/json".toMediaType())).build()
        client.newCall(request).execute().use { response ->
            require(response.isSuccessful) { "HTTP ${response.code}" }
            val json = JSONObject(response.body?.string() ?: error("Empty RPC response"))
            require(!json.has("error")) { json.optJSONObject("error")?.optString("message") ?: "RPC error" }
            return json
        }
    }
}
