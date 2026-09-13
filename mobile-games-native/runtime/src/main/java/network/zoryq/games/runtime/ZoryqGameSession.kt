package network.zoryq.games.runtime

import java.util.UUID

/** Creates local, non-authoritative session evidence for host-side verification. */
class ZoryqGameSession(private val gameId: String) {
    val sessionId: String = UUID.randomUUID().toString()
    private val startedAtEpochMs: Long = System.currentTimeMillis()

    fun result(score: Long, metadata: Map<String, String> = emptyMap()): ZoryqGameResult {
        val completedAt = System.currentTimeMillis()
        return ZoryqGameResult(
            gameId = gameId,
            sessionId = sessionId,
            score = score,
            durationMs = (completedAt - startedAtEpochMs).coerceAtLeast(0L),
            completedAtEpochMs = completedAt,
            metadata = metadata
        )
    }
}
