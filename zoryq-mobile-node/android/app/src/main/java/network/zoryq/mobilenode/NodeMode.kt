package network.zoryq.mobilenode

enum class NodeMode(val intervalMs: Long) {
    ECO(60_000),
    BALANCED(20_000),
    ACTIVE(8_000)
}
