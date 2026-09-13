package network.zoryq.games.runtime

/**
 * Non-secret gameplay evidence that a host may inspect.
 * This is not a token entitlement and contains no signing key material.
 */
data class ZoryqGameResult(
    val gameId: String,
    val sessionId: String,
    val score: Long,
    val durationMs: Long,
    val completedAtEpochMs: Long,
    val metadata: Map<String, String> = emptyMap()
)
