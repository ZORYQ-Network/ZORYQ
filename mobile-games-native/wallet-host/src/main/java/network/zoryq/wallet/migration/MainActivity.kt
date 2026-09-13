package network.zoryq.wallet.migration

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
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

        val density = resources.displayMetrics.density
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
        }
        actions.addView(topButton("WATCH") {
            startActivity(Intent(this, WatchOnlyWalletActivity::class.java))
        })
        actions.addView(topButton("SECURE") {
            startActivity(Intent(this, SecureWalletActivity::class.java))
        })
        actions.addView(topButton("SOCIAL") {
            startActivity(Intent(this, SocialActivity::class.java))
        })
        root.addView(
            actions,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, (44 * density).toInt()).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = (92 * density).toInt()
                marginEnd = (12 * density).toInt()
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

    private fun topButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 9f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(35, 45, 91))
        setOnClickListener { action() }
    }

    override fun onDestroy() {
        rpc.shutdown()
        super.onDestroy()
    }
}
