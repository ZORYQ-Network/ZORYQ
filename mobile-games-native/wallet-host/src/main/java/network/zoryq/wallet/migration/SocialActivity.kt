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
import android.widget.Toast
import java.text.DateFormat
import java.util.Date

class SocialActivity : Activity() {
    private lateinit var store: SocialStore
    private lateinit var secureWallet: SecureWalletStore
    private val api = ZoryqSocialApi()

    private lateinit var root: LinearLayout
    private lateinit var handleInput: EditText
    private lateinit var postInput: EditText
    private lateinit var feed: LinearLayout
    private lateinit var statusText: TextView
    private lateinit var connectButton: Button

    private var sessionToken: String? = null
    private var remotePosts: List<ZoryqSocialApi.RemotePost> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SocialStore(this)
        secureWallet = SecureWalletStore(this)
        setContentView(buildUi())
        renderFeed()
        api.fetchFeed(null) { result ->
            runOnUiThread {
                result.onSuccess {
                    remotePosts = it
                    statusText.text = "Feed público online • conecte a Wallet para publicar e interagir"
                    renderFeed()
                }
            }
        }
    }

    private fun buildUi(): ScrollView {
        val density = resources.displayMetrics.density
        fun dp(value: Int) = (value * density).toInt()

        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(32))
            setBackgroundColor(Color.rgb(6, 7, 22))
        }
        root.addView(TextView(this).apply {
            text = "ZORYQ SOCIAL"
            textSize = 24f
            setTextColor(Color.WHITE)
        })
        root.addView(TextView(this).apply {
            text = "Online + local-first • segredos da Wallet nunca entram no backend social"
            textSize = 12f
            setTextColor(Color.rgb(105, 232, 255))
            setPadding(0, dp(6), 0, dp(12))
        })

        statusText = TextView(this).apply {
            text = "Carregando feed público..."
            textSize = 12f
            setTextColor(Color.rgb(184, 194, 225))
            setPadding(0, 0, 0, dp(10))
        }
        root.addView(statusText)

        connectButton = button("CONECTAR WALLET AO SOCIAL") { connectSocial() }
        root.addView(connectButton)
        root.addView(TextView(this).apply {
            text = "A conexão assina somente uma mensagem de autenticação. Não envia transação nem movimenta ZQ."
            textSize = 10f
            setTextColor(Color.rgb(142, 154, 187))
            setPadding(0, dp(4), 0, dp(12))
        })

        handleInput = EditText(this).apply {
            hint = "handle"
            setText(store.handle())
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            setSingleLine(true)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        }
        root.addView(handleInput)
        root.addView(button("SALVAR PERFIL LOCAL") {
            runCatching { store.saveHandle(handleInput.text.toString()) }
                .onSuccess {
                    handleInput.setText(store.handle())
                    toast("Perfil local salvo")
                }
                .onFailure { toast(it.message ?: "Handle inválido") }
        })

        postInput = EditText(this).apply {
            hint = "O que está acontecendo na ZORYQ?"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.rgb(120, 132, 168))
            minLines = 3
            maxLines = 5
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
        }
        root.addView(postInput)
        root.addView(button("PUBLICAR") { publish() })

        root.addView(TextView(this).apply {
            text = "FEED"
            textSize = 15f
            setTextColor(Color.rgb(190, 126, 255))
            setPadding(0, dp(24), 0, dp(8))
        })
        feed = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(feed)

        root.addView(TextView(this).apply {
            text = "Offline-first: se a sessão remota não estiver ativa, os posts continuam salvos somente neste aparelho."
            textSize = 11f
            setTextColor(Color.rgb(143, 153, 185))
            setPadding(0, dp(18), 0, 0)
        })

        return ScrollView(this).apply { addView(root) }
    }

    private fun connectSocial() {
        val identity = secureWallet.identity()
        if (identity == null || !secureWallet.exists()) {
            toast("Crie primeiro uma carteira protegida na aba SECURE")
            return
        }
        val handle = runCatching {
            store.saveHandle(handleInput.text.toString())
            store.handle()
        }.getOrElse {
            toast(it.message ?: "Handle inválido")
            return
        }

        connectButton.isEnabled = false
        statusText.text = "Solicitando desafio de autenticação..."
        api.authenticate(
            address = identity.address,
            signPersonal = { message ->
                secureWallet.withCredentials { credentials ->
                    EthereumSignature.personal(message, credentials)
                }
            }
        ) { result ->
            runOnUiThread {
                result.onFailure {
                    connectButton.isEnabled = true
                    statusText.text = "Falha ao conectar: ${it.message ?: "erro"}"
                }.onSuccess { session ->
                    sessionToken = session.token
                    if (session.profileRegistrationRequired) {
                        statusText.text = "Autenticado • registrando perfil ZORYQ..."
                        registerRemoteProfile(session.token, handle)
                    } else {
                        onRemoteSessionReady()
                    }
                }
            }
        }
    }

    private fun registerRemoteProfile(token: String, handle: String) {
        api.registerProfile(
            token = token,
            handle = handle,
            displayName = handle,
            bio = "ZORYQ mobile profile",
            signTypedData = { typedData ->
                secureWallet.withCredentials { credentials ->
                    EthereumSignature.typedData(typedData, credentials)
                }
            }
        ) { result ->
            runOnUiThread {
                result.onFailure {
                    connectButton.isEnabled = true
                    statusText.text = "Perfil não registrado: ${it.message ?: "erro"}"
                }.onSuccess {
                    onRemoteSessionReady()
                }
            }
        }
    }

    private fun onRemoteSessionReady() {
        connectButton.isEnabled = true
        connectButton.text = "SINCRONIZAR FEED"
        statusText.text = "Wallet autenticada no ZORYQ Social"
        loadRemoteFeed()
    }

    private fun loadRemoteFeed() {
        api.fetchFeed(sessionToken) { result ->
            runOnUiThread {
                result.onFailure {
                    statusText.text = "Sessão ativa • feed remoto indisponível: ${it.message ?: "erro"}"
                }.onSuccess {
                    remotePosts = it
                    statusText.text = "Social online • ${it.size} posts carregados"
                    renderFeed()
                }
            }
        }
    }

    private fun publish() {
        val body = postInput.text.toString().trim()
        if (body.isEmpty()) return toast("Escreva algo antes de publicar")
        val token = sessionToken
        if (token == null) {
            saveLocalFallback(body, "Sem sessão remota: post salvo localmente")
            return
        }

        statusText.text = "Publicando no ZORYQ Social..."
        api.createPost(token, body) { result ->
            runOnUiThread {
                result.onFailure {
                    saveLocalFallback(body, "Falha remota; post preservado localmente")
                    statusText.text = "Falha remota: ${it.message ?: "erro"}"
                }.onSuccess {
                    postInput.setText("")
                    statusText.text = "Publicado no ZORYQ Social"
                    loadRemoteFeed()
                }
            }
        }
    }

    private fun saveLocalFallback(body: String, message: String) {
        runCatching { store.addPost(body.take(280)) }
            .onSuccess {
                postInput.setText("")
                toast(message)
                renderFeed()
            }
            .onFailure { toast(it.message ?: "Não foi possível salvar") }
    }

    private fun renderFeed() {
        feed.removeAllViews()

        if (remotePosts.isNotEmpty()) {
            feed.addView(sectionLabel("REDE ZORYQ"))
            remotePosts.forEach { post -> feed.addView(remoteCard(post), cardParams()) }
        }

        val local = store.posts()
        if (local.isNotEmpty()) {
            feed.addView(sectionLabel("LOCAL / OFFLINE"))
            local.forEach { post -> feed.addView(localCard(post), cardParams()) }
        }

        if (remotePosts.isEmpty() && local.isEmpty()) {
            feed.addView(TextView(this).apply {
                text = "Nenhum post ainda. Publique o primeiro."
                setTextColor(Color.rgb(150, 160, 190))
                textSize = 13f
            })
        }
    }

    private fun remoteCard(post: ZoryqSocialApi.RemotePost): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(18, 16, 18, 12)
        setBackgroundColor(Color.rgb(14, 18, 42))
        addView(TextView(this@SocialActivity).apply {
            text = "@${post.author} • ONLINE"
            textSize = 13f
            setTextColor(Color.rgb(104, 235, 255))
        })
        addView(TextView(this@SocialActivity).apply {
            text = post.content
            textSize = 15f
            setTextColor(Color.WHITE)
            setPadding(0, 8, 0, 8)
        })
        addView(timeText(post.createdAt))
        addView(button(if (post.liked) "♥ ${post.likeCount} • CURTIDO" else "♡ ${post.likeCount}") {
            val token = sessionToken ?: return@button toast("Conecte a Wallet para curtir")
            api.toggleLike(token, post.id) { result ->
                runOnUiThread {
                    result.onFailure { toast(it.message ?: "Falha ao curtir") }
                        .onSuccess { loadRemoteFeed() }
                }
            }
        })
    }

    private fun localCard(post: SocialStore.Post): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(18, 16, 18, 12)
        setBackgroundColor(Color.rgb(19, 17, 39))
        addView(TextView(this@SocialActivity).apply {
            text = "@${post.author} • LOCAL"
            textSize = 13f
            setTextColor(Color.rgb(190, 126, 255))
        })
        addView(TextView(this@SocialActivity).apply {
            text = post.body
            textSize = 15f
            setTextColor(Color.WHITE)
            setPadding(0, 8, 0, 8)
        })
        addView(timeText(post.createdAt))
        addView(button("♥ ${post.likes}") {
            store.like(post.id)
            renderFeed()
        })
    }

    private fun timeText(createdAt: Long) = TextView(this).apply {
        text = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(createdAt))
        textSize = 10f
        setTextColor(Color.rgb(132, 142, 175))
    }

    private fun sectionLabel(label: String) = TextView(this).apply {
        text = label
        textSize = 11f
        setTextColor(Color.rgb(125, 137, 173))
        setPadding(0, 10, 0, 8)
    }

    private fun cardParams() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = 14 }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 11f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(42, 52, 112))
        gravity = Gravity.CENTER
        setOnClickListener { action() }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        api.shutdown()
        super.onDestroy()
    }
}
