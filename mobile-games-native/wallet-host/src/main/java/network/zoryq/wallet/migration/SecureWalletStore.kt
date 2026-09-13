package network.zoryq.wallet.migration

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.web3j.crypto.Credentials
import org.web3j.crypto.ECKeyPair
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric
import java.math.BigInteger
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Local key lifecycle for the ZORYQ Testnet wallet.
 *
 * New wallets use BIP-39 recovery phrases and Ethereum-compatible BIP-44
 * derivation (m/44'/60'/0'/0/0). The recovery phrase is encrypted at rest with
 * AES-GCM using a wrapping key held by AndroidKeyStore. Existing seedless
 * wallets created by the earlier migration build remain readable for testnet
 * compatibility, but they are explicitly marked non-recoverable.
 *
 * No seed, mnemonic or private key is exposed to Games or Social.
 */
class SecureWalletStore(private val context: Context) {
    data class WalletIdentity(val address: String)
    data class RecoveryBundle(val identity: WalletIdentity, val mnemonic: String)

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun exists(): Boolean = prefs.contains(KEY_CIPHERTEXT) && prefs.contains(KEY_IV)

    fun identity(): WalletIdentity? =
        prefs.getString(KEY_ADDRESS, null)?.let(::WalletIdentity)

    fun isRecoverable(): Boolean = exists() && mode() == MODE_MNEMONIC

    /** Creates a fresh 12-word BIP-39 wallet. The phrase should be shown once for backup. */
    @Synchronized
    fun createRecoverable(): RecoveryBundle {
        check(!exists()) { "A protected wallet already exists on this installation" }
        val entropy = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val mnemonic = try {
            HdWalletDerivation.generate12WordMnemonic(entropy)
        } finally {
            entropy.fill(0)
        }
        val credentials = HdWalletDerivation.credentials(mnemonic)
        val identity = WalletIdentity(credentials.address)
        val secret = mnemonic.toByteArray(Charsets.UTF_8)
        try {
            persistSecret(secret, identity.address, MODE_MNEMONIC)
        } finally {
            secret.fill(0)
        }
        return RecoveryBundle(identity, mnemonic)
    }

    /** Imports a valid BIP-39 phrase using the fixed Ethereum BIP-44 account path. */
    @Synchronized
    fun importMnemonic(value: String): WalletIdentity {
        check(!exists()) { "Delete the existing local wallet before importing another one" }
        val mnemonic = HdWalletDerivation.normalizeMnemonic(value)
        require(HdWalletDerivation.validateMnemonic(mnemonic)) { "Invalid BIP-39 recovery phrase" }
        val credentials = HdWalletDerivation.credentials(mnemonic)
        val identity = WalletIdentity(credentials.address)
        val secret = mnemonic.toByteArray(Charsets.UTF_8)
        try {
            persistSecret(secret, identity.address, MODE_MNEMONIC)
        } finally {
            secret.fill(0)
        }
        return identity
    }

    /**
     * Reveals the BIP-39 phrase only when the caller deliberately asks for it.
     * UI code must place an additional confirmation immediately before calling.
     */
    @Synchronized
    fun revealRecoveryPhrase(): String? {
        if (!isRecoverable()) return null
        val raw = decryptSecret()
        return try {
            String(raw, Charsets.UTF_8)
        } finally {
            raw.fill(0)
        }
    }

    /**
     * Executes [block] while credentials are available in memory. Callers must
     * only invoke this after explicit user confirmation for sensitive actions.
     */
    @Synchronized
    fun <T> withCredentials(block: (Credentials) -> T): T {
        check(exists()) { "No protected wallet exists" }
        val raw = decryptSecret()
        return try {
            val credentials = if (mode() == MODE_MNEMONIC) {
                HdWalletDerivation.credentials(String(raw, Charsets.UTF_8))
            } else {
                val pair = ECKeyPair.create(BigInteger(1, raw))
                Credentials.create(pair)
            }
            block(credentials)
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

    private fun mode(): String = prefs.getString(KEY_MODE, MODE_LEGACY_KEY) ?: MODE_LEGACY_KEY

    private fun persistSecret(secret: ByteArray, address: String, mode: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateWrappingKey())
        val ciphertext = cipher.doFinal(secret)
        prefs.edit()
            .putString(KEY_ADDRESS, address)
            .putString(KEY_MODE, mode)
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString(KEY_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .apply()
    }

    private fun decryptSecret(): ByteArray {
        val iv = Base64.decode(prefs.getString(KEY_IV, ""), Base64.NO_WRAP)
        val ciphertext = Base64.decode(prefs.getString(KEY_CIPHERTEXT, ""), Base64.NO_WRAP)
        return Cipher.getInstance(TRANSFORMATION).run {
            init(Cipher.DECRYPT_MODE, getOrCreateWrappingKey(), GCMParameterSpec(128, iv))
            doFinal(ciphertext)
        }
    }

    private fun getOrCreateWrappingKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val builder = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            builder.setUnlockedDeviceRequired(true)
        }

        generator.init(builder.build())
        return generator.generateKey()
    }

    companion object {
        private const val PREFS = "zoryq_secure_wallet_v1"
        private const val KEY_ALIAS = "zoryq.wallet.wrap.v1"
        private const val KEY_ADDRESS = "address"
        private const val KEY_MODE = "mode"
        private const val KEY_IV = "iv"
        private const val KEY_CIPHERTEXT = "ciphertext"
        private const val MODE_MNEMONIC = "bip39-mnemonic-v1"
        private const val MODE_LEGACY_KEY = "legacy-private-key-v1"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
