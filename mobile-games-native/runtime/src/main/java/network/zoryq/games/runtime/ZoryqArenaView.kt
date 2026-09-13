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
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

class ZoryqArenaView(context: Context) : View(context) {

    private enum class Mode { MENU, PLAYING, WON, LOST }

    private data class Fighter(
        var x: Float,
        var y: Float,
        var hp: Float = 100f,
        var shield: Float = 55f,
        var vx: Float = 0f,
        var vy: Float = 0f,
        var fireCooldown: Float = 0f
    )

    private data class Shot(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var life: Float,
        val enemy: Boolean
    )

    private data class Spark(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var life: Float,
        val enemy: Boolean
    )

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }

    private var mode = Mode.MENU
    private var bg: Shader? = null
    private var lastFrame = 0L
    private var elapsed = 0f
    private var roundTime = 90f
    private var player = Fighter(0f, 0f)
    private var enemy = Fighter(0f, 0f)
    private val shots = ArrayList<Shot>()
    private val sparks = ArrayList<Spark>()

    private var movePointer = -1
    private var aimPointer = -1
    private var moveOriginX = 0f
    private var moveOriginY = 0f
    private var moveX = 0f
    private var moveY = 0f
    private var aimX = 0f
    private var aimY = 0f

    init {
        isClickable = true
        contentDescription = "ZORYQ Arena"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        bg = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(
                Color.rgb(5, 7, 20),
                Color.rgb(13, 12, 38),
                Color.rgb(7, 16, 32)
            ),
            null,
            Shader.TileMode.CLAMP
        )
        resetPositions()
    }

    private fun resetPositions() {
        player = Fighter(width * 0.28f, height * 0.62f)
        enemy = Fighter(width * 0.72f, height * 0.38f)
        shots.clear()
        sparks.clear()
        roundTime = 90f
        elapsed = 0f
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        if (lastFrame == 0L) lastFrame = now
        val dt = min(0.033f, max(0f, (now - lastFrame) / 1000f))
        lastFrame = now

        if (mode == Mode.PLAYING) update(dt)
        updateSparks(dt)

        drawArena(canvas)
        drawFighter(canvas, player, false)
        drawFighter(canvas, enemy, true)
        drawShots(canvas)
        drawHud(canvas)
        drawControls(canvas)

        when (mode) {
            Mode.MENU -> drawOverlay(canvas, "ZORYQ ARENA", "Combate rápido • 90 segundos", "TOQUE PARA ENTRAR")
            Mode.WON -> drawOverlay(canvas, "VITÓRIA", "Arena dominada", "JOGAR NOVAMENTE")
            Mode.LOST -> drawOverlay(canvas, "DERROTA", "Ajuste sua estratégia", "TENTAR NOVAMENTE")
            Mode.PLAYING -> Unit
        }
        postInvalidateOnAnimation()
    }

    private fun update(dt: Float) {
        elapsed += dt
        roundTime = max(0f, 90f - elapsed)

        val len = hypot(moveX.toDouble(), moveY.toDouble()).toFloat()
        val normX = if (len > 1f) moveX / len else 0f
        val normY = if (len > 1f) moveY / len else 0f
        val speed = min(width, height) * 0.33f
        player.vx += (normX * speed - player.vx) * min(1f, dt * 10f)
        player.vy += (normY * speed - player.vy) * min(1f, dt * 10f)
        player.x = (player.x + player.vx * dt).coerceIn(width * 0.08f, width * 0.92f)
        player.y = (player.y + player.vy * dt).coerceIn(height * 0.18f, height * 0.84f)
        player.fireCooldown = max(0f, player.fireCooldown - dt)

        enemy.fireCooldown = max(0f, enemy.fireCooldown - dt)
        val dx = player.x - enemy.x
        val dy = player.y - enemy.y
        val dist = hypot(dx.toDouble(), dy.toDouble()).toFloat().coerceAtLeast(1f)
        val desired = width * 0.38f
        val chase = ((dist - desired) / desired).coerceIn(-0.75f, 0.9f)
        val enemySpeed = min(width, height) * 0.20f
        val ex = dx / dist
        val ey = dy / dist
        val orbit = sin(elapsed * 1.45f)
        enemy.vx += ((ex * chase - ey * orbit * 0.55f) * enemySpeed - enemy.vx) * min(1f, dt * 4.5f)
        enemy.vy += ((ey * chase + ex * orbit * 0.55f) * enemySpeed - enemy.vy) * min(1f, dt * 4.5f)
        enemy.x = (enemy.x + enemy.vx * dt).coerceIn(width * 0.08f, width * 0.92f)
        enemy.y = (enemy.y + enemy.vy * dt).coerceIn(height * 0.18f, height * 0.84f)

        if (enemy.fireCooldown <= 0f && dist < width * 0.72f) {
            fire(enemy, player.x, player.y, true)
            enemy.fireCooldown = 0.72f
        }

        val iterator = shots.iterator()
        while (iterator.hasNext()) {
            val shot = iterator.next()
            shot.life -= dt
            shot.x += shot.vx * dt
            shot.y += shot.vy * dt
            if (shot.life <= 0f || shot.x < -40f || shot.x > width + 40f || shot.y < -40f || shot.y > height + 40f) {
                iterator.remove()
                continue
            }
            val target = if (shot.enemy) player else enemy
            if (hypot((shot.x - target.x).toDouble(), (shot.y - target.y).toDouble()) < width * 0.052f) {
                dealDamage(target, if (shot.enemy) 11f else 15f, shot.enemy)
                iterator.remove()
            }
        }

        if (enemy.hp <= 0f || (roundTime <= 0f && player.hp > enemy.hp)) mode = Mode.WON
        if (player.hp <= 0f || (roundTime <= 0f && player.hp <= enemy.hp)) mode = Mode.LOST
    }

    private fun fire(source: Fighter, tx: Float, ty: Float, enemyShot: Boolean) {
        val angle = atan2(ty - source.y, tx - source.x)
        val speed = min(width, height) * 0.86f
        shots += Shot(
            source.x,
            source.y,
            cos(angle) * speed,
            sin(angle) * speed,
            1.65f,
            enemyShot
        )
        source.fireCooldown = if (enemyShot) 0.72f else 0.25f
        burst(source.x, source.y, enemyShot, 6)
    }

    private fun dealDamage(target: Fighter, amount: Float, enemyHit: Boolean) {
        var remaining = amount
        if (target.shield > 0f) {
            val absorbed = min(target.shield, remaining)
            target.shield -= absorbed
            remaining -= absorbed
        }
        if (remaining > 0f) target.hp = max(0f, target.hp - remaining)
        burst(target.x, target.y, enemyHit, 13)
    }

    private fun updateSparks(dt: Float) {
        val it = sparks.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.life -= dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vx *= 0.97f
            p.vy *= 0.97f
            if (p.life <= 0f) it.remove()
        }
    }

    private fun burst(x: Float, y: Float, enemySpark: Boolean, count: Int) {
        repeat(count) { i ->
            val a = i * (6.28318f / count) + elapsed
            val s = min(width, height) * (0.08f + (i % 3) * 0.025f)
            sparks += Spark(x, y, cos(a) * s, sin(a) * s, 0.32f, enemySpark)
        }
    }

    private fun drawArena(canvas: Canvas) {
        paint.shader = bg
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        val arena = RectF(width * 0.045f, height * 0.14f, width * 0.955f, height * 0.87f)
        paint.color = Color.rgb(8, 13, 31)
        canvas.drawRoundRect(arena, width * 0.05f, width * 0.05f, paint)

        stroke.strokeWidth = width * 0.003f
        stroke.color = Color.argb(95, 89, 222, 255)
        canvas.drawRoundRect(arena, width * 0.05f, width * 0.05f, stroke)

        for (i in 1..5) {
            val y = arena.top + arena.height() * i / 6f
            stroke.color = Color.argb(28, 107, 101, 255)
            canvas.drawLine(arena.left, y, arena.right, y, stroke)
        }
        for (i in 1..4) {
            val x = arena.left + arena.width() * i / 5f
            stroke.color = Color.argb(24, 107, 101, 255)
            canvas.drawLine(x, arena.top, x, arena.bottom, stroke)
        }

        val centerR = width * 0.15f
        stroke.strokeWidth = width * 0.005f
        stroke.color = Color.argb(80, 176, 80, 255)
        canvas.drawCircle(width * 0.5f, height * 0.505f, centerR, stroke)
        canvas.drawCircle(width * 0.5f, height * 0.505f, centerR * 0.46f, stroke)
    }

    private fun drawFighter(canvas: Canvas, fighter: Fighter, enemyFighter: Boolean) {
        val body = width * 0.055f
        val accent = if (enemyFighter) Color.rgb(255, 82, 157) else Color.rgb(91, 237, 255)
        paint.color = Color.argb(45, Color.red(accent), Color.green(accent), Color.blue(accent))
        canvas.drawCircle(fighter.x, fighter.y, body * 1.35f, paint)
        paint.color = Color.rgb(24, 29, 61)
        canvas.drawCircle(fighter.x, fighter.y, body, paint)
        stroke.strokeWidth = body * 0.13f
        stroke.color = accent
        canvas.drawCircle(fighter.x, fighter.y, body * 0.78f, stroke)
        paint.color = accent
        canvas.drawCircle(fighter.x, fighter.y, body * 0.23f, paint)

        val barW = width * 0.12f
        val barY = fighter.y - body * 1.55f
        paint.color = Color.argb(140, 10, 12, 24)
        canvas.drawRoundRect(RectF(fighter.x - barW / 2, barY, fighter.x + barW / 2, barY + 8f), 4f, 4f, paint)
        paint.color = accent
        canvas.drawRoundRect(RectF(fighter.x - barW / 2, barY, fighter.x - barW / 2 + barW * (fighter.hp / 100f), barY + 8f), 4f, 4f, paint)
    }

    private fun drawShots(canvas: Canvas) {
        for (shot in shots) {
            val c = if (shot.enemy) Color.rgb(255, 70, 145) else Color.rgb(86, 242, 255)
            paint.color = Color.argb(45, Color.red(c), Color.green(c), Color.blue(c))
            canvas.drawCircle(shot.x, shot.y, width * 0.019f, paint)
            paint.color = c
            canvas.drawCircle(shot.x, shot.y, width * 0.008f, paint)
        }
        for (p in sparks) {
            val alpha = (255f * (p.life / 0.32f).coerceIn(0f, 1f)).toInt()
            val c = if (p.enemy) Color.rgb(255, 74, 154) else Color.rgb(90, 237, 255)
            paint.color = Color.argb(alpha, Color.red(c), Color.green(c), Color.blue(c))
            canvas.drawCircle(p.x, p.y, width * 0.006f, paint)
        }
    }

    private fun drawHud(canvas: Canvas) {
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.034f
        text.color = Color.WHITE
        canvas.drawText("VOCÊ", width * 0.055f, height * 0.075f, text)
        drawMeter(canvas, width * 0.055f, height * 0.091f, width * 0.31f, player.hp, player.shield, false)

        text.textAlign = Paint.Align.RIGHT
        canvas.drawText("RIVAL", width * 0.945f, height * 0.075f, text)
        drawMeter(canvas, width * 0.635f, height * 0.091f, width * 0.31f, enemy.hp, enemy.shield, true)

        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.047f
        text.color = Color.rgb(191, 136, 255)
        canvas.drawText(roundTime.toInt().toString().padStart(2, '0'), width * 0.5f, height * 0.095f, text)
    }

    private fun drawMeter(canvas: Canvas, x: Float, y: Float, w: Float, hp: Float, shield: Float, enemyMeter: Boolean) {
        paint.color = Color.rgb(29, 33, 58)
        canvas.drawRoundRect(RectF(x, y, x + w, y + 9f), 4f, 4f, paint)
        paint.color = if (enemyMeter) Color.rgb(255, 78, 149) else Color.rgb(77, 239, 255)
        canvas.drawRoundRect(RectF(x, y, x + w * (hp / 100f), y + 9f), 4f, 4f, paint)
        paint.color = Color.rgb(126, 93, 255)
        canvas.drawRoundRect(RectF(x, y + 13f, x + w * (shield / 55f), y + 18f), 3f, 3f, paint)
    }

    private fun drawControls(canvas: Canvas) {
        if (mode != Mode.PLAYING) return
        val baseX = if (movePointer >= 0) moveOriginX else width * 0.18f
        val baseY = if (movePointer >= 0) moveOriginY else height * 0.90f
        stroke.strokeWidth = width * 0.004f
        stroke.color = Color.argb(95, 94, 224, 255)
        canvas.drawCircle(baseX, baseY, width * 0.075f, stroke)
        paint.color = Color.argb(80, 94, 224, 255)
        canvas.drawCircle(baseX + moveX * width * 0.040f, baseY + moveY * width * 0.040f, width * 0.029f, paint)

        val fireX = width * 0.82f
        val fireY = height * 0.90f
        paint.color = Color.argb(65, 255, 73, 161)
        canvas.drawCircle(fireX, fireY, width * 0.075f, paint)
        stroke.color = Color.rgb(255, 85, 176)
        canvas.drawCircle(fireX, fireY, width * 0.075f, stroke)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.023f
        text.color = Color.WHITE
        canvas.drawText("FIRE", fireX, fireY + width * 0.008f, text)
    }

    private fun drawOverlay(canvas: Canvas, title: String, subtitle: String, action: String) {
        paint.color = Color.argb(185, 2, 4, 13)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.085f
        text.color = Color.WHITE
        canvas.drawText(title, width * 0.5f, height * 0.42f, text)
        text.textSize = width * 0.031f
        text.color = Color.rgb(173, 184, 217)
        canvas.drawText(subtitle, width * 0.5f, height * 0.48f, text)

        val button = RectF(width * 0.18f, height * 0.57f, width * 0.82f, height * 0.66f)
        paint.color = Color.rgb(72, 61, 196)
        canvas.drawRoundRect(button, width * 0.04f, width * 0.04f, paint)
        text.textSize = width * 0.042f
        text.color = Color.WHITE
        canvas.drawText(action, width * 0.5f, height * 0.626f, text)

        text.textSize = width * 0.024f
        text.color = Color.rgb(132, 144, 178)
        canvas.drawText("esquerda: mover  •  direita: mirar/disparar", width * 0.5f, height * 0.74f, text)
    }

    private fun startRound() {
        resetPositions()
        mode = Mode.PLAYING
        lastFrame = SystemClock.uptimeMillis()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                if (mode != Mode.PLAYING) {
                    startRound()
                    performClick()
                    return true
                }
                val index = event.actionIndex
                val id = event.getPointerId(index)
                val x = event.getX(index)
                val y = event.getY(index)
                if (x < width * 0.5f && movePointer < 0) {
                    movePointer = id
                    moveOriginX = x
                    moveOriginY = y
                    moveX = 0f
                    moveY = 0f
                } else if (aimPointer < 0) {
                    aimPointer = id
                    aimX = x
                    aimY = y
                    if (player.fireCooldown <= 0f) fire(player, aimX, aimY, false)
                }
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (mode != Mode.PLAYING) return true
                if (movePointer >= 0) {
                    val idx = event.findPointerIndex(movePointer)
                    if (idx >= 0) {
                        val dx = event.getX(idx) - moveOriginX
                        val dy = event.getY(idx) - moveOriginY
                        val radius = width * 0.085f
                        moveX = (dx / radius).coerceIn(-1f, 1f)
                        moveY = (dy / radius).coerceIn(-1f, 1f)
                    }
                }
                if (aimPointer >= 0) {
                    val idx = event.findPointerIndex(aimPointer)
                    if (idx >= 0) {
                        aimX = event.getX(idx)
                        aimY = event.getY(idx)
                        if (player.fireCooldown <= 0f) fire(player, aimX, aimY, false)
                    }
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                val idx = event.actionIndex.coerceAtMost(event.pointerCount - 1)
                val id = if (idx >= 0) event.getPointerId(idx) else -1
                if (id == movePointer || event.actionMasked == MotionEvent.ACTION_CANCEL) {
                    movePointer = -1
                    moveX = 0f
                    moveY = 0f
                }
                if (id == aimPointer || event.actionMasked == MotionEvent.ACTION_CANCEL) {
                    aimPointer = -1
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
