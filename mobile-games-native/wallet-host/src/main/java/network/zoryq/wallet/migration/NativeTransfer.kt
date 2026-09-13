package network.zoryq.wallet.migration

import java.math.BigDecimal
import java.math.BigInteger

/** Pure validation/conversion layer kept independent from Android for unit tests. */
data class NativeTransfer(val to: String, val amountZq: String) {
    fun normalizedTo(): String = ZoryqAddress.normalize(to)

    fun validate(): String? {
        if (!ZoryqAddress.isValid(normalizedTo())) return "Invalid destination address"
        val amount = amountZq.trim().toBigDecimalOrNull() ?: return "Invalid amount"
        if (amount <= BigDecimal.ZERO) return "Amount must be greater than zero"
        if (amount.scale().coerceAtLeast(0) > 18) return "Amount supports at most 18 decimals"
        return null
    }

    fun valueWei(): BigInteger {
        check(validate() == null) { validate() ?: "Invalid transfer" }
        return amountZq.trim().toBigDecimal()
            .movePointRight(18)
            .toBigIntegerExact()
    }
}
