package network.zoryq.mobilenode

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.util.Base64

object NodeIdentity {
    private const val KEY_ALIAS = "zoryq_mobile_node_identity_v1"

    private fun keyStore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun ensureKey() {
        val ks = keyStore()
        if (ks.containsAlias(KEY_ALIAS)) return
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        )
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
            .setUserAuthenticationRequired(false)
            .build()
        generator.initialize(spec)
        generator.generateKeyPair()
    }

    fun publicKeyBase64(): String {
        ensureKey()
        val cert = keyStore().getCertificate(KEY_ALIAS)
        return Base64.getEncoder().encodeToString(cert.publicKey.encoded)
    }

    fun nodeId(): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(Base64.getDecoder().decode(publicKeyBase64()))
        return "zq-" + digest.take(12).joinToString("") { "%02x".format(it) }
    }

    fun sign(payload: ByteArray): String {
        ensureKey()
        val entry = keyStore().getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(entry.privateKey)
        signature.update(payload)
        return Base64.getEncoder().encodeToString(signature.sign())
    }
}
