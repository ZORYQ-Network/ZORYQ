package network.zoryq.wallet.migration

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.MotionEvent
import android.view.View

class WalletMigrationView(
    context: Context,
    private val onAction: (Action) -> Unit
) : View(context) {

    enum class Action { OPEN_GAMES }
    private enum class Tab { HOME, WALLET, SOCIAL, GAMES, PROFILE }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    private val navRects = ArrayList<RectF>()
    private var selected = Tab.HOME
    private var background: Shader? = null

    init {
        isClickable = true
        contentDescription = "ZORYQ Wallet Next migration host"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        background = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(Color.rgb(4, 6, 18), Color.rgb(8, 13, 31), Color.rgb(14, 7, 33)),
            null,
            Shader.TileMode.CLAMP
        )
        navRects.clear()
        val top = h * 0.895f
        val itemW = w / 5f
        repeat(5) { index ->
            navRects += RectF(index * itemW, top, (index + 1) * itemW, h.toFloat())
        }
    }

    override fun onDraw(canvas: Canvas) {
        paint.shader = background
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        drawHeader(canvas)
        when (selected) {
            Tab.HOME -> drawHome(canvas)
            Tab.WALLET -> drawWallet(canvas)
            Tab.SOCIAL -> drawSocial(canvas)
            Tab.GAMES -> drawGames(canvas)
            Tab.PROFILE -> drawProfile(canvas)
        }
        drawNavigation(canvas)
    }

    private fun drawHeader(canvas: Canvas) {
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.054f
        text.color = Color.WHITE
        canvas.drawText("ZORYQ", width * 0.055f, height * 0.065f, text)
        text.textSize = width * 0.023f
        text.color = Color.rgb(104, 236, 255)
        canvas.drawText("WALLET NEXT • MIGRATION HOST", width * 0.055f, height * 0.098f, text)

        val badge = RectF(width * 0.69f, height * 0.045f, width * 0.945f, height * 0.095f)
        paint.color = Color.argb(190, 35, 25, 68)
        canvas.drawRoundRect(badge, width * 0.025f, width * 0.025f, paint)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.020f
        text.color = Color.rgb(206, 158, 255)
        canvas.drawText("CANONICAL SOURCE", badge.centerX(), badge.centerY() + width * 0.007f, text)
    }

    private fun drawHome(canvas: Canvas) {
        title(canvas, "Início", "Base reproduzível para migrar a Wallet sem arriscar o app atual.")
        card(canvas, 0.16f, "MIGRAÇÃO SEGURA", "Este APK é um host de reconstrução. Ele não substitui ainda a Wallet distribuída.", Color.rgb(105, 224, 255))
        card(canvas, 0.31f, "ZORYQ GAMES", "Rush, Arena e Empire usam o runtime nativo já validado pelo CI.", Color.rgb(171, 112, 255))
        card(canvas, 0.46f, "CHAIN", "ZORYQ Testnet • Chain ID 5919065 • assinatura da Wallet ainda isolada deste host.", Color.rgb(113, 255, 179))
        card(canvas, 0.61f, "PRÓXIMO GATE", "Migrar Wallet e Social tela por tela, com testes de paridade antes do corte de pacote.", Color.rgb(255, 157, 96))
    }

    private fun drawWallet(canvas: Canvas) {
        title(canvas, "Wallet", "Fluxos sensíveis permanecem bloqueados até a reconstrução auditável.")
        metricCard(canvas, 0.19f, "Rede", "ZORYQ Testnet", "5919065", Color.rgb(82, 235, 255))
        metricCard(canvas, 0.34f, "Assinatura", "DESABILITADA NESTE HOST", "SAFE", Color.rgb(255, 197, 88))
        metricCard(canvas, 0.49f, "Chaves", "NUNCA ENVIADAS AOS JOGOS", "ISOLADAS", Color.rgb(115, 255, 178))
        warning(canvas, 0.68f, "Criação/importação/recovery e transações reais só entram após threat model, armazenamento seguro e testes de dispositivo.")
    }

    private fun drawSocial(canvas: Canvas) {
        title(canvas, "Social", "Superfície reservada para migração do feed e perfil social.")
        card(canvas, 0.19f, "FEED", "A implementação antiga continua sendo a referência comportamental; esta tela ainda não reivindica paridade.", Color.rgb(255, 102, 175))
        card(canvas, 0.37f, "PERFIL", "Avatar, nome público e relações sociais serão migrados sem transportar segredos da Wallet.", Color.rgb(182, 112, 255))
        card(canvas, 0.55f, "STATUS", "Estrutura de navegação pronta • backend/social ainda não reconectado neste host.", Color.rgb(255, 204, 96))
    }

    private fun drawGames(canvas: Canvas) {
        title(canvas, "Jogos", "Runtime nativo integrado ao mesmo host Android.")
        gameRow(canvas, 0.19f, "ZORYQ RUSH", "Runner • jogável", Color.rgb(85, 239, 255))
        gameRow(canvas, 0.33f, "ZORYQ ARENA", "Combate • alpha jogável", Color.rgb(255, 83, 169))
        gameRow(canvas, 0.47f, "ZORYQ EMPIRE", "Tycoon • alpha jogável", Color.rgb(176, 110, 255))

        val button = RectF(width * 0.13f, height * 0.68f, width * 0.87f, height * 0.77f)
        paint.color = Color.rgb(73, 67, 208)
        canvas.drawRoundRect(button, width * 0.04f, width * 0.04f, paint)
        stroke.strokeWidth = width * 0.003f
        stroke.color = Color.rgb(105, 234, 255)
        canvas.drawRoundRect(button, width * 0.04f, width * 0.04f, stroke)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.040f
        text.color = Color.WHITE
        canvas.drawText("ABRIR ZORYQ GAMES", button.centerX(), button.centerY() + width * 0.014f, text)
    }

    private fun drawProfile(canvas: Canvas) {
        title(canvas, "Perfil", "Contexto público do usuário será migrado separado das chaves.")
        val cx = width * 0.5f
        val cy = height * 0.30f
        paint.color = Color.argb(65, 91, 225, 255)
        canvas.drawCircle(cx, cy, width * 0.14f, paint)
        paint.color = Color.rgb(32, 40, 76)
        canvas.drawCircle(cx, cy, width * 0.09f, paint)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.070f
        text.color = Color.rgb(105, 238, 255)
        canvas.drawText("Z", cx, cy + width * 0.024f, text)

        card(canvas, 0.46f, "PERFIL PÚBLICO", "ID/handle/avatar poderão ser passados à experiência de jogos sem incluir material criptográfico.", Color.rgb(111, 237, 255))
        card(canvas, 0.64f, "PRIVACIDADE", "Nenhuma seed, mnemonic ou private key faz parte do contrato de integração do Games Hub.", Color.rgb(115, 255, 176))
    }

    private fun title(canvas: Canvas, heading: String, subtitle: String) {
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.070f
        text.color = Color.WHITE
        canvas.drawText(heading, width * 0.06f, height * 0.155f, text)
        text.textSize = width * 0.026f
        text.color = Color.rgb(160, 171, 207)
        canvas.drawText(subtitle.take(62), width * 0.061f, height * 0.195f, text)
    }

    private fun card(canvas: Canvas, topRatio: Float, heading: String, body: String, accent: Int) {
        val rect = RectF(width * 0.06f, height * topRatio, width * 0.94f, height * (topRatio + 0.115f))
        paint.color = Color.argb(205, 10, 15, 35)
        canvas.drawRoundRect(rect, width * 0.035f, width * 0.035f, paint)
        stroke.strokeWidth = width * 0.0025f
        stroke.color = Color.argb(145, Color.red(accent), Color.green(accent), Color.blue(accent))
        canvas.drawRoundRect(rect, width * 0.035f, width * 0.035f, stroke)
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.029f
        text.color = accent
        canvas.drawText(heading, rect.left + width * 0.035f, rect.top + rect.height() * 0.35f, text)
        text.textSize = width * 0.023f
        text.color = Color.rgb(185, 193, 220)
        canvas.drawText(body.take(72), rect.left + width * 0.035f, rect.top + rect.height() * 0.68f, text)
    }

    private fun metricCard(canvas: Canvas, topRatio: Float, label: String, value: String, badge: String, accent: Int) {
        val rect = RectF(width * 0.06f, height * topRatio, width * 0.94f, height * (topRatio + 0.105f))
        paint.color = Color.argb(200, 10, 15, 35)
        canvas.drawRoundRect(rect, width * 0.03f, width * 0.03f, paint)
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.025f
        text.color = Color.rgb(145, 157, 195)
        canvas.drawText(label, rect.left + width * 0.035f, rect.top + rect.height() * 0.35f, text)
        text.textSize = width * 0.032f
        text.color = Color.WHITE
        canvas.drawText(value, rect.left + width * 0.035f, rect.top + rect.height() * 0.70f, text)
        text.textAlign = Paint.Align.RIGHT
        text.textSize = width * 0.023f
        text.color = accent
        canvas.drawText(badge, rect.right - width * 0.035f, rect.centerY() + width * 0.008f, text)
    }

    private fun warning(canvas: Canvas, topRatio: Float, body: String) {
        val rect = RectF(width * 0.06f, height * topRatio, width * 0.94f, height * (topRatio + 0.12f))
        paint.color = Color.argb(185, 43, 29, 16)
        canvas.drawRoundRect(rect, width * 0.03f, width * 0.03f, paint)
        stroke.strokeWidth = width * 0.002f
        stroke.color = Color.rgb(255, 186, 78)
        canvas.drawRoundRect(rect, width * 0.03f, width * 0.03f, stroke)
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.023f
        text.color = Color.rgb(255, 215, 153)
        canvas.drawText(body.take(82), rect.left + width * 0.03f, rect.centerY() + width * 0.008f, text)
    }

    private fun gameRow(canvas: Canvas, topRatio: Float, name: String, status: String, accent: Int) {
        val rect = RectF(width * 0.09f, height * topRatio, width * 0.91f, height * (topRatio + 0.09f))
        paint.color = Color.argb(200, 11, 16, 38)
        canvas.drawRoundRect(rect, width * 0.03f, width * 0.03f, paint)
        paint.color = Color.argb(55, Color.red(accent), Color.green(accent), Color.blue(accent))
        canvas.drawCircle(rect.left + width * 0.065f, rect.centerY(), width * 0.035f, paint)
        paint.color = accent
        canvas.drawCircle(rect.left + width * 0.065f, rect.centerY(), width * 0.015f, paint)
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.033f
        text.color = Color.WHITE
        canvas.drawText(name, rect.left + width * 0.125f, rect.centerY() - width * 0.003f, text)
        text.textSize = width * 0.022f
        text.color = accent
        canvas.drawText(status, rect.left + width * 0.125f, rect.centerY() + width * 0.030f, text)
    }

    private fun drawNavigation(canvas: Canvas) {
        val labels = listOf("Início", "Wallet", "Social", "Jogos", "Perfil")
        val tabs = Tab.entries
        paint.color = Color.rgb(5, 7, 18)
        canvas.drawRect(0f, height * 0.895f, width.toFloat(), height.toFloat(), paint)
        stroke.strokeWidth = 1.5f
        stroke.color = Color.argb(80, 101, 121, 177)
        canvas.drawLine(0f, height * 0.895f, width.toFloat(), height * 0.895f, stroke)

        navRects.forEachIndexed { index, rect ->
            val active = selected == tabs[index]
            if (active) {
                paint.color = Color.argb(42, 94, 226, 255)
                canvas.drawRoundRect(
                    RectF(rect.left + width * 0.018f, rect.top + height * 0.012f, rect.right - width * 0.018f, rect.bottom - height * 0.012f),
                    width * 0.03f,
                    width * 0.03f,
                    paint
                )
            }
            text.textAlign = Paint.Align.CENTER
            text.textSize = width * 0.023f
            text.color = if (active) Color.rgb(96, 236, 255) else Color.rgb(126, 136, 169)
            canvas.drawText(labels[index], rect.centerX(), rect.centerY() + width * 0.008f, text)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_UP) return true

        navRects.forEachIndexed { index, rect ->
            if (rect.contains(event.x, event.y)) {
                selected = Tab.entries[index]
                invalidate()
                performClick()
                return true
            }
        }

        if (selected == Tab.GAMES && event.y in height * 0.65f..height * 0.80f) {
            onAction(Action.OPEN_GAMES)
            performClick()
            return true
        }

        performClick()
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
