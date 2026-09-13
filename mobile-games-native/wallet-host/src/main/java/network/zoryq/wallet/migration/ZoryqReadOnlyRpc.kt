package network.zoryq.wallet.migration

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Read-only JSON-RPC client for the public ZORYQ Testnet.
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

    data class AccountSnapshot(
        val address: String,
        val online: Boolean,
        val balanceWei: BigInteger?,
        val balanceZq: String?,
        val nonce: Long?,
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

    fun fetchAccount(address: String, callback: (AccountSnapshot) -> Unit) {
        val normalized = ZoryqAddress.normalize(address)
        if (!ZoryqAddress.isValid(normalized)) {
            callback(AccountSnapshot(normalized, false, null, null, null, "Invalid EVM address"))
            return
        }

        executor.execute {
            val result = runCatching {
                val balanceHex = call("eth_getBalance", JSONArray().put(normalized).put("latest"))
                val nonceHex = call("eth_getTransactionCount", JSONArray().put(normalized).put("latest"))
                val balanceWei = balanceHex.hexToBigInteger()
                val nonce = nonceHex.removePrefix("0x").ifEmpty { "0" }.toLong(16)
                AccountSnapshot(
                    address = normalized,
                    online = true,
                    balanceWei = balanceWei,
                    balanceZq = formatNative(balanceWei),
                    nonce = nonce
                )
            }.getOrElse { error ->
                AccountSnapshot(normalized, false, null, null, null, error.message ?: error.javaClass.simpleName)
            }
            callback(result)
        }
    }

    fun shutdown() {
        executor.shutdownNow()
    }

    private fun call(method: String, params: JSONArray = JSONArray()): String {
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
            .put("params", params)
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
        private val WEI_PER_ZQ = BigDecimal("1000000000000000000")

        internal fun String.hexToBigInteger(): BigInteger =
            removePrefix("0x").ifEmpty { "0" }.let { BigInteger(it, 16) }

        internal fun formatNative(wei: BigInteger): String =
            BigDecimal(wei)
                .divide(WEI_PER_ZQ, 6, RoundingMode.DOWN)
                .stripTrailingZeros()
                .toPlainString()
    }
}
