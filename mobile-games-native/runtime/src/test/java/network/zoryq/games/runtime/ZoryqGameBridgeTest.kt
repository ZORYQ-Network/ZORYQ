package network.zoryq.games.runtime

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ZoryqGameBridgeTest {
    @Test
    fun bridgeKeysStayBoundedAndNonSecretByContract() {
        val allowed = listOf(
            ZoryqGameBridge.EXTRA_PUBLIC_ADDRESS,
            ZoryqGameBridge.EXTRA_PROFILE_ID,
            ZoryqGameBridge.EXTRA_SESSION_CAPABILITY
        )
        assertTrue(allowed.all { it.startsWith("zoryq.games.") })
        assertFalse(allowed.any { it.contains("private", true) || it.contains("seed", true) || it.contains("mnemonic", true) })
    }
}
