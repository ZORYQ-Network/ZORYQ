package network.zoryq.wallet.migration

import android.app.Activity
import android.os.Bundle
import network.zoryq.games.runtime.ZoryqGameBridge

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            WalletMigrationView(this) { action ->
                if (action == WalletMigrationView.Action.OPEN_GAMES) {
                    ZoryqGameBridge.openHub(this)
                }
            }
        )
    }
}
