package network.zoryq.mobilenode

enum class NodeMode(val intervalMs: Long) {
    ECO(60_000),
    BALANCED(30_000),
    MAX_CONTRIBUTION(15_000),
    PAUSED(Long.MAX_VALUE)
}
