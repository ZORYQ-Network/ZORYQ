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
    private lateinit var root: LinearLayout
    private lateinit var handleInput: EditText
    private lateinit var postInput: EditText
    private lateinit var feed: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SocialStore(this)
        setContentView(buildUi())
        renderFeed()
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
            text = "Local-first feed • wallet secrets never enter the social layer"
            textSize = 12f
            setTextColor(Color.rgb(105, 232, 255))
            setPadding(0, dp(6), 0, dp(18))
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
        root.addView(button("SALVAR PERFIL") {
            runCatching { store.saveHandle(handleInput.text.toString()) }
                .onSuccess { toast("Perfil salvo") }
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
        root.addView(button("PUBLICAR") {
            runCatching { store.addPost(postInput.text.toString()) }
                .onSuccess {
                    postInput.setText("")
                    renderFeed()
                }
                .onFailure { toast(it.message ?: "Não foi possível publicar") }
        })

        root.addView(TextView(this).apply {
            text = "FEED"
            textSize = 15f
            setTextColor(Color.rgb(190, 126, 255))
            setPadding(0, dp(24), 0, dp(8))
        })
        feed = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(feed)

        root.addView(TextView(this).apply {
            text = "Sincronização remota será adicionada sem mudar o formato local dos posts. Esta versão continua funcional offline."
            textSize = 11f
            setTextColor(Color.rgb(143, 153, 185))
            setPadding(0, dp(18), 0, 0)
        })

        return ScrollView(this).apply { addView(root) }
    }

    private fun renderFeed() {
        feed.removeAllViews()
        val posts = store.posts()
        if (posts.isEmpty()) {
            feed.addView(TextView(this).apply {
                text = "Nenhum post ainda. Publique o primeiro."
                setTextColor(Color.rgb(150, 160, 190))
                textSize = 13f
            })
            return
        }
        posts.forEach { post ->
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(18, 16, 18, 12)
                setBackgroundColor(Color.rgb(14, 18, 42))
            }
            card.addView(TextView(this).apply {
                text = "@${post.author}"
                textSize = 13f
                setTextColor(Color.rgb(104, 235, 255))
            })
            card.addView(TextView(this).apply {
                text = post.body
                textSize = 15f
                setTextColor(Color.WHITE)
                setPadding(0, 8, 0, 8)
            })
            card.addView(TextView(this).apply {
                text = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(post.createdAt))
                textSize = 10f
                setTextColor(Color.rgb(132, 142, 175))
            })
            card.addView(button("♥ ${post.likes}") {
                store.like(post.id)
                renderFeed()
            })
            feed.addView(card, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 14 })
        }
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 11f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(42, 52, 112))
        gravity = Gravity.CENTER
        setOnClickListener { action() }
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}
