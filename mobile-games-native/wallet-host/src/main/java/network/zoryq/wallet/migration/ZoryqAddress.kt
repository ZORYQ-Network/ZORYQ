package network.zoryq.wallet.migration

object ZoryqAddress {
    private val evmAddress = Regex("^0x[0-9a-fA-F]{40}$")

    fun normalize(value: String): String = value.trim()

    fun isValid(value: String): Boolean = evmAddress.matches(normalize(value))

    fun compact(value: String): String {
        val normalized = normalize(value)
        if (!isValid(normalized)) return normalized
        return normalized.take(8) + "…" + normalized.takeLast(6)
    }
}
