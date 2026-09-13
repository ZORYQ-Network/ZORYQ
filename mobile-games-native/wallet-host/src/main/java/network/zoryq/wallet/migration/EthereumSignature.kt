package network.zoryq.wallet.migration

import org.web3j.crypto.Credentials
import org.web3j.crypto.Sign
import org.web3j.utils.Numeric

object EthereumSignature {
    fun personal(message: String, credentials: Credentials): String =
        encode(Sign.signPrefixedMessage(message.toByteArray(Charsets.UTF_8), credentials.ecKeyPair))

    fun typedData(json: String, credentials: Credentials): String =
        encode(Sign.signTypedData(json, credentials.ecKeyPair))

    internal fun encode(signature: Sign.SignatureData): String {
        val v = signature.v
        val out = ByteArray(signature.r.size + signature.s.size + v.size)
        System.arraycopy(signature.r, 0, out, 0, signature.r.size)
        System.arraycopy(signature.s, 0, out, signature.r.size, signature.s.size)
        System.arraycopy(v, 0, out, signature.r.size + signature.s.size, v.size)
        return Numeric.toHexString(out)
    }
}
