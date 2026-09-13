package network.zoryq.wallet.migration

import org.json.JSONArray
import org.json.JSONObject
import org.web3j.crypto.Credentials
import org.web3j.crypto.RawTransaction
import org.web3j.crypto.TransactionEncoder
import org.web3j.utils.Numeric
import java.io.BufferedReader
import java.io.InputStreamReader
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ZoryqTransactionRpc(
    private val rpcUrl: String = ZoryqReadOnlyRpc.DEFAULT_RPC
) {
    data class FeeContext(
        val nonce: BigInteger,
        val gasPriceWei: BigInteger,
        val gasLimit: BigInteger = BigInteger.valueOf(21_000L)
    )

    data class SendResult(val txHash: String?, val error: String?) {
        val success: Boolean get() = !txHash.isNullOrBlank() && error == null
    }

    private val executor = Executors.newSingleThreadExecutor()

    fun fetchFeeContext(address: String, callback: (Result<FeeContext>) -> Unit) {
        val normalized = ZoryqAddress.normalize(address)
        if (!ZoryqAddress.isValid(normalized)) {
            callback(Result.failure(IllegalArgumentException("Invalid sender address")))
            return
        }
        executor.execute {
            callback(runCatching {
                val nonce = call("eth_getTransactionCount", JSONArray().put(normalized).put("pending")).hexBigInt()
                val gasPrice = call("eth_gasPrice").hexBigInt()
                FeeContext(nonce = nonce, gasPriceWei = gasPrice)
            })
        }
    }

    /**
     * Signs synchronously so Credentials never escape the protected Keystore
     * scope in SecureWalletStore.withCredentials().
     */
    fun signTransfer(
        transfer: NativeTransfer,
        fee: FeeContext,
        credentials: Credentials
    ): String {
        transfer.validate()?.let { error(it) }
        val raw = RawTransaction.createEtherTransaction(
            fee.nonce,
            fee.gasPriceWei,
            fee.gasLimit,
            transfer.normalizedTo(),
            transfer.valueWei()
        )
        val signed = TransactionEncoder.signMessage(
            raw,
            ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID,
            credentials
        )
        return Numeric.toHexString(signed)
    }

    fun broadcastSigned(rawTransactionHex: String, callback: (SendResult) -> Unit) {
        require(rawTransactionHex.startsWith("0x")) { "Signed transaction must be hex encoded" }
        executor.execute {
            val result = runCatching {
                call("eth_sendRawTransaction", JSONArray().put(rawTransactionHex))
            }.fold(
                onSuccess = { SendResult(it, null) },
                onFailure = { SendResult(null, it.message ?: it.javaClass.simpleName) }
            )
            callback(result)
        }
    }

    fun shutdown() = executor.shutdownNow()

    private fun call(method: String, params: JSONArray = JSONArray()): String {
        val connection = (URL(rpcUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 7_000
            readTimeout = 10_000
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
        connection.outputStream.use { it.write(request.toByteArray(Charsets.UTF_8)) }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        connection.disconnect()
        if (status !in 200..299) error("RPC HTTP $status")
        val json = JSONObject(body)
        if (json.has("error")) error(json.getJSONObject("error").optString("message", "RPC error"))
        return json.getString("result")
    }

    private fun String.hexBigInt(): BigInteger =
        removePrefix("0x").ifEmpty { "0" }.let { BigInteger(it, 16) }
}
