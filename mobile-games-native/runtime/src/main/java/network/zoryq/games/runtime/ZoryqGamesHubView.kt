package network.zoryq.games.runtime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import kotlin.math.sin

class ZoryqGamesHubView(
    context: Context,
    private val onGameSelected: (String) -> Unit
) : View(context) {

    private data class GameCard(
        val id: String,
        val title: String,
        val subtitle: String,
        val status: String,
        val accent: Int,
        val enabled: Boolean
    )

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }

    private val cards = listOf(
        GameCard(
            ZoryqGameBridge.GAME_RUSH,
            "ZORYQ RUSH",
            "Corra pela Neo Zorya, desvie, pule e colete ZQ.",
            "JOGÁVEL",
            Color.rgb(88, 236, 255),
            true
        ),
        GameCard(
            ZoryqGameBridge.GAME_ARENA,
            "ZORYQ ARENA",
            "Combate futurista com movimentação, escudo e disparos.",
            "ALPHA JOGÁVEL",
            Color.rgb(255, 85, 176),
            true
        ),
        GameCard(
            ZoryqGameBridge.GAME_EMPIRE,
            "ZORYQ EMPIRE",
            "Construa, produza, evolua e dispute o ranking global.",
            "PLANEJADO",
            Color.rgb(171, 111, 255),
            false
        )
    )

    private val cardRects = ArrayList<RectF>()
    private var background: Shader? = null
    private var started = 0L

    init {
        isClickable = true
        contentDescription = "ZORYQ Games"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        background = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(
                Color.rgb(4, 6, 18),
                Color.rgb(12, 15, 42),
                Color.rgb(18, 8, 44),
                Color.rgb(3, 4, 12)
            ),
            null,
            Shader.TileMode.CLAMP
        )
        rebuildCardRects(w, h)
    }

    private fun rebuildCardRects(w: Int, h: Int) {
        cardRects.clear()
        val horizontal = w * 0.065f
        val top = h * 0.31f
        val gap = h * 0.025f
        val cardHeight = h * 0.165f
        cards.indices.forEach { index ->
            val y = top + index * (cardHeight + gap)
            cardRects += RectF(horizontal, y, w - horizontal, y + cardHeight)
        }
    }

    override fun onDraw(canvas: Canvas) {
        paint.shader = background
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        drawAmbient(canvas)
        drawHeader(canvas)
        cards.forEachIndexed { index, card -> drawCard(canvas, cardRects[index], card) }
        drawFooter(canvas)
        postInvalidateOnAnimation()
    }

    private fun drawAmbient(canvas: Canvas) {
        val t = SystemClock.uptimeMillis() / 1000f
        repeat(10) { i ->
            val phase = t * 0.32f + i * 0.83f
            val x = width * ((i * 0.119f + 0.08f) % 1f)
            val y = height * (0.08f + ((i * 0.137f) % 0.82f)) + sin(phase) * 10f
            paint.color = Color.argb(20 + (i % 4) * 8, 105, 122, 255)
            canvas.drawCircle(x, y, width * (0.035f + (i % 3) * 0.012f), paint)
        }
    }

    private fun drawHeader(canvas: Canvas) {
        text.textAlign = Paint.Align.LEFT
        text.color = Color.WHITE
        text.textSize = width * 0.084f
        canvas.drawText("ZORYQ", width * 0.065f, height * 0.12f, text)
        text.color = Color.rgb(91, 235, 255)
        canvas.drawText("GAMES", width * 0.065f, height * 0.19f, text)

        text.textSize = width * 0.029f
        text.color = Color.rgb(172, 180, 214)
        canvas.drawText("JOGOS NATIVOS • PROGRESSÃO • ECONOMIA CONECTADA", width * 0.067f, height * 0.235f, text)

        stroke.strokeWidth = width * 0.003f
        stroke.color = Color.argb(125, 89, 219, 255)
        canvas.drawLine(width * 0.067f, height * 0.266f, width * 0.54f, height * 0.266f, stroke)
    }

    private fun drawCard(canvas: Canvas, rect: RectF, card: GameCard) {
        paint.color = if (card.enabled) Color.argb(218, 11, 16, 38) else Color.argb(190, 9, 12, 28)
        canvas.drawRoundRect(rect, width * 0.045f, width * 0.045f, paint)

        stroke.strokeWidth = width * 0.0035f
        stroke.color = if (card.enabled) card.accent else Color.argb(90, 124, 130, 160)
        canvas.drawRoundRect(rect, width * 0.045f, width * 0.045f, stroke)

        val iconCx = rect.left + width * 0.085f
        val iconCy = rect.centerY()
        paint.color = Color.argb(if (card.enabled) 52 else 25, Color.red(card.accent), Color.green(card.accent), Color.blue(card.accent))
        canvas.drawCircle(iconCx, iconCy, width * 0.055f, paint)
        paint.color = if (card.enabled) card.accent else Color.rgb(90, 96, 120)
        canvas.drawCircle(iconCx, iconCy, width * 0.025f, paint)

        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.047f
        text.color = if (card.enabled) Color.WHITE else Color.rgb(145, 150, 170)
        canvas.drawText(card.title, rect.left + width * 0.16f, rect.top + rect.height() * 0.34f, text)

        text.textSize = width * 0.026f
        text.color = if (card.enabled) Color.rgb(175, 184, 214) else Color.rgb(112, 117, 138)
        val subtitle = if (card.subtitle.length > 48) card.subtitle.take(47) + "…" else card.subtitle
        canvas.drawText(subtitle, rect.left + width * 0.16f, rect.top + rect.height() * 0.61f, text)

        text.textAlign = Paint.Align.RIGHT
        text.textSize = width * 0.023f
        text.color = if (card.enabled) card.accent else Color.rgb(117, 121, 143)
        canvas.drawText(card.status, rect.right - width * 0.04f, rect.bottom - rect.height() * 0.15f, text)
    }

    private fun drawFooter(canvas: Canvas) {
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.025f
        text.color = Color.rgb(130, 139, 172)
        canvas.drawText("WALLET ↔ GAMES BRIDGE • SEM EXPOR CHAVES PRIVADAS", width * 0.5f, height * 0.93f, text)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                started = SystemClock.uptimeMillis()
                return true
            }
            MotionEvent.ACTION_UP -> {
                val duration = SystemClock.uptimeMillis() - started
                if (duration < 650L) {
                    cardRects.forEachIndexed { index, rect ->
                        if (rect.contains(event.x, event.y) && cards[index].enabled) {
                            onGameSelected(cards[index].id)
                            performClick()
                            return true
                        }
                    }
                }
                performClick()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
