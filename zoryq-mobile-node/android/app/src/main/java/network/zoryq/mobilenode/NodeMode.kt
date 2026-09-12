package network.zoryq.mobilenode

enum class NodeMode(val intervalMs: Long) {
    ECO(60_000),
    BALANCED(30_000),
    MAX_CONTRIBUTION(15_000),
    PAUSED(60_000);

    companion object {
        fun fromPreference(value: String?): NodeMode = entries.firstOrNull { it.name == value } ?: BALANCED
    }
}
