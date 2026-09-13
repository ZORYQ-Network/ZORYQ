package network.zoryq.wallet.migration

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ZoryqAddressTest {
    @Test
    fun validatesOnlyCanonicalLengthHexAddresses() {
        assertTrue(ZoryqAddress.isValid("0x0000000000000000000000000000000000000000"))
        assertTrue(ZoryqAddress.isValid("0xAbCdEf0123456789aBCdef0123456789abCDef01"))
        assertFalse(ZoryqAddress.isValid("0x1234"))
        assertFalse(ZoryqAddress.isValid("0xZZ00000000000000000000000000000000000000"))
        assertFalse(ZoryqAddress.isValid("seed phrase"))
    }

    @Test
    fun compactsPublicAddressWithoutChangingStoredValue() {
        val address = "0x1234567890abcdef1234567890abcdef12345678"
        assertEquals("0x123456…345678", ZoryqAddress.compact(address))
        assertEquals(address, ZoryqAddress.normalize("  $address  "))
    }
}
