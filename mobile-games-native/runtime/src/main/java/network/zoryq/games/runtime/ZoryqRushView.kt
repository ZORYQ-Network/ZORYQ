package network.zoryq.games.runtime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.random.Random

/**
 * ZORYQ Rush vertical slice.
 *
 * Deliberately built on Android Canvas only: no Unity, Unreal, Godot or game engine.
 * The view owns the update loop, perspective projection, input, collisions, procedural
 * visuals, particles, local progression and adaptive difficulty.
 */
class ZoryqRushView(context: Context) : View(context) {

    private enum class Mode { MENU, RUNNING, GAME_OVER }
    private enum class ObstacleType { BARRIER, LASER, BLOCK }

    private data class Obstacle(
        val lane: Int,
        var z: Float,
        val type: ObstacleType,
        var resolved: Boolean = false
    )

    private data class Coin(
        val lane: Int,
        var z: Float,
        var collected: Boolean = false
    )

    private data class Particle(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var life: Float,
        var size: Float,
        var hue: Int
    )

    private data class Star(val x: Float, val y: Float, val radius: Float, val alpha: Int)
    private data class Building(val x: Float, val width: Float, val height: Float, val seed: Int)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    private val random = Random(5919065)
    private val prefs = context.getSharedPreferences("zoryq_games", Context.MODE_PRIVATE)

    private var mode = Mode.MENU
    private var lastFrameMs = 0L
    private var worldTime = 0f
    private var distance = 0f
    private var speed = 0.42f
    private var score = 0
    private var bestScore = prefs.getInt(KEY_BEST, 0)
    private var zqCoins = 0
    private var combo = 1
    private var nearMissChain = 0

    private var targetLane = 1
    private var playerLaneVisual = 1f
    private var jumpHeight = 0f
    private var jumpVelocity = 0f
    private var slideTimer = 0f
    private var invulnerableTimer = 0f

    private var obstacleTimer = 0.8f
    private var coinTimer = 0.35f
    private val obstacles = ArrayList<Obstacle>()
    private val coins = ArrayList<Coin>()
    private val particles = ArrayList<Particle>()
    private val stars = ArrayList<Star>()
    private val buildings = ArrayList<Building>()

    private var touchDownX = 0f
    private var touchDownY = 0f
    private var touchDownTime = 0L

    private var horizonY = 0f
    private var roadBottomY = 0f
    private var bgShader: Shader? = null
    private var roadShader: Shader? = null

    init {
        isFocusable = true
        isClickable = true
        contentDescription = "ZORYQ Rush"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        horizonY = h * 0.29f
        roadBottomY = h * 0.96f
        bgShader = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(
                Color.rgb(4, 5, 18),
                Color.rgb(11, 14, 43),
                Color.rgb(18, 9, 49),
                Color.rgb(3, 5, 14)
            ),
            floatArrayOf(0f, 0.40f, 0.68f, 1f),
            Shader.TileMode.CLAMP
        )
        roadShader = LinearGradient(
            0f, horizonY, 0f, roadBottomY,
            intArrayOf(Color.rgb(15, 20, 49), Color.rgb(6, 8, 22)),
            null,
            Shader.TileMode.CLAMP
        )

        stars.clear()
        val starRandom = Random(9065)
        repeat(72) {
            stars += Star(
                starRandom.nextFloat() * w,
                starRandom.nextFloat() * horizonY * 1.05f,
                0.7f + starRandom.nextFloat() * 1.8f,
                80 + starRandom.nextInt(176)
            )
        }

        buildings.clear()
        var x = -0.03f
        val skylineRandom = Random(20260913)
        while (x < 1.05f) {
            val bw = 0.045f + skylineRandom.nextFloat() * 0.07f
            val bh = 0.06f + skylineRandom.nextFloat() * 0.16f
            buildings += Building(x, bw, bh, skylineRandom.nextInt())
            x += bw * (0.72f + skylineRandom.nextFloat() * 0.48f)
        }
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        if (lastFrameMs == 0L) lastFrameMs = now
        val dt = min(0.033f, max(0f, (now - lastFrameMs) / 1000f))
        lastFrameMs = now

        if (mode == Mode.RUNNING) updateGame(dt)
        updateParticles(dt)
        worldTime += dt

        drawWorld(canvas)
        drawHud(canvas)
        when (mode) {
            Mode.MENU -> drawMenu(canvas)
            Mode.GAME_OVER -> drawGameOver(canvas)
            Mode.RUNNING -> Unit
        }

        postInvalidateOnAnimation()
    }

    private fun updateGame(dt: Float) {
        distance += speed * dt * 112f
        speed = min(0.82f, speed + dt * 0.0105f)
        score = distance.toInt() + zqCoins * 25 + nearMissChain * 10
        playerLaneVisual += (targetLane - playerLaneVisual) * min(1f, dt * 13f)

        if (jumpHeight > 0f || jumpVelocity > 0f) {
            jumpVelocity -= 4.25f * dt
            jumpHeight += jumpVelocity * dt
            if (jumpHeight <= 0f) {
                jumpHeight = 0f
                jumpVelocity = 0f
            }
        }
        slideTimer = max(0f, slideTimer - dt)
        invulnerableTimer = max(0f, invulnerableTimer - dt)

        obstacleTimer -= dt
        if (obstacleTimer <= 0f) {
            spawnObstaclePattern()
            val difficulty = (speed - 0.42f) / 0.40f
            obstacleTimer = 0.94f - difficulty * 0.27f + random.nextFloat() * 0.34f
        }

        coinTimer -= dt
        if (coinTimer <= 0f) {
            spawnCoins()
            coinTimer = 0.62f + random.nextFloat() * 0.55f
        }

        val obstacleIterator = obstacles.iterator()
        while (obstacleIterator.hasNext()) {
            val obstacle = obstacleIterator.next()
            obstacle.z -= speed * dt

            if (!obstacle.resolved && obstacle.z <= 0.105f) {
                obstacle.resolved = true
                if (obstacle.lane == targetLane && invulnerableTimer <= 0f) {
                    val safe = when (obstacle.type) {
                        ObstacleType.BARRIER -> jumpHeight > 0.19f
                        ObstacleType.LASER -> slideTimer > 0f
                        ObstacleType.BLOCK -> false
                    }
                    if (!safe) {
                        finishRun()
                        return
                    } else {
                        nearMissChain += 1
                        combo = min(9, 1 + nearMissChain / 3)
                        burst(playerScreenX(), playerBaseY() - jumpHeightPx(), 10, 190)
                    }
                }
            }
            if (obstacle.z < -0.10f) obstacleIterator.remove()
        }

        val coinIterator = coins.iterator()
        while (coinIterator.hasNext()) {
            val coin = coinIterator.next()
            coin.z -= speed * dt
            if (!coin.collected && coin.z <= 0.10f && coin.lane == targetLane) {
                coin.collected = true
                zqCoins += combo
                burst(playerScreenX(), playerBaseY() - jumpHeightPx() - height * 0.065f, 7, 46)
            }
            if (coin.collected || coin.z < -0.08f) coinIterator.remove()
        }

        if (particles.size < 90 && random.nextFloat() < dt * 17f) {
            val px = playerScreenX() + (random.nextFloat() - 0.5f) * width * 0.035f
            val py = playerBaseY() - jumpHeightPx() + height * 0.018f
            particles += Particle(px, py, (random.nextFloat() - 0.5f) * 22f, 35f, 0.34f, 3f, 190)
        }
    }

    private fun spawnObstaclePattern() {
        val lane = random.nextInt(3)
        val roll = random.nextInt(100)
        val type = when {
            roll < 40 -> ObstacleType.BARRIER
            roll < 68 -> ObstacleType.LASER
            else -> ObstacleType.BLOCK
        }
        obstacles += Obstacle(lane, 1.04f, type)

        // At higher speed occasionally occupy a second lane, always leaving at least one route.
        if (speed > 0.58f && random.nextFloat() < 0.30f) {
            var second = random.nextInt(3)
            while (second == lane) second = random.nextInt(3)
            val secondType = if (type == ObstacleType.BLOCK) ObstacleType.BARRIER else ObstacleType.BLOCK
            obstacles += Obstacle(second, 1.055f, secondType)
        }
    }

    private fun spawnCoins() {
        val lane = random.nextInt(3)
        repeat(4) { index ->
            coins += Coin(lane, 0.88f + index * 0.075f)
        }
    }

    private fun updateParticles(dt: Float) {
        val iterator = particles.iterator()
        while (iterator.hasNext()) {
            val p = iterator.next()
            p.life -= dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vy += 22f * dt
            p.size *= 0.985f
            if (p.life <= 0f) iterator.remove()
        }
    }

    private fun finishRun() {
        mode = Mode.GAME_OVER
        burst(playerScreenX(), playerBaseY() - jumpHeightPx(), 34, 324)
        if (score > bestScore) {
            bestScore = score
            prefs.edit().putInt(KEY_BEST, bestScore).apply()
        }
    }

    private fun startRun() {
        mode = Mode.RUNNING
        distance = 0f
        speed = 0.42f
        score = 0
        zqCoins = 0
        combo = 1
        nearMissChain = 0
        targetLane = 1
        playerLaneVisual = 1f
        jumpHeight = 0f
        jumpVelocity = 0f
        slideTimer = 0f
        invulnerableTimer = 0.28f
        obstacleTimer = 1.0f
        coinTimer = 0.38f
        obstacles.clear()
        coins.clear()
        particles.clear()
        lastFrameMs = SystemClock.uptimeMillis()
    }

    private fun drawWorld(canvas: Canvas) {
        paint.style = Paint.Style.FILL
        paint.shader = bgShader
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        drawStars(canvas)
        drawMoonAndPortal(canvas)
        drawSkyline(canvas)
        drawHorizonGlow(canvas)
        drawRoad(canvas)
        drawObjects(canvas)
        drawPlayer(canvas)
        drawParticles(canvas)
    }

    private fun drawStars(canvas: Canvas) {
        for ((index, star) in stars.withIndex()) {
            val pulse = (0.70f + 0.30f * kotlin.math.sin(worldTime * 1.7f + index)).coerceIn(0f, 1f)
            paint.color = Color.argb((star.alpha * pulse).toInt(), 178, 222, 255)
            canvas.drawCircle(star.x, star.y, star.radius, paint)
        }
    }

    private fun drawMoonAndPortal(canvas: Canvas) {
        val cx = width * 0.77f
        val cy = height * 0.145f
        val r = width * 0.115f
        paint.color = Color.argb(22, 98, 80, 255)
        canvas.drawCircle(cx, cy, r * 1.35f, paint)
        paint.color = Color.argb(35, 82, 210, 255)
        canvas.drawCircle(cx, cy, r * 1.12f, paint)
        paint.color = Color.rgb(36, 43, 92)
        canvas.drawCircle(cx, cy, r, paint)
        paint.color = Color.argb(80, 116, 245, 255)
        canvas.drawCircle(cx - r * 0.24f, cy - r * 0.16f, r * 0.22f, paint)

        val portalX = width * 0.5f
        val portalTop = horizonY - height * 0.17f
        val portalBottom = horizonY + height * 0.015f
        val portalHalf = width * 0.055f
        strokePaint.strokeWidth = width * 0.008f
        strokePaint.color = Color.argb(90, 105, 77, 255)
        canvas.drawRoundRect(
            portalX - portalHalf * 1.25f, portalTop - height * 0.012f,
            portalX + portalHalf * 1.25f, portalBottom,
            width * 0.035f, width * 0.035f, strokePaint
        )
        strokePaint.strokeWidth = width * 0.0035f
        strokePaint.color = Color.rgb(94, 239, 255)
        canvas.drawRoundRect(
            portalX - portalHalf, portalTop,
            portalX + portalHalf, portalBottom,
            width * 0.028f, width * 0.028f, strokePaint
        )
    }

    private fun drawSkyline(canvas: Canvas) {
        val base = horizonY + height * 0.012f
        for (b in buildings) {
            val left = b.x * width
            val right = left + b.width * width
            val top = base - b.height * height
            paint.color = Color.rgb(12, 17, 42)
            canvas.drawRect(left, top, right, base, paint)

            val rows = 4 + abs(b.seed % 7)
            val cols = 2 + abs((b.seed / 11) % 4)
            val cellW = (right - left) / (cols + 1f)
            val cellH = (base - top) / (rows + 1f)
            for (row in 1..rows) {
                for (col in 1..cols) {
                    if (((row * 13 + col * 7 + b.seed) and 3) != 0) continue
                    paint.color = if (((row + col + b.seed) and 1) == 0) {
                        Color.argb(130, 90, 232, 255)
                    } else {
                        Color.argb(120, 168, 77, 255)
                    }
                    canvas.drawRect(
                        left + col * cellW - 1.5f,
                        top + row * cellH - 2f,
                        left + col * cellW + 1.5f,
                        top + row * cellH + 2f,
                        paint
                    )
                }
            }
        }
    }

    private fun drawHorizonGlow(canvas: Canvas) {
        repeat(5) { i ->
            paint.color = Color.argb(24 - i * 3, 66, 219, 255)
            canvas.drawRect(0f, horizonY + i * 3.5f, width.toFloat(), horizonY + (i + 1) * 3.5f, paint)
        }
    }

    private fun drawRoad(canvas: Canvas) {
        val center = width * 0.5f
        val topHalf = width * 0.085f
        val bottomHalf = width * 0.57f
        val road = Path().apply {
            moveTo(center - topHalf, horizonY)
            lineTo(center + topHalf, horizonY)
            lineTo(center + bottomHalf, roadBottomY)
            lineTo(center - bottomHalf, roadBottomY)
            close()
        }
        paint.shader = roadShader
        canvas.drawPath(road, paint)
        paint.shader = null

        strokePaint.strokeWidth = width * 0.006f
        strokePaint.color = Color.argb(185, 69, 222, 255)
        canvas.drawLine(center - topHalf, horizonY, center - bottomHalf, roadBottomY, strokePaint)
        strokePaint.color = Color.argb(185, 151, 76, 255)
        canvas.drawLine(center + topHalf, horizonY, center + bottomHalf, roadBottomY, strokePaint)

        // Perspective lane markers and animated energy streaks.
        for (divider in 1..2) {
            val laneNorm = divider / 3f
            val tx = (center - topHalf) + (topHalf * 2f) * laneNorm
            val bx = (center - bottomHalf) + (bottomHalf * 2f) * laneNorm
            strokePaint.strokeWidth = width * 0.0025f
            strokePaint.color = Color.argb(72, 136, 210, 255)
            canvas.drawLine(tx, horizonY, bx, roadBottomY, strokePaint)
        }

        for (i in 0 until 12) {
            var p = ((i / 12f + worldTime * speed * 0.55f) % 1f)
            p = p.pow(1.55f)
            val y = horizonY + (roadBottomY - horizonY) * p
            val half = topHalf + (bottomHalf - topHalf) * p
            paint.color = Color.argb((22 + p * 46).toInt(), 111, 98, 255)
            canvas.drawRect(center - half, y, center + half, y + 1f + p * 3f, paint)
        }
    }

    private fun drawObjects(canvas: Canvas) {
        obstacles.sortedByDescending { it.z }.forEach { drawObstacle(canvas, it) }
        coins.sortedByDescending { it.z }.forEach { drawCoin(canvas, it) }
    }

    private fun projectY(z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1.1f)
        return horizonY + (roadBottomY - horizonY) * p.pow(1.62f)
    }

    private fun perspectiveScale(z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1f)
        return 0.18f + p * 0.98f
    }

    private fun laneX(lane: Float, z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1f)
        val spread = width * (0.047f + p * 0.245f)
        return width * 0.5f + (lane - 1f) * spread
    }

    private fun drawObstacle(canvas: Canvas, obstacle: Obstacle) {
        if (obstacle.z > 1.1f || obstacle.z < -0.12f) return
        val x = laneX(obstacle.lane.toFloat(), obstacle.z)
        val y = projectY(obstacle.z)
        val s = perspectiveScale(obstacle.z)
        val w = width * 0.15f * s
        val h = height * 0.11f * s

        when (obstacle.type) {
            ObstacleType.BARRIER -> {
                paint.color = Color.argb(70, 255, 70, 171)
                canvas.drawRoundRect(RectF(x - w * 0.68f, y - h * 0.68f, x + w * 0.68f, y + h * 0.12f), w * 0.14f, w * 0.14f, paint)
                paint.color = Color.rgb(255, 75, 170)
                canvas.drawRoundRect(RectF(x - w * 0.54f, y - h * 0.54f, x + w * 0.54f, y), w * 0.10f, w * 0.10f, paint)
                paint.color = Color.WHITE
                canvas.drawRect(x - w * 0.28f, y - h * 0.42f, x + w * 0.28f, y - h * 0.34f, paint)
            }
            ObstacleType.LASER -> {
                paint.color = Color.argb(44, 255, 47, 96)
                canvas.drawRect(x - w, y - h * 1.32f, x + w, y - h * 0.70f, paint)
                paint.color = Color.rgb(255, 49, 99)
                canvas.drawRect(x - w * 0.92f, y - h * 1.10f, x + w * 0.92f, y - h * 0.91f, paint)
                paint.color = Color.rgb(58, 68, 112)
                canvas.drawRoundRect(RectF(x - w, y - h * 1.22f, x - w * 0.77f, y), w * 0.08f, w * 0.08f, paint)
                canvas.drawRoundRect(RectF(x + w * 0.77f, y - h * 1.22f, x + w, y), w * 0.08f, w * 0.08f, paint)
            }
            ObstacleType.BLOCK -> {
                paint.color = Color.argb(52, 135, 80, 255)
                canvas.drawRoundRect(RectF(x - w * 0.69f, y - h * 1.42f, x + w * 0.69f, y + h * 0.12f), w * 0.18f, w * 0.18f, paint)
                paint.color = Color.rgb(68, 39, 128)
                canvas.drawRoundRect(RectF(x - w * 0.56f, y - h * 1.30f, x + w * 0.56f, y), w * 0.14f, w * 0.14f, paint)
                strokePaint.strokeWidth = max(1f, w * 0.035f)
                strokePaint.color = Color.rgb(97, 238, 255)
                canvas.drawRoundRect(RectF(x - w * 0.40f, y - h * 1.12f, x + w * 0.40f, y - h * 0.20f), w * 0.10f, w * 0.10f, strokePaint)
            }
        }
    }

    private fun drawCoin(canvas: Canvas, coin: Coin) {
        if (coin.z > 1.15f || coin.z < -0.10f) return
        val x = laneX(coin.lane.toFloat(), coin.z)
        val y = projectY(coin.z) - height * 0.045f * perspectiveScale(coin.z)
        val r = width * 0.029f * perspectiveScale(coin.z)
        paint.color = Color.argb(52, 63, 245, 255)
        canvas.drawCircle(x, y, r * 1.65f, paint)
        paint.color = Color.rgb(85, 245, 255)
        canvas.drawCircle(x, y, r, paint)
        paint.color = Color.rgb(15, 36, 75)
        canvas.drawCircle(x, y, r * 0.68f, paint)
        textPaint.textAlign = Paint.Align.CENTER
        textPaint.textSize = r * 0.82f
        textPaint.color = Color.WHITE
        canvas.drawText("Z", x, y + r * 0.29f, textPaint)
    }

    private fun playerBaseY(): Float = height * 0.825f
    private fun jumpHeightPx(): Float = jumpHeight * height * 0.29f
    private fun playerScreenX(): Float = laneX(playerLaneVisual, 0.035f)

    private fun drawPlayer(canvas: Canvas) {
        val x = playerScreenX()
        val baseY = playerBaseY() - jumpHeightPx()
        val bodyH = if (slideTimer > 0f) height * 0.070f else height * 0.115f
        val bodyW = width * 0.083f

        // Ground shadow.
        paint.color = Color.argb((75 * (1f - min(0.65f, jumpHeight))).toInt(), 75, 225, 255)
        canvas.drawOval(
            RectF(x - bodyW * 0.85f, playerBaseY() + height * 0.042f, x + bodyW * 0.85f, playerBaseY() + height * 0.058f),
            paint
        )

        // Energy trail / silhouette glow.
        paint.color = Color.argb(44, 124, 75, 255)
        canvas.drawRoundRect(
            RectF(x - bodyW * 0.70f, baseY - bodyH * 1.28f, x + bodyW * 0.70f, baseY + bodyH * 0.30f),
            bodyW * 0.45f, bodyW * 0.45f, paint
        )

        if (slideTimer > 0f) {
            paint.color = Color.rgb(32, 37, 74)
            canvas.drawRoundRect(RectF(x - bodyW * 0.78f, baseY - bodyH * 0.75f, x + bodyW * 0.78f, baseY + bodyH * 0.12f), bodyW * 0.32f, bodyW * 0.32f, paint)
            paint.color = Color.rgb(102, 235, 255)
            canvas.drawRect(x - bodyW * 0.48f, baseY - bodyH * 0.54f, x + bodyW * 0.22f, baseY - bodyH * 0.45f, paint)
        } else {
            val legSwing = kotlin.math.sin(worldTime * 14f) * bodyW * 0.17f
            strokePaint.strokeWidth = bodyW * 0.22f
            strokePaint.strokeCap = Paint.Cap.ROUND
            strokePaint.color = Color.rgb(29, 35, 69)
            canvas.drawLine(x - bodyW * 0.18f, baseY - bodyH * 0.18f, x - bodyW * 0.25f + legSwing, baseY + bodyH * 0.36f, strokePaint)
            canvas.drawLine(x + bodyW * 0.18f, baseY - bodyH * 0.18f, x + bodyW * 0.25f - legSwing, baseY + bodyH * 0.36f, strokePaint)
            strokePaint.strokeCap = Paint.Cap.BUTT

            paint.color = Color.rgb(35, 41, 82)
            canvas.drawRoundRect(RectF(x - bodyW * 0.47f, baseY - bodyH, x + bodyW * 0.47f, baseY - bodyH * 0.12f), bodyW * 0.26f, bodyW * 0.26f, paint)
            paint.color = Color.rgb(104, 240, 255)
            canvas.drawRoundRect(RectF(x - bodyW * 0.31f, baseY - bodyH * 0.78f, x + bodyW * 0.31f, baseY - bodyH * 0.66f), bodyW * 0.08f, bodyW * 0.08f, paint)

            paint.color = Color.rgb(188, 202, 229)
            canvas.drawCircle(x, baseY - bodyH * 1.15f, bodyW * 0.30f, paint)
            paint.color = Color.rgb(91, 55, 184)
            canvas.drawArc(RectF(x - bodyW * 0.30f, baseY - bodyH * 1.43f, x + bodyW * 0.30f, baseY - bodyH * 0.87f), 180f, 190f, true, paint)
        }

        // ZORYQ core on the runner's back/chest.
        paint.color = Color.argb(58, 98, 83, 255)
        canvas.drawCircle(x, baseY - bodyH * 0.53f, bodyW * 0.24f, paint)
        paint.color = Color.rgb(112, 238, 255)
        canvas.drawCircle(x, baseY - bodyH * 0.53f, bodyW * 0.11f, paint)
    }

    private fun drawParticles(canvas: Canvas) {
        for (p in particles) {
            val alpha = (255f * (p.life / 0.55f).coerceIn(0f, 1f)).toInt()
            val color = when (p.hue) {
                46 -> Color.rgb(102, 255, 220)
                324 -> Color.rgb(255, 65, 190)
                else -> Color.rgb(100, 222, 255)
            }
            paint.color = Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))
            canvas.drawCircle(p.x, p.y, max(1f, p.size), paint)
        }
    }

    private fun drawHud(canvas: Canvas) {
        if (mode == Mode.MENU) return
        val pad = width * 0.052f
        val top = height * 0.052f
        paint.color = Color.argb(150, 6, 9, 25)
        canvas.drawRoundRect(RectF(pad, top, width - pad, top + height * 0.095f), width * 0.035f, width * 0.035f, paint)

        textPaint.textAlign = Paint.Align.LEFT
        textPaint.textSize = width * 0.047f
        textPaint.color = Color.WHITE
        canvas.drawText(score.toString().padStart(5, '0'), pad * 1.38f, top + height * 0.040f, textPaint)
        textPaint.textSize = width * 0.025f
        textPaint.color = Color.rgb(120, 214, 255)
        canvas.drawText("SCORE", pad * 1.38f, top + height * 0.071f, textPaint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.textSize = width * 0.041f
        textPaint.color = Color.rgb(100, 247, 255)
        canvas.drawText("ZQ $zqCoins", width * 0.51f, top + height * 0.050f, textPaint)

        textPaint.textAlign = Paint.Align.RIGHT
        textPaint.textSize = width * 0.038f
        textPaint.color = Color.rgb(209, 135, 255)
        canvas.drawText("x$combo", width - pad * 1.38f, top + height * 0.048f, textPaint)
        textPaint.textSize = width * 0.022f
        textPaint.color = Color.rgb(165, 171, 209)
        canvas.drawText("COMBO", width - pad * 1.38f, top + height * 0.071f, textPaint)
    }

    private fun drawMenu(canvas: Canvas) {
        paint.color = Color.argb(100, 1, 3, 13)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.color = Color.WHITE
        textPaint.textSize = width * 0.105f
        canvas.drawText("ZORYQ", width * 0.5f, height * 0.37f, textPaint)
        textPaint.textSize = width * 0.135f
        textPaint.color = Color.rgb(97, 236, 255)
        canvas.drawText("RUSH", width * 0.5f, height * 0.47f, textPaint)

        textPaint.textSize = width * 0.031f
        textPaint.color = Color.rgb(184, 190, 220)
        canvas.drawText("NEO ZORYA // RUN THE NETWORK", width * 0.5f, height * 0.515f, textPaint)

        val button = RectF(width * 0.18f, height * 0.61f, width * 0.82f, height * 0.70f)
        paint.color = Color.argb(78, 87, 78, 255)
        canvas.drawRoundRect(RectF(button.left - 5f, button.top - 5f, button.right + 5f, button.bottom + 5f), width * 0.05f, width * 0.05f, paint)
        paint.color = Color.rgb(83, 73, 220)
        canvas.drawRoundRect(button, width * 0.045f, width * 0.045f, paint)
        textPaint.textSize = width * 0.049f
        textPaint.color = Color.WHITE
        canvas.drawText("INICIAR CORRIDA", width * 0.5f, height * 0.666f, textPaint)

        textPaint.textSize = width * 0.027f
        textPaint.color = Color.rgb(154, 164, 203)
        canvas.drawText("← → trocar pista     ↑ pular     ↓ deslizar", width * 0.5f, height * 0.755f, textPaint)
        canvas.drawText("Recorde  $bestScore", width * 0.5f, height * 0.806f, textPaint)
    }

    private fun drawGameOver(canvas: Canvas) {
        paint.color = Color.argb(178, 3, 4, 15)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)

        textPaint.textAlign = Paint.Align.CENTER
        textPaint.textSize = width * 0.050f
        textPaint.color = Color.rgb(255, 94, 177)
        canvas.drawText("RUN ENCERRADA", width * 0.5f, height * 0.37f, textPaint)
        textPaint.textSize = width * 0.145f
        textPaint.color = Color.WHITE
        canvas.drawText(score.toString(), width * 0.5f, height * 0.49f, textPaint)
        textPaint.textSize = width * 0.029f
        textPaint.color = Color.rgb(151, 226, 255)
        canvas.drawText("$zqCoins ZQ coletados   •   recorde $bestScore", width * 0.5f, height * 0.545f, textPaint)

        val button = RectF(width * 0.20f, height * 0.62f, width * 0.80f, height * 0.705f)
        paint.color = Color.rgb(52, 76, 205)
        canvas.drawRoundRect(button, width * 0.042f, width * 0.042f, paint)
        textPaint.textSize = width * 0.046f
        textPaint.color = Color.WHITE
        canvas.drawText("CORRER DE NOVO", width * 0.5f, height * 0.674f, textPaint)
    }

    private fun burst(x: Float, y: Float, count: Int, hue: Int) {
        repeat(count) {
            if (particles.size >= 110) return@repeat
            particles += Particle(
                x = x + (random.nextFloat() - 0.5f) * width * 0.035f,
                y = y + (random.nextFloat() - 0.5f) * height * 0.025f,
                vx = (random.nextFloat() - 0.5f) * 150f,
                vy = (random.nextFloat() - 0.75f) * 170f,
                life = 0.28f + random.nextFloat() * 0.30f,
                size = 2.2f + random.nextFloat() * 5.2f,
                hue = hue
            )
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchDownX = event.x
                touchDownY = event.y
                touchDownTime = SystemClock.uptimeMillis()
                return true
            }
            MotionEvent.ACTION_UP -> {
                val dx = event.x - touchDownX
                val dy = event.y - touchDownY
                val elapsed = SystemClock.uptimeMillis() - touchDownTime
                val threshold = width * 0.075f

                when (mode) {
                    Mode.MENU, Mode.GAME_OVER -> startRun()
                    Mode.RUNNING -> {
                        if (abs(dx) < threshold && abs(dy) < threshold && elapsed < 260L) {
                            jump()
                        } else if (abs(dx) > abs(dy)) {
                            if (dx > threshold) changeLane(1) else if (dx < -threshold) changeLane(-1)
                        } else {
                            if (dy < -threshold) jump() else if (dy > threshold) slide()
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

    private fun changeLane(direction: Int) {
        targetLane = (targetLane + direction).coerceIn(0, 2)
        burst(playerScreenX(), playerBaseY(), 3, 190)
    }

    private fun jump() {
        if (jumpHeight <= 0.001f && slideTimer <= 0f) {
            jumpVelocity = 1.68f
            jumpHeight = 0.002f
            burst(playerScreenX(), playerBaseY(), 6, 190)
        }
    }

    private fun slide() {
        if (jumpHeight <= 0.035f) {
            slideTimer = 0.62f
            burst(playerScreenX(), playerBaseY(), 5, 324)
        }
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        lastFrameMs = SystemClock.uptimeMillis()
    }

    companion object {
        private const val KEY_BEST = "rush_best_score_v1"
    }
}
