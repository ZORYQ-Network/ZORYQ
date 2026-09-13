package network.zoryq.wallet.migration

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.web3j.crypto.Credentials
import org.web3j.crypto.ECKeyPair
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric
import java.math.BigInteger
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Local key lifecycle for the ZORYQ Testnet wallet.
 *
 * The secp256k1 private key is generated locally, immediately encrypted with an
 * AES-GCM key held by AndroidKeyStore, and only decrypted in memory for an
 * explicit signing operation. Raw private-key bytes are never persisted.
 *
 * This is intentionally seedless in this migration stage: there is no mnemonic
 * export/import surface that could leak recovery material into logs, games or
 * the social layer.
 */
class SecureWalletStore(private val context: Context) {
    data class WalletIdentity(val address: String)

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun exists(): Boolean = prefs.contains(KEY_CIPHERTEXT) && prefs.contains(KEY_IV)

    fun identity(): WalletIdentity? =
        prefs.getString(KEY_ADDRESS, null)?.let(::WalletIdentity)

    @Synchronized
    fun create(): WalletIdentity {
        check(!exists()) { "A protected wallet already exists on this installation" }
        val pair = Keys.createEcKeyPair()
        val privateBytes = Numeric.toBytesPadded(pair.privateKey, 32)
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateWrappingKey())
            val ciphertext = cipher.doFinal(privateBytes)
            val address = "0x${Keys.getAddress(pair)}"
            prefs.edit()
                .putString(KEY_ADDRESS, address)
                .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
                .putString(KEY_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .apply()
            WalletIdentity(address)
        } finally {
            privateBytes.fill(0)
        }
    }

    /**
     * Executes [block] while credentials are available in memory. Callers must
     * only invoke this after an explicit user confirmation UI.
     */
    @Synchronized
    fun <T> withCredentials(block: (Credentials) -> T): T {
        check(exists()) { "No protected wallet exists" }
        val iv = Base64.decode(prefs.getString(KEY_IV, ""), Base64.NO_WRAP)
        val ciphertext = Base64.decode(prefs.getString(KEY_CIPHERTEXT, ""), Base64.NO_WRAP)
        val raw = Cipher.getInstance(TRANSFORMATION).run {
            init(Cipher.DECRYPT_MODE, getOrCreateWrappingKey(), GCMParameterSpec(128, iv))
            doFinal(ciphertext)
        }
        return try {
            val pair = ECKeyPair.create(BigInteger(1, raw))
            block(Credentials.create(pair))
        } finally {
            raw.fill(0)
        }
    }

    @Synchronized
    fun delete() {
        prefs.edit().clear().apply()
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS)
    }

    private fun getOrCreateWrappingKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    companion object {
        private const val PREFS = "zoryq_secure_wallet_v1"
        private const val KEY_ALIAS = "zoryq.wallet.wrap.v1"
        private const val KEY_ADDRESS = "address"
        private const val KEY_IV = "iv"
        private const val KEY_CIPHERTEXT = "ciphertext"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
