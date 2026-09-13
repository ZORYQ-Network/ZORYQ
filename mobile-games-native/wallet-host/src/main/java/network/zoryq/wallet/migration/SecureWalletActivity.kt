package network.zoryq.wallet.migration

import android.app.Activity
import android.app.AlertDialog
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
import android.widget.Toast
import java.math.BigDecimal

class SecureWalletActivity : Activity() {
    private lateinit var store: SecureWalletStore
    private val readRpc = ZoryqReadOnlyRpc()
    private val txRpc = ZoryqTransactionRpc()

    private lateinit var addressText: TextView
    private lateinit var balanceText: TextView
    private lateinit var statusText: TextView
    private lateinit var recipientInput: EditText
    private lateinit var amountInput: EditText
    private lateinit var createButton: Button
    private lateinit var deleteButton: Button
    private lateinit var sendButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SecureWalletStore(this)
        setContentView(buildUi())
        refreshIdentity()
    }

    private fun buildUi(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(32))
            setBackgroundColor(Color.rgb(5, 8, 22))
        }

        root.addView(TextView(this).apply {
            text = "ZORYQ SECURE WALLET"
            textSize = 23f
            setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = "ZORYQ Testnet • Chain ID ${ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID}"
            textSize = 13f
            setTextColor(Color.rgb(93, 230, 255))
            setPadding(0, dp(6), 0, dp(22))
        })

        addressText = label("Nenhuma carteira protegida criada")
        balanceText = label("Saldo: —")
        statusText = label("A chave privada permanece criptografada pelo Android Keystore.")
        root.addView(addressText)
        root.addView(balanceText)
        root.addView(statusText)

        createButton = actionButton("CRIAR CARTEIRA PROTEGIDA") {
            runCatching { store.create() }
                .onSuccess {
                    toast("Carteira criada localmente")
                    refreshIdentity()
                }
                .onFailure { toast(it.message ?: "Falha ao criar carteira") }
        }
        deleteButton = actionButton("APAGAR CARTEIRA LOCAL") {
            AlertDialog.Builder(this)
                .setTitle("Apagar carteira local?")
                .setMessage("Isto apaga o material criptográfico desta instalação. Como esta etapa é seedless, não há recuperação automática.")
                .setNegativeButton("Cancelar", null)
                .setPositiveButton("Apagar") { _, _ ->
                    store.delete()
                    refreshIdentity()
                    toast("Carteira local apagada")
                }
                .show()
        }
        root.addView(createButton)
        root.addView(deleteButton)

        root.addView(section("ENVIAR ZQ — TESTNET"))
        recipientInput = EditText(this).apply {
            hint = "0x endereço de destino"
            setHintTextColor(Color.rgb(120, 132, 168))
            setTextColor(Color.WHITE)
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        amountInput = EditText(this).apply {
            hint = "Quantidade ZQ"
            setHintTextColor(Color.rgb(120, 132, 168))
            setTextColor(Color.WHITE)
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        root.addView(recipientInput)
        root.addView(amountInput)

        sendButton = actionButton("REVISAR E ASSINAR") { prepareTransfer() }
        root.addView(sendButton)

        root.addView(TextView(this).apply {
            text = "SEGURANÇA\n• Nenhuma seed ou private key é enviada aos jogos/social.\n• A assinatura só acontece após confirmação explícita.\n• O envio está limitado à ZORYQ Testnet nesta etapa."
            textSize = 12f
            setTextColor(Color.rgb(154, 166, 200))
            setPadding(0, dp(26), 0, 0)
        })

        return ScrollView(this).apply { addView(root) }
    }

    private fun label(initial: String) = TextView(this).apply {
        text = initial
        textSize = 14f
        setTextColor(Color.rgb(205, 213, 235))
        setPadding(0, 8, 0, 8)
    }

    private fun section(title: String) = TextView(this).apply {
        text = title
        textSize = 15f
        setTextColor(Color.rgb(177, 116, 255))
        setPadding(0, 30, 0, 10)
    }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(42, 55, 118))
        gravity = Gravity.CENTER
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = 12 }
    }

    private fun refreshIdentity() {
        val identity = store.identity()
        val hasWallet = identity != null && store.exists()
        createButton.isEnabled = !hasWallet
        deleteButton.isEnabled = hasWallet
        sendButton.isEnabled = hasWallet

        if (!hasWallet) {
            addressText.text = "Nenhuma carteira protegida criada"
            balanceText.text = "Saldo: —"
            statusText.text = "Crie uma carteira para habilitar assinatura local na ZORYQ Testnet."
            return
        }

        addressText.text = "Endereço: ${identity!!.address}"
        balanceText.text = "Saldo: carregando..."
        statusText.text = "Consultando ZORYQ Testnet..."
        readRpc.fetchAccount(identity.address) { snapshot ->
            runOnUiThread {
                if (snapshot.online) {
                    balanceText.text = "Saldo: ${snapshot.balanceZq ?: "0"} ZQ"
                    statusText.text = "Conta online • nonce ${snapshot.nonce ?: 0}"
                } else {
                    balanceText.text = "Saldo: indisponível"
                    statusText.text = snapshot.error ?: "RPC indisponível"
                }
            }
        }
    }

    private fun prepareTransfer() {
        val identity = store.identity() ?: return toast("Crie uma carteira primeiro")
        val transfer = NativeTransfer(recipientInput.text.toString(), amountInput.text.toString())
        transfer.validate()?.let { return toast(it) }

        sendButton.isEnabled = false
        statusText.text = "Buscando nonce e gas price..."
        txRpc.fetchFeeContext(identity.address) { result ->
            runOnUiThread {
                sendButton.isEnabled = true
                result.onFailure {
                    statusText.text = it.message ?: "Falha ao consultar taxa"
                    toast(statusText.text.toString())
                }.onSuccess { fee ->
                    val feeWei = fee.gasPriceWei.multiply(fee.gasLimit)
                    val feeZq = ZoryqReadOnlyRpc.formatNative(feeWei)
                    showConfirmation(identity.address, transfer, fee, feeZq)
                }
            }
        }
    }

    private fun showConfirmation(
        from: String,
        transfer: NativeTransfer,
        fee: ZoryqTransactionRpc.FeeContext,
        estimatedFeeZq: String
    ) {
        AlertDialog.Builder(this)
            .setTitle("Confirmar assinatura")
            .setMessage(
                "Rede: ZORYQ Testnet (${ZoryqReadOnlyRpc.EXPECTED_CHAIN_ID})\n\n" +
                    "De: $from\nPara: ${transfer.normalizedTo()}\n" +
                    "Valor: ${transfer.amountZq.trim()} ZQ\n" +
                    "Taxa estimada: $estimatedFeeZq ZQ\nNonce: ${fee.nonce}\n\n" +
                    "A transação só será assinada se você confirmar."
            )
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("ASSINAR E ENVIAR") { _, _ -> signAndSend(transfer, fee) }
            .show()
    }

    private fun signAndSend(transfer: NativeTransfer, fee: ZoryqTransactionRpc.FeeContext) {
        statusText.text = "Assinando localmente..."
        val signedHex = runCatching {
            store.withCredentials { credentials -> txRpc.signTransfer(transfer, fee, credentials) }
        }.getOrElse {
            statusText.text = it.message ?: "Falha na assinatura"
            toast(statusText.text.toString())
            return
        }

        statusText.text = "Transmitindo transação assinada..."
        txRpc.broadcastSigned(signedHex) { result ->
            runOnUiThread {
                if (result.success) {
                    statusText.text = "Enviada: ${result.txHash}"
                    toast("Transação enviada")
                    refreshIdentity()
                } else {
                    statusText.text = result.error ?: "Falha no envio"
                    toast(statusText.text.toString())
                }
            }
        }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        readRpc.shutdown()
        txRpc.shutdown()
        super.onDestroy()
    }
}
