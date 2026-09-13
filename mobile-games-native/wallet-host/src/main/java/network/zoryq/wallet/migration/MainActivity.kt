package network.zoryq.wallet.migration

import android.app.Activity
import android.os.Bundle
import android.widget.Toast
import network.zoryq.games.runtime.ZoryqGameBridge

class MainActivity : Activity() {
    private val rpc = ZoryqReadOnlyRpc()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            WalletMigrationView(this) { action ->
                if (action == WalletMigrationView.Action.OPEN_GAMES) {
                    ZoryqGameBridge.openHub(this)
                }
            }
        )

        rpc.fetchSnapshot { snapshot ->
            runOnUiThread {
                val message = if (
                    snapshot.online && snapshot.chainId == ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID
                ) {
                    "ZORYQ Testnet online • bloco ${snapshot.blockNumber ?: 0L}"
                } else if (snapshot.online) {
                    "RPC respondeu em chain ${snapshot.chainId ?: -1L}; esperado ${ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID}"
                } else {
                    "ZORYQ Testnet indisponível no momento"
                }
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        rpc.shutdown()
        super.onDestroy()
    }
}
