package network.zoryq.wallet.migration

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.math.BigInteger

class NativeTransferTest {
    private val destination = "0x0000000000000000000000000000000000000001"

    @Test
    fun convertsOneZqToOneEtherUnit() {
        val transfer = NativeTransfer(destination, "1")
        assertNull(transfer.validate())
        assertEquals(BigInteger("1000000000000000000"), transfer.valueWei())
    }

    @Test
    fun supportsEighteenDecimals() {
        val transfer = NativeTransfer(destination, "0.000000000000000001")
        assertNull(transfer.validate())
        assertEquals(BigInteger.ONE, transfer.valueWei())
    }

    @Test
    fun rejectsInvalidAddressAndNonPositiveAmount() {
        assertNotNull(NativeTransfer("bad", "1").validate())
        assertNotNull(NativeTransfer(destination, "0").validate())
        assertNotNull(NativeTransfer(destination, "-1").validate())
    }
}
