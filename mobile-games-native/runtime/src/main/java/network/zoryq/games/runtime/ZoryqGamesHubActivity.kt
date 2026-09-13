package network.zoryq.games.runtime

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager

/** Entry point designed for the Wallet -> Games handoff. */
open class ZoryqGamesHubActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(
            ZoryqGamesHubView(this) { gameId ->
                when (gameId) {
                    ZoryqGameBridge.GAME_RUSH -> startActivity(Intent(this, ZoryqRushActivity::class.java))
                    ZoryqGameBridge.GAME_ARENA -> startActivity(Intent(this, ZoryqArenaActivity::class.java))
                    else -> Unit
                }
            }
        )
    }
}
