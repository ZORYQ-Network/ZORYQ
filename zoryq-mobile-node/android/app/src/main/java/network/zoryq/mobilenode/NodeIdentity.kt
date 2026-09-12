package network.zoryq.mobilenode

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * Device-scoped cryptographic identity for the Mobile Witness Node.
 *
 * This key is deliberately separate from Wallet Identity. It is generated in
 * AndroidKeyStore, is non-exportable, and MUST NOT be used for wallet signing,
 * funds, seed derivation, or consensus-validator duties.
 */
class NodeIdentity {
    companion object {
        private const val KEYSTORE = "AndroidKeyStore"
        private const val ALIAS = "zoryq.mobile.node.identity.v1"
        private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
    }

    data class PublicIdentity(
        val nodeId: String,
        val publicKeyBase64: String,
        val hardwareBacked: Boolean,
        val keyAlias: String = ALIAS,
        val algorithm: String = SIGNATURE_ALGORITHM,
    )

    private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    @Synchronized
    private fun ensureKey() {
        val store = keyStore()
        if (store.containsAlias(ALIAS)) return

        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            ALIAS,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
        )
            .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
            .setDigests(KeyProperties.DIGEST_SHA256)
            .setUserAuthenticationRequired(false)
            .build()
        generator.initialize(spec)
        generator.generateKeyPair()
    }

    fun publicIdentity(): PublicIdentity {
        ensureKey()
        val store = keyStore()
        val certificate = requireNotNull(store.getCertificate(ALIAS)) { "Node public key unavailable" }
        val encoded = certificate.publicKey.encoded
        val digest = MessageDigest.getInstance("SHA-256").digest(encoded)
        val nodeId = digest.joinToString("") { "%02x".format(it) }
        val publicKeyBase64 = Base64.encodeToString(encoded, Base64.NO_WRAP)

        val hardwareBacked = runCatching {
            val privateKey = requireNotNull(store.getKey(ALIAS, null))
            val factory = KeyFactory.getInstance(privateKey.algorithm, KEYSTORE)
            val keyInfo = factory.getKeySpec(privateKey, KeyInfo::class.java)
            keyInfo.isInsideSecureHardware
        }.getOrDefault(false)

        return PublicIdentity(
            nodeId = nodeId,
            publicKeyBase64 = publicKeyBase64,
            hardwareBacked = hardwareBacked,
        )
    }

    fun signUtf8(payload: String): String {
        require(payload.isNotBlank()) { "Refusing to sign an empty node payload" }
        ensureKey()
        val store = keyStore()
        val privateKey = requireNotNull(store.getKey(ALIAS, null)) { "Node private key unavailable" }
        val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
        signature.initSign(privateKey as java.security.PrivateKey)
        signature.update(payload.toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
    }
}
