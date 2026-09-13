package network.zoryq.wallet.migration

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.Toast
import network.zoryq.games.runtime.ZoryqGameBridge

class MainActivity : Activity() {
    private val rpc = ZoryqReadOnlyRpc()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        val migrationView = WalletMigrationView(this) { action ->
            if (action == WalletMigrationView.Action.OPEN_GAMES) {
                ZoryqGameBridge.openHub(this)
            }
        }
        root.addView(
            migrationView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )

        val watchButton = Button(this).apply {
            text = "WATCH WALLET"
            textSize = 11f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(35, 45, 91))
            setOnClickListener {
                startActivity(Intent(this@MainActivity, WatchOnlyWalletActivity::class.java))
            }
        }
        val density = resources.displayMetrics.density
        root.addView(
            watchButton,
            FrameLayout.LayoutParams((142 * density).toInt(), (42 * density).toInt()).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = (92 * density).toInt()
                marginEnd = (18 * density).toInt()
            }
        )
        setContentView(root)

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
