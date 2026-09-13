package network.zoryq.wallet.migration

import org.web3j.crypto.Bip32ECKeyPair
import org.web3j.crypto.Credentials
import org.web3j.crypto.MnemonicUtils

/**
 * Deterministic Ethereum-compatible account derivation used by ZORYQ Wallet.
 * Path: m/44'/60'/0'/0/0
 */
object HdWalletDerivation {
    const val PATH = "m/44'/60'/0'/0/0"

    private val derivationPath = intArrayOf(
        44 or Bip32ECKeyPair.HARDENED_BIT,
        60 or Bip32ECKeyPair.HARDENED_BIT,
        0 or Bip32ECKeyPair.HARDENED_BIT,
        0,
        0
    )

    fun validateMnemonic(mnemonic: String): Boolean =
        MnemonicUtils.validateMnemonic(normalizeMnemonic(mnemonic))

    fun credentials(mnemonic: String): Credentials {
        val normalized = normalizeMnemonic(mnemonic)
        require(MnemonicUtils.validateMnemonic(normalized)) { "Invalid BIP-39 recovery phrase" }
        val seed = MnemonicUtils.generateSeed(normalized, "")
        return try {
            val master = Bip32ECKeyPair.generateKeyPair(seed)
            val derived = Bip32ECKeyPair.deriveKeyPair(master, derivationPath)
            Credentials.create(derived)
        } finally {
            seed.fill(0)
        }
    }

    fun address(mnemonic: String): String = credentials(mnemonic).address

    fun generate12WordMnemonic(entropy: ByteArray): String {
        require(entropy.size == 16) { "12-word BIP-39 wallets require 128-bit entropy" }
        return MnemonicUtils.generateMnemonic(entropy)
    }

    fun normalizeMnemonic(value: String): String =
        value.trim().lowercase().split(Regex("\\s+")).joinToString(" ")
}
