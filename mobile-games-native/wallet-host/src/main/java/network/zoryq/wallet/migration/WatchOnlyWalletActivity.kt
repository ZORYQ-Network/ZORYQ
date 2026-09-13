package network.zoryq.wallet.migration

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Safe migration step: watches a public address only.
 * No seed phrase, private key, signing or transaction submission is implemented here.
 */
class WatchOnlyWalletActivity : Activity() {
    private val rpc = ZoryqReadOnlyRpc()
    private val prefs by lazy { getSharedPreferences("zoryq_watch_only", MODE_PRIVATE) }

    private lateinit var addressInput: EditText
    private lateinit var statusText: TextView
    private lateinit var balanceText: TextView
    private lateinit var nonceText: TextView
    private lateinit var addressText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        prefs.getString(KEY_ADDRESS, null)?.let {
            addressInput.setText(it)
            refreshAccount(it)
        }
        refreshNetwork()
    }

    private fun buildContent(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.rgb(4, 6, 18))
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(34), dp(24), dp(34))
        }
        scroll.addView(root, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        root.addView(label("ZORYQ", 30f, Color.WHITE))
        root.addView(label("WALLET • WATCH-ONLY", 14f, Color.rgb(103, 236, 255)).apply {
            setPadding(0, dp(2), 0, dp(24))
        })

        statusText = label("Verificando ZORYQ Testnet…", 14f, Color.rgb(172, 184, 215))
        root.addView(panel(statusText, dp(16)))

        root.addView(label("Endereço público", 14f, Color.rgb(150, 164, 202)).apply {
            setPadding(0, dp(22), 0, dp(8))
        })

        addressInput = EditText(this).apply {
            hint = "0x…"
            setHintTextColor(Color.rgb(90, 103, 140))
            setTextColor(Color.WHITE)
            setSingleLine(true)
            textSize = 15f
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            setPadding(dp(14), dp(12), dp(14), dp(12))
            setBackgroundColor(Color.rgb(14, 19, 42))
        }
        root.addView(addressInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(14), 0, dp(20))
        }
        val save = Button(this).apply {
            text = "SALVAR E ATUALIZAR"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(70, 68, 196))
            setOnClickListener {
                val address = ZoryqAddress.normalize(addressInput.text.toString())
                if (!ZoryqAddress.isValid(address)) {
                    statusText.text = "Endereço EVM inválido"
                    statusText.setTextColor(Color.rgb(255, 115, 150))
                    return@setOnClickListener
                }
                prefs.edit().putString(KEY_ADDRESS, address).apply()
                refreshAccount(address)
            }
        }
        val clear = Button(this).apply {
            text = "LIMPAR"
            setTextColor(Color.rgb(183, 190, 218))
            setBackgroundColor(Color.rgb(20, 25, 52))
            setOnClickListener {
                prefs.edit().remove(KEY_ADDRESS).apply()
                addressInput.setText("")
                addressText.text = "Nenhum endereço salvo"
                balanceText.text = "— ZQ"
                nonceText.text = "Nonce —"
            }
        }
        actions.addView(save, LinearLayout.LayoutParams(0, dp(50), 1f).apply { marginEnd = dp(8) })
        actions.addView(clear, LinearLayout.LayoutParams(0, dp(50), 0.48f))
        root.addView(actions)

        addressText = label("Nenhum endereço salvo", 14f, Color.rgb(136, 226, 255))
        balanceText = label("— ZQ", 38f, Color.WHITE).apply { setPadding(0, dp(10), 0, dp(4)) }
        nonceText = label("Nonce —", 13f, Color.rgb(151, 163, 197))
        val accountBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            setBackgroundColor(Color.rgb(10, 15, 34))
            addView(label("SALDO NA ZORYQ TESTNET", 12f, Color.rgb(151, 164, 200)))
            addView(balanceText)
            addView(addressText)
            addView(nonceText)
        }
        root.addView(accountBox, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        root.addView(label("MODO SEGURO DE MIGRAÇÃO", 13f, Color.rgb(255, 202, 104)).apply {
            setPadding(0, dp(26), 0, dp(8))
        })
        root.addView(label(
            "Esta tela apenas consulta dados públicos da blockchain. Não importa seed, não armazena private key, não assina e não envia transações.",
            14f,
            Color.rgb(183, 190, 216)
        ))

        return scroll
    }

    private fun refreshNetwork() {
        rpc.fetchSnapshot { snapshot ->
            runOnUiThread {
                if (snapshot.online && snapshot.chainId == ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID) {
                    statusText.text = "● ZORYQ Testnet online • bloco ${snapshot.blockNumber ?: 0L}"
                    statusText.setTextColor(Color.rgb(105, 244, 177))
                } else if (snapshot.online) {
                    statusText.text = "Chain ID inesperado: ${snapshot.chainId}"
                    statusText.setTextColor(Color.rgb(255, 190, 95))
                } else {
                    statusText.text = "ZORYQ Testnet offline/indisponível"
                    statusText.setTextColor(Color.rgb(255, 115, 150))
                }
            }
        }
    }

    private fun refreshAccount(address: String) {
        statusText.text = "Consultando ${ZoryqAddress.compact(address)}…"
        rpc.fetchAccount(address) { account ->
            runOnUiThread {
                if (account.online) {
                    addressText.text = ZoryqAddress.compact(account.address)
                    balanceText.text = "${account.balanceZq ?: "0"} ZQ"
                    nonceText.text = "Nonce ${account.nonce ?: 0L}"
                    statusText.text = "● Dados atualizados pela ZORYQ Testnet"
                    statusText.setTextColor(Color.rgb(105, 244, 177))
                } else {
                    statusText.text = account.error ?: "Falha ao consultar endereço"
                    statusText.setTextColor(Color.rgb(255, 115, 150))
                }
            }
        }
    }

    private fun label(value: String, size: Float, color: Int): TextView = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }

    private fun panel(child: TextView, padding: Int): LinearLayout = LinearLayout(this).apply {
        setPadding(padding, padding, padding, padding)
        setBackgroundColor(Color.rgb(10, 15, 34))
        addView(child)
    }

    override fun onDestroy() {
        rpc.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val KEY_ADDRESS = "public_address"
    }
}
