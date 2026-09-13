package network.zoryq.wallet.migration

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HdWalletDerivationTest {
    private val mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    @Test
    fun validatesKnownBip39Mnemonic() {
        assertTrue(HdWalletDerivation.validateMnemonic(mnemonic))
    }

    @Test
    fun derivesKnownEthereumAccountAtStandardPath() {
        assertEquals(
            "0x9858effd232b4033e47d90003d41ec34ecaeda94",
            HdWalletDerivation.address(mnemonic).lowercase()
        )
    }

    @Test
    fun zeroEntropyGeneratesKnownTwelveWordMnemonic() {
        assertEquals(mnemonic, HdWalletDerivation.generate12WordMnemonic(ByteArray(16)))
    }
}
