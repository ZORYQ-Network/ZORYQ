package network.zoryq.wallet.migration

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Read-only JSON-RPC probe for the public ZORYQ Testnet.
 *
 * This class has no signing method and accepts no private key material.
 */
class ZoryqReadOnlyRpc(
    private val rpcUrl: String = DEFAULT_RPC
) {
    data class NetworkSnapshot(
        val online: Boolean,
        val chainId: Long?,
        val blockNumber: Long?,
        val error: String? = null
    )

    private val executor = Executors.newSingleThreadExecutor()

    fun fetchSnapshot(callback: (NetworkSnapshot) -> Unit) {
        executor.execute {
            val result = runCatching {
                val chainIdHex = call("eth_chainId")
                val blockHex = call("eth_blockNumber")
                val chainId = chainIdHex.removePrefix("0x").toLong(16)
                val blockNumber = blockHex.removePrefix("0x").toLong(16)
                NetworkSnapshot(true, chainId, blockNumber)
            }.getOrElse { error ->
                NetworkSnapshot(false, null, null, error.message ?: error.javaClass.simpleName)
            }
            callback(result)
        }
    }

    fun shutdown() {
        executor.shutdownNow()
    }

    private fun call(method: String): String {
        val connection = (URL(rpcUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 5_000
            readTimeout = 5_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }

        val request = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", 1)
            .put("method", method)
            .put("params", org.json.JSONArray())
            .toString()

        connection.outputStream.use { out ->
            out.write(request.toByteArray(Charsets.UTF_8))
        }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        connection.disconnect()

        if (status !in 200..299) error("RPC HTTP $status")
        val json = JSONObject(body)
        if (json.has("error")) error(json.getJSONObject("error").optString("message", "RPC error"))
        return json.getString("result")
    }

    companion object {
        const val EXPECTED_CHAIN_ID = 5_919_065L
        const val DEFAULT_RPC = "https://zoryq-evm-node-live-production.up.railway.app/rpc"
    }
}
