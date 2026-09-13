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
    private lateinit var importButton: Button
    private lateinit var revealButton: Button
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
        statusText = label("Segredos criptografados pelo Android Keystore.")
        root.addView(addressText)
        root.addView(balanceText)
        root.addView(statusText)

        createButton = actionButton("CRIAR CARTEIRA + RECUPERAÇÃO") {
            runCatching { store.createRecoverable() }
                .onSuccess { bundle ->
                    showNewRecoveryPhrase(bundle.mnemonic)
                    refreshIdentity()
                }
                .onFailure { toast(it.message ?: "Falha ao criar carteira") }
        }
        importButton = actionButton("IMPORTAR FRASE BIP-39") { showImportDialog() }
        revealButton = actionButton("MOSTRAR FRASE DE RECUPERAÇÃO") { confirmReveal() }
        deleteButton = actionButton("APAGAR CARTEIRA LOCAL") { confirmDelete() }

        root.addView(createButton)
        root.addView(importButton)
        root.addView(revealButton)
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
            text = "SEGURANÇA\n• BIP-39 + ${HdWalletDerivation.PATH}.\n• A frase fica criptografada pelo Android Keystore e nunca vai para Games/Social.\n• A assinatura exige confirmação explícita.\n• Guarde a frase offline: quem possui as palavras controla a carteira.\n• Este candidato permanece limitado à ZORYQ Testnet."
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

    private fun showNewRecoveryPhrase(mnemonic: String) {
        AlertDialog.Builder(this)
            .setTitle("Anote sua frase de recuperação")
            .setMessage(
                "Escreva estas 12 palavras em papel e guarde offline. Não envie por mensagem, não tire print e não compartilhe.\n\n" +
                    mnemonic +
                    "\n\nCaminho: ${HdWalletDerivation.PATH}\n\nA ZORYQ não consegue recuperar estas palavras para você."
            )
            .setCancelable(false)
            .setPositiveButton("ANOTEI E GUARDEI") { _, _ ->
                toast("Carteira recuperável criada")
            }
            .show()
    }

    private fun showImportDialog() {
        if (store.exists()) return toast("Apague a carteira local atual antes de importar outra")
        val input = EditText(this).apply {
            hint = "12/15/18/21/24 palavras BIP-39"
            minLines = 4
            maxLines = 8
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        AlertDialog.Builder(this)
            .setTitle("Importar carteira")
            .setMessage("Digite a frase somente neste aparelho. Ela será validada e criptografada localmente.")
            .setView(input)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("IMPORTAR") { _, _ ->
                runCatching { store.importMnemonic(input.text.toString()) }
                    .onSuccess {
                        input.text.clear()
                        toast("Carteira importada")
                        refreshIdentity()
                    }
                    .onFailure { toast(it.message ?: "Frase inválida") }
            }
            .show()
    }

    private fun confirmReveal() {
        if (!store.exists()) return toast("Nenhuma carteira criada")
        if (!store.isRecoverable()) return toast("Esta carteira antiga de teste não possui frase recuperável")
        AlertDialog.Builder(this)
            .setTitle("Mostrar palavras secretas?")
            .setMessage("Certifique-se de que ninguém esteja olhando a tela. Nunca compartilhe estas palavras.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("MOSTRAR") { _, _ ->
                val phrase = runCatching { store.revealRecoveryPhrase() }.getOrNull()
                if (phrase.isNullOrBlank()) {
                    toast("Não foi possível revelar a frase")
                } else {
                    AlertDialog.Builder(this)
                        .setTitle("Frase de recuperação")
                        .setMessage("$phrase\n\nCaminho: ${HdWalletDerivation.PATH}")
                        .setPositiveButton("OCULTAR", null)
                        .show()
                }
            }
            .show()
    }

    private fun confirmDelete() {
        AlertDialog.Builder(this)
            .setTitle("Apagar carteira local?")
            .setMessage(
                if (store.isRecoverable()) {
                    "Só continue se você já guardou a frase de recuperação. Sem ela, os fundos não poderão ser recuperados."
                } else {
                    "Esta carteira de teste antiga não possui frase de recuperação. Apagá-la é irreversível."
                }
            )
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("APAGAR") { _, _ ->
                store.delete()
                refreshIdentity()
                toast("Carteira local apagada")
            }
            .show()
    }

    private fun refreshIdentity() {
        val identity = store.identity()
        val hasWallet = identity != null && store.exists()
        createButton.isEnabled = !hasWallet
        importButton.isEnabled = !hasWallet
        revealButton.isEnabled = hasWallet && store.isRecoverable()
        deleteButton.isEnabled = hasWallet
        sendButton.isEnabled = hasWallet

        if (!hasWallet) {
            addressText.text = "Nenhuma carteira protegida criada"
            balanceText.text = "Saldo: —"
            statusText.text = "Crie ou importe uma carteira BIP-39 para habilitar assinatura local."
            return
        }

        addressText.text = "Endereço: ${identity!!.address}"
        balanceText.text = "Saldo: carregando..."
        statusText.text = if (store.isRecoverable()) {
            "Carteira BIP-39 • ${HdWalletDerivation.PATH} • consultando Testnet..."
        } else {
            "Carteira seedless legada de teste • faça migração para uma carteira recuperável"
        }
        readRpc.fetchAccount(identity.address) { snapshot ->
            runOnUiThread {
                if (snapshot.online) {
                    balanceText.text = "Saldo: ${snapshot.balanceZq ?: "0"} ZQ"
                    statusText.text = (if (store.isRecoverable()) "BIP-39 protegida" else "Legada seedless") +
                        " • online • nonce ${snapshot.nonce ?: 0}"
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
