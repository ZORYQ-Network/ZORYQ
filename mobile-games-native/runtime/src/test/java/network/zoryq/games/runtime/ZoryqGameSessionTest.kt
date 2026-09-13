package network.zoryq.games.runtime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ZoryqGameSessionTest {
    @Test
    fun resultKeepsBoundedPublicGameplayEvidence() {
        val session = ZoryqGameSession(ZoryqGameBridge.GAME_RUSH)
        val result = session.result(1234L, mapOf("mode" to "alpha"))

        assertEquals(ZoryqGameBridge.GAME_RUSH, result.gameId)
        assertEquals(1234L, result.score)
        assertEquals("alpha", result.metadata["mode"])
        assertTrue(result.sessionId.isNotBlank())
        assertTrue(result.durationMs >= 0L)
    }
}
