package network.zoryq.games.runtime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.random.Random

/**
 * Premium native Canvas renderer for ZORYQ Rush.
 * No external game engine, modelling tool or runtime dependency is required.
 */
class ZoryqRushPremiumView(context: Context) : View(context) {
    private enum class Mode { MENU, RUNNING, GAME_OVER }
    private enum class ObstacleKind { BARRIER, LASER, BLOCK, DRONE }

    private data class Obstacle(val lane: Int, var z: Float, val kind: ObstacleKind, var resolved: Boolean = false)
    private data class Shard(val lane: Int, var z: Float, var collected: Boolean = false)
    private data class Particle(var x: Float, var y: Float, var vx: Float, var vy: Float, var life: Float, var radius: Float, val color: Int)
    private data class Tower(val x: Float, val w: Float, val h: Float, val tier: Int, val phase: Float)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    private val random = Random(5919065)
    private val prefs = context.getSharedPreferences("zoryq_games", Context.MODE_PRIVATE)

    private var mode = Mode.MENU
    private var lastFrame = 0L
    private var worldTime = 0f
    private var distance = 0f
    private var speed = 0.43f
    private var score = 0
    private var best = prefs.getInt("rush_premium_best", 0)
    private var shards = 0
    private var combo = 1
    private var nearMiss = 0
    private var targetLane = 1
    private var laneVisual = 1f
    private var jump = 0f
    private var jumpVelocity = 0f
    private var slide = 0f
    private var invulnerability = 0f
    private var obstacleClock = 0.9f
    private var shardClock = 0.35f
    private var overdrive = 0f
    private var overdriveCharge = 0f
    private var cameraKick = 0f
    private var lastAction = ""
    private var lastActionTimer = 0f

    private var touchX = 0f
    private var touchY = 0f
    private var touchTime = 0L

    private val obstacles = ArrayList<Obstacle>()
    private val shardList = ArrayList<Shard>()
    private val particles = ArrayList<Particle>()
    private val towers = ArrayList<Tower>()

    private var horizon = 0f
    private var roadBottom = 0f
    private var sky: Shader? = null
    private var road: Shader? = null

    init {
        isFocusable = true
        isClickable = true
        contentDescription = "ZORYQ Rush Premium"
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        horizon = h * 0.30f
        roadBottom = h * 0.97f
        sky = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(Color.rgb(4, 7, 22), Color.rgb(18, 17, 58), Color.rgb(32, 12, 62), Color.rgb(5, 9, 24)),
            floatArrayOf(0f, 0.38f, 0.66f, 1f), Shader.TileMode.CLAMP
        )
        road = LinearGradient(
            0f, horizon, 0f, roadBottom,
            intArrayOf(Color.rgb(18, 26, 57), Color.rgb(7, 10, 27)), null, Shader.TileMode.CLAMP
        )
        towers.clear()
        val r = Random(20260913)
        var x = -0.04f
        while (x < 1.05f) {
            val tw = 0.045f + r.nextFloat() * 0.055f
            towers += Tower(x, tw, 0.08f + r.nextFloat() * 0.22f, r.nextInt(3), r.nextFloat() * 6.28f)
            x += tw * (0.78f + r.nextFloat() * 0.52f)
        }
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        if (lastFrame == 0L) lastFrame = now
        val dt = min(0.033f, max(0f, (now - lastFrame) / 1000f))
        lastFrame = now
        worldTime += dt
        if (mode == Mode.RUNNING) update(dt)
        updateParticles(dt)
        cameraKick = max(0f, cameraKick - dt * 3.8f)
        lastActionTimer = max(0f, lastActionTimer - dt)

        val shakeX = if (cameraKick > 0f) sin(worldTime * 54f) * width * 0.006f * cameraKick else 0f
        val shakeY = if (cameraKick > 0f) cos(worldTime * 47f) * height * 0.004f * cameraKick else 0f
        canvas.save()
        canvas.translate(shakeX, shakeY)
        drawWorld(canvas)
        canvas.restore()
        drawHud(canvas)
        when (mode) {
            Mode.MENU -> drawMenu(canvas)
            Mode.GAME_OVER -> drawGameOver(canvas)
            Mode.RUNNING -> Unit
        }
        postInvalidateOnAnimation()
    }

    private fun update(dt: Float) {
        val boost = if (overdrive > 0f) 1.22f else 1f
        distance += speed * boost * dt * 120f
        speed = min(0.84f, speed + dt * 0.0108f)
        score = distance.toInt() + shards * 30 + nearMiss * 15
        laneVisual += (targetLane - laneVisual) * min(1f, dt * 14.5f)
        overdrive = max(0f, overdrive - dt)
        if (overdrive <= 0f) overdriveCharge = min(1f, overdriveCharge + dt * 0.012f)

        if (jump > 0f || jumpVelocity > 0f) {
            jumpVelocity -= 4.4f * dt
            jump += jumpVelocity * dt
            if (jump <= 0f) {
                jump = 0f
                jumpVelocity = 0f
                burst(playerX(), playerBaseY() + height * 0.01f, 7, Color.rgb(86, 233, 255), 42f)
            }
        }
        slide = max(0f, slide - dt)
        invulnerability = max(0f, invulnerability - dt)

        obstacleClock -= dt
        if (obstacleClock <= 0f) {
            spawnObstaclePattern()
            val difficulty = ((speed - 0.43f) / 0.41f).coerceIn(0f, 1f)
            obstacleClock = 0.92f - difficulty * 0.29f + random.nextFloat() * 0.31f
        }
        shardClock -= dt
        if (shardClock <= 0f) {
            spawnShardTrail()
            shardClock = 0.58f + random.nextFloat() * 0.48f
        }

        val oi = obstacles.iterator()
        while (oi.hasNext()) {
            val o = oi.next()
            o.z -= speed * boost * dt
            if (!o.resolved && o.z <= 0.11f) {
                o.resolved = true
                if (o.lane == targetLane && invulnerability <= 0f) {
                    val safe = when (o.kind) {
                        ObstacleKind.BARRIER -> jump > 0.18f
                        ObstacleKind.LASER -> slide > 0f
                        ObstacleKind.DRONE -> slide > 0f || jump > 0.22f
                        ObstacleKind.BLOCK -> false
                    }
                    if (!safe) {
                        finishRun()
                        return
                    } else {
                        nearMiss++
                        combo = min(12, 1 + nearMiss / 2)
                        overdriveCharge = min(1f, overdriveCharge + 0.07f)
                        action("NEAR MISS  +${combo}x")
                        cameraKick = 0.30f
                        burst(playerX(), playerBaseY() - jumpPx(), 13, Color.rgb(255, 77, 214), 94f)
                    }
                }
            }
            if (o.z < -0.12f) oi.remove()
        }

        val si = shardList.iterator()
        while (si.hasNext()) {
            val s = si.next()
            s.z -= speed * boost * dt
            if (!s.collected && s.z <= 0.105f && s.lane == targetLane) {
                s.collected = true
                shards += combo
                overdriveCharge = min(1f, overdriveCharge + 0.025f)
                burst(playerX(), playerBaseY() - jumpPx() - height * 0.06f, 8, Color.rgb(76, 243, 255), 70f)
            }
            if (s.collected || s.z < -0.10f) si.remove()
        }

        if (particles.size < 120 && random.nextFloat() < dt * (if (overdrive > 0f) 32f else 16f)) {
            particles += Particle(
                playerX() + (random.nextFloat() - 0.5f) * width * 0.06f,
                playerBaseY() - jumpPx() + height * 0.025f,
                (random.nextFloat() - 0.5f) * 26f,
                42f + random.nextFloat() * 40f,
                0.38f,
                2.5f + random.nextFloat() * 3.5f,
                if (overdrive > 0f) Color.rgb(255, 91, 221) else Color.rgb(77, 236, 255)
            )
        }
    }

    private fun spawnObstaclePattern() {
        val lane = random.nextInt(3)
        val kind = when (random.nextInt(100)) {
            in 0..31 -> ObstacleKind.BARRIER
            in 32..58 -> ObstacleKind.LASER
            in 59..81 -> ObstacleKind.BLOCK
            else -> ObstacleKind.DRONE
        }
        obstacles += Obstacle(lane, 1.04f, kind)
        if (speed > 0.60f && random.nextFloat() < 0.28f) {
            var second = random.nextInt(3)
            while (second == lane) second = random.nextInt(3)
            obstacles += Obstacle(second, 1.07f, if (kind == ObstacleKind.BLOCK) ObstacleKind.BARRIER else ObstacleKind.BLOCK)
        }
    }

    private fun spawnShardTrail() {
        val lane = random.nextInt(3)
        repeat(5) { i -> shardList += Shard(lane, 0.82f + i * 0.065f) }
    }

    private fun updateParticles(dt: Float) {
        val it = particles.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.life -= dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.vy += 28f * dt
            p.radius *= 0.982f
            if (p.life <= 0f) it.remove()
        }
    }

    private fun startRun() {
        mode = Mode.RUNNING
        distance = 0f
        speed = 0.43f
        score = 0
        shards = 0
        combo = 1
        nearMiss = 0
        targetLane = 1
        laneVisual = 1f
        jump = 0f
        jumpVelocity = 0f
        slide = 0f
        invulnerability = 0.35f
        obstacleClock = 1.05f
        shardClock = 0.32f
        overdrive = 0f
        overdriveCharge = 0f
        obstacles.clear()
        shardList.clear()
        particles.clear()
        lastFrame = SystemClock.uptimeMillis()
    }

    private fun finishRun() {
        mode = Mode.GAME_OVER
        cameraKick = 1f
        burst(playerX(), playerBaseY() - jumpPx(), 34, Color.rgb(255, 63, 122), 180f)
        if (score > best) {
            best = score
            prefs.edit().putInt("rush_premium_best", best).apply()
        }
    }

    private fun activateOverdrive() {
        if (overdriveCharge >= 1f && mode == Mode.RUNNING) {
            overdriveCharge = 0f
            overdrive = 5.5f
            invulnerability = max(invulnerability, 0.45f)
            cameraKick = 0.65f
            action("ZORYQ OVERDRIVE")
            burst(playerX(), playerBaseY() - jumpPx(), 40, Color.rgb(255, 82, 232), 210f)
        }
    }

    private fun action(value: String) {
        lastAction = value
        lastActionTimer = 1.05f
    }

    private fun drawWorld(canvas: Canvas) {
        paint.shader = sky
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null
        drawAtmosphere(canvas)
        drawCity(canvas)
        drawRoad(canvas)
        drawObjects(canvas)
        drawRunner(canvas)
        drawParticles(canvas)
        if (overdrive > 0f) drawOverdrive(canvas)
    }

    private fun drawAtmosphere(canvas: Canvas) {
        val pulse = 0.5f + 0.5f * sin(worldTime * 0.7f)
        val cx = width * 0.78f
        val cy = height * 0.13f
        val r = width * 0.14f
        paint.shader = RadialGradient(cx, cy, r * 1.5f, Color.argb(70, 112, 77, 255), Color.TRANSPARENT, Shader.TileMode.CLAMP)
        canvas.drawCircle(cx, cy, r * 1.5f, paint)
        paint.shader = null
        paint.color = Color.rgb(31, 41, 91)
        canvas.drawCircle(cx, cy, r * 0.72f, paint)
        stroke.strokeWidth = width * 0.006f
        stroke.color = Color.argb((120 + pulse * 80).toInt(), 84, 236, 255)
        canvas.drawCircle(width * 0.5f, horizon - height * 0.075f, width * 0.075f, stroke)
        stroke.strokeWidth = width * 0.002f
        stroke.color = Color.argb(120, 180, 88, 255)
        canvas.drawCircle(width * 0.5f, horizon - height * 0.075f, width * 0.055f, stroke)

        repeat(20) { i ->
            val y = ((i * 53f + worldTime * speed * 500f) % (height * 0.72f))
            val alpha = 18 + (i % 4) * 8
            paint.color = Color.argb(alpha, 103, 211, 255)
            canvas.drawRect(0f, y, width.toFloat(), y + 1f, paint)
        }
    }

    private fun drawCity(canvas: Canvas) {
        val base = horizon + height * 0.018f
        for ((index, t) in towers.withIndex()) {
            val left = t.x * width
            val right = left + t.w * width
            val top = base - t.h * height
            paint.color = when (t.tier) {
                0 -> Color.rgb(10, 18, 45)
                1 -> Color.rgb(18, 20, 55)
                else -> Color.rgb(20, 14, 52)
            }
            val rr = width * 0.006f
            canvas.drawRoundRect(RectF(left, top, right, base), rr, rr, paint)
            val glow = (70 + 45 * (0.5f + 0.5f * sin(worldTime * 1.2f + t.phase))).toInt()
            val rows = 4 + abs(index % 7)
            repeat(rows) { row ->
                if ((row + index) % 2 == 0) {
                    paint.color = if ((row + t.tier) % 2 == 0) Color.argb(glow, 70, 232, 255) else Color.argb(glow, 183, 77, 255)
                    val yy = top + (row + 1f) * (base - top) / (rows + 1f)
                    canvas.drawRect(left + t.w * width * 0.22f, yy, right - t.w * width * 0.22f, yy + 2f, paint)
                }
            }
        }
        paint.color = Color.argb(38, 89, 219, 255)
        canvas.drawRect(0f, horizon, width.toFloat(), horizon + height * 0.018f, paint)
    }

    private fun drawRoad(canvas: Canvas) {
        val center = width * 0.5f
        val topHalf = width * 0.088f
        val bottomHalf = width * 0.59f
        val p = Path().apply {
            moveTo(center - topHalf, horizon)
            lineTo(center + topHalf, horizon)
            lineTo(center + bottomHalf, roadBottom)
            lineTo(center - bottomHalf, roadBottom)
            close()
        }
        paint.shader = road
        canvas.drawPath(p, paint)
        paint.shader = null

        stroke.strokeWidth = width * 0.007f
        stroke.color = Color.argb(210, 70, 231, 255)
        canvas.drawLine(center - topHalf, horizon, center - bottomHalf, roadBottom, stroke)
        stroke.color = Color.argb(210, 193, 77, 255)
        canvas.drawLine(center + topHalf, horizon, center + bottomHalf, roadBottom, stroke)

        repeat(2) { d ->
            val n = (d + 1f) / 3f
            stroke.strokeWidth = width * 0.0024f
            stroke.color = Color.argb(85, 132, 212, 255)
            canvas.drawLine(center - topHalf + 2f * topHalf * n, horizon, center - bottomHalf + 2f * bottomHalf * n, roadBottom, stroke)
        }

        repeat(15) { i ->
            var t = (i / 15f + worldTime * speed * (if (overdrive > 0f) 1.0f else 0.62f)) % 1f
            t = t.pow(1.60f)
            val y = horizon + (roadBottom - horizon) * t
            val half = topHalf + (bottomHalf - topHalf) * t
            paint.color = Color.argb((18 + t * 52).toInt(), 117, 95, 255)
            canvas.drawRect(center - half, y, center + half, y + 1f + t * 3.8f, paint)
        }
    }

    private fun drawObjects(canvas: Canvas) {
        obstacles.sortedByDescending { it.z }.forEach { drawObstacle(canvas, it) }
        shardList.sortedByDescending { it.z }.forEach { drawShard(canvas, it) }
    }

    private fun projectY(z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1.08f)
        return horizon + (roadBottom - horizon) * p.pow(1.62f)
    }

    private fun scale(z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1f)
        return 0.17f + p * 1.0f
    }

    private fun laneX(lane: Float, z: Float): Float {
        val p = (1f - z).coerceIn(0f, 1f)
        return width * 0.5f + (lane - 1f) * width * (0.05f + p * 0.25f)
    }

    private fun drawObstacle(canvas: Canvas, o: Obstacle) {
        if (o.z > 1.12f || o.z < -0.12f) return
        val x = laneX(o.lane.toFloat(), o.z)
        val y = projectY(o.z)
        val s = scale(o.z)
        val w = width * 0.14f * s
        val h = height * 0.11f * s
        when (o.kind) {
            ObstacleKind.BARRIER -> {
                glowRect(canvas, RectF(x - w * .7f, y - h * .62f, x + w * .7f, y), Color.rgb(255, 70, 188), w * .13f)
                paint.color = Color.rgb(48, 26, 72)
                canvas.drawRoundRect(RectF(x - w * .55f, y - h * .50f, x + w * .55f, y), w * .09f, w * .09f, paint)
                paint.color = Color.rgb(255, 103, 207)
                canvas.drawRect(x - w * .32f, y - h * .38f, x + w * .32f, y - h * .30f, paint)
            }
            ObstacleKind.LASER -> {
                paint.color = Color.rgb(50, 58, 98)
                canvas.drawRoundRect(RectF(x - w, y - h * 1.25f, x - w * .78f, y), w * .06f, w * .06f, paint)
                canvas.drawRoundRect(RectF(x + w * .78f, y - h * 1.25f, x + w, y), w * .06f, w * .06f, paint)
                paint.color = Color.argb(70, 255, 45, 113)
                canvas.drawRect(x - w, y - h * 1.04f, x + w, y - h * .83f, paint)
                paint.color = Color.rgb(255, 54, 119)
                canvas.drawRect(x - w * .94f, y - h * .98f, x + w * .94f, y - h * .90f, paint)
            }
            ObstacleKind.BLOCK -> {
                glowRect(canvas, RectF(x - w * .67f, y - h * 1.42f, x + w * .67f, y), Color.rgb(114, 80, 255), w * .15f)
                paint.color = Color.rgb(46, 35, 97)
                canvas.drawRoundRect(RectF(x - w * .53f, y - h * 1.29f, x + w * .53f, y), w * .12f, w * .12f, paint)
                stroke.strokeWidth = max(1f, w * .035f)
                stroke.color = Color.rgb(84, 242, 255)
                canvas.drawRoundRect(RectF(x - w * .36f, y - h * 1.08f, x + w * .36f, y - h * .24f), w * .08f, w * .08f, stroke)
            }
            ObstacleKind.DRONE -> {
                paint.color = Color.argb(55, 255, 83, 217)
                canvas.drawCircle(x, y - h * .78f, w * .72f, paint)
                paint.color = Color.rgb(59, 48, 103)
                canvas.drawRoundRect(RectF(x - w * .55f, y - h * .95f, x + w * .55f, y - h * .62f), w * .15f, w * .15f, paint)
                paint.color = Color.rgb(87, 239, 255)
                canvas.drawCircle(x, y - h * .79f, w * .14f, paint)
                stroke.strokeWidth = max(1f, w * .06f)
                stroke.color = Color.rgb(255, 77, 214)
                canvas.drawLine(x - w * .82f, y - h * .78f, x - w * .52f, y - h * .78f, stroke)
                canvas.drawLine(x + w * .52f, y - h * .78f, x + w * .82f, y - h * .78f, stroke)
            }
        }
    }

    private fun drawShard(canvas: Canvas, s: Shard) {
        if (s.z > 1.14f || s.z < -0.10f) return
        val x = laneX(s.lane.toFloat(), s.z)
        val y = projectY(s.z) - height * 0.05f * scale(s.z)
        val r = width * 0.024f * scale(s.z)
        val phase = worldTime * 5f + s.z * 12f
        paint.color = Color.argb(46, 70, 240, 255)
        canvas.drawCircle(x, y, r * 1.75f, paint)
        val path = Path().apply {
            moveTo(x, y - r * (1.1f + .12f * sin(phase)))
            lineTo(x + r * .72f, y)
            lineTo(x, y + r * 1.1f)
            lineTo(x - r * .72f, y)
            close()
        }
        paint.color = Color.rgb(85, 246, 255)
        canvas.drawPath(path, paint)
        paint.color = Color.WHITE
        canvas.drawCircle(x, y, r * .20f, paint)
    }

    private fun playerBaseY() = height * 0.825f
    private fun jumpPx() = jump * height * 0.29f
    private fun playerX() = laneX(laneVisual, 0.035f)

    private fun drawRunner(canvas: Canvas) {
        val x = playerX()
        val y = playerBaseY() - jumpPx()
        val slideNow = slide > 0f
        val bodyH = if (slideNow) height * .070f else height * .125f
        val bodyW = width * .082f
        val runPhase = worldTime * (9f + speed * 8f)

        paint.color = Color.argb((82 * (1f - min(.7f, jump))).toInt(), 70, 230, 255)
        canvas.drawOval(RectF(x - bodyW, playerBaseY() + height * .042f, x + bodyW, playerBaseY() + height * .060f), paint)

        paint.color = Color.argb(if (overdrive > 0f) 75 else 42, 116, 77, 255)
        canvas.drawRoundRect(RectF(x - bodyW * .78f, y - bodyH * 1.3f, x + bodyW * .78f, y + bodyH * .25f), bodyW * .42f, bodyW * .42f, paint)

        val lean = if (slideNow) bodyW * .25f else sin(runPhase) * bodyW * .035f
        val torsoTop = y - bodyH * .82f
        val torsoBottom = y - bodyH * .22f
        paint.color = Color.rgb(18, 25, 48)
        canvas.drawRoundRect(RectF(x - bodyW * .38f + lean, torsoTop, x + bodyW * .38f + lean, torsoBottom), bodyW * .18f, bodyW * .18f, paint)
        paint.color = Color.rgb(69, 236, 255)
        canvas.drawRoundRect(RectF(x - bodyW * .08f + lean, torsoTop + bodyH * .08f, x + bodyW * .08f + lean, torsoBottom - bodyH * .07f), bodyW * .07f, bodyW * .07f, paint)

        val headY = if (slideNow) torsoTop + bodyH * .05f else torsoTop - bodyH * .22f
        paint.color = Color.rgb(33, 39, 65)
        canvas.drawCircle(x + lean, headY, bodyW * .30f, paint)
        paint.color = Color.rgb(255, 192, 145)
        canvas.drawCircle(x + lean, headY + bodyW * .03f, bodyW * .22f, paint)
        paint.color = Color.rgb(18, 24, 45)
        canvas.drawArc(RectF(x + lean - bodyW * .23f, headY - bodyW * .24f, x + lean + bodyW * .23f, headY + bodyW * .08f), 180f, 180f, true, paint)
        paint.color = Color.rgb(81, 239, 255)
        canvas.drawRect(x + lean - bodyW * .22f, headY - bodyW * .02f, x + lean + bodyW * .22f, headY + bodyW * .04f, paint)

        val armSwing = if (slideNow) 0f else sin(runPhase) * bodyH * .16f
        stroke.strokeCap = Paint.Cap.ROUND
        stroke.strokeWidth = bodyW * .17f
        stroke.color = Color.rgb(46, 54, 82)
        canvas.drawLine(x - bodyW * .34f + lean, torsoTop + bodyH * .18f, x - bodyW * .52f, torsoBottom + armSwing, stroke)
        canvas.drawLine(x + bodyW * .34f + lean, torsoTop + bodyH * .18f, x + bodyW * .52f, torsoBottom - armSwing, stroke)

        val legSwing = if (slideNow) bodyW * .30f else sin(runPhase) * bodyW * .34f
        stroke.strokeWidth = bodyW * .20f
        stroke.color = Color.rgb(30, 35, 61)
        canvas.drawLine(x - bodyW * .17f, torsoBottom, x - bodyW * .20f + legSwing, y + bodyH * .08f, stroke)
        canvas.drawLine(x + bodyW * .17f, torsoBottom, x + bodyW * .20f - legSwing, y + bodyH * .08f, stroke)
        stroke.strokeWidth = bodyW * .11f
        stroke.color = Color.rgb(255, 78, 209)
        canvas.drawLine(x - bodyW * .30f + legSwing, y + bodyH * .08f, x - bodyW * .04f + legSwing, y + bodyH * .08f, stroke)
        canvas.drawLine(x + bodyW * .04f - legSwing, y + bodyH * .08f, x + bodyW * .30f - legSwing, y + bodyH * .08f, stroke)
        stroke.strokeCap = Paint.Cap.BUTT
    }

    private fun drawParticles(canvas: Canvas) {
        for (p in particles) {
            val a = (255f * (p.life / .5f).coerceIn(0f, 1f)).toInt()
            paint.color = Color.argb(a, Color.red(p.color), Color.green(p.color), Color.blue(p.color))
            canvas.drawCircle(p.x, p.y, p.radius, paint)
        }
    }

    private fun drawOverdrive(canvas: Canvas) {
        repeat(14) { i ->
            val phase = (i / 14f + worldTime * 1.8f) % 1f
            val x = width * ((i * 0.137f) % 1f)
            paint.color = Color.argb((30 + phase * 65).toInt(), if (i % 2 == 0) 81 else 255, if (i % 2 == 0) 234 else 83, 255)
            canvas.drawRect(x, height * phase, x + width * .004f, min(height.toFloat(), height * phase + height * .14f), paint)
        }
    }

    private fun glowRect(canvas: Canvas, rect: RectF, color: Int, radius: Float) {
        paint.color = Color.argb(45, Color.red(color), Color.green(color), Color.blue(color))
        val outer = RectF(rect.left - radius * .25f, rect.top - radius * .25f, rect.right + radius * .25f, rect.bottom + radius * .25f)
        canvas.drawRoundRect(outer, radius, radius, paint)
        paint.color = color
        canvas.drawRoundRect(rect, radius, radius, paint)
    }

    private fun drawHud(canvas: Canvas) {
        if (mode == Mode.MENU) return
        val pad = width * .045f
        val top = height * .035f
        val cardH = height * .075f
        paint.color = Color.argb(132, 7, 12, 31)
        canvas.drawRoundRect(RectF(pad, top, width - pad, top + cardH), width * .035f, width * .035f, paint)
        stroke.strokeWidth = 1.5f
        stroke.color = Color.argb(100, 95, 229, 255)
        canvas.drawRoundRect(RectF(pad, top, width - pad, top + cardH), width * .035f, width * .035f, stroke)

        text.color = Color.WHITE
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * .040f
        canvas.drawText(score.toString(), pad * 1.45f, top + cardH * .46f, text)
        text.textSize = width * .022f
        text.color = Color.rgb(145, 178, 214)
        canvas.drawText("SCORE", pad * 1.45f, top + cardH * .76f, text)

        text.textAlign = Paint.Align.CENTER
        text.textSize = width * .038f
        text.color = Color.rgb(86, 240, 255)
        canvas.drawText("ZQ $shards", width * .50f, top + cardH * .53f, text)

        text.textAlign = Paint.Align.RIGHT
        text.textSize = width * .036f
        text.color = Color.rgb(255, 99, 219)
        canvas.drawText("${combo}x", width - pad * 1.45f, top + cardH * .52f, text)

        val meterL = pad
        val meterR = width - pad
        val meterY = top + cardH + height * .014f
        paint.color = Color.argb(110, 13, 20, 43)
        canvas.drawRoundRect(RectF(meterL, meterY, meterR, meterY + height * .010f), height * .005f, height * .005f, paint)
        val progress = if (overdrive > 0f) 1f else overdriveCharge
        paint.color = if (overdrive > 0f) Color.rgb(255, 79, 222) else Color.rgb(74, 232, 255)
        canvas.drawRoundRect(RectF(meterL, meterY, meterL + (meterR - meterL) * progress, meterY + height * .010f), height * .005f, height * .005f, paint)

        if (lastActionTimer > 0f) {
            text.textAlign = Paint.Align.CENTER
            text.textSize = width * .046f
            text.color = Color.argb((255 * min(1f, lastActionTimer * 1.8f)).toInt(), 255, 255, 255)
            canvas.drawText(lastAction, width * .5f, height * .22f, text)
        }
    }

    private fun drawMenu(canvas: Canvas) {
        paint.color = Color.argb(105, 2, 5, 17)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        text.textAlign = Paint.Align.CENTER
        text.color = Color.WHITE
        text.textSize = width * .112f
        canvas.drawText("ZORYQ", width * .5f, height * .19f, text)
        text.textSize = width * .061f
        text.color = Color.rgb(83, 239, 255)
        canvas.drawText("RUSH", width * .5f, height * .245f, text)
        text.textSize = width * .027f
        text.color = Color.rgb(184, 194, 223)
        canvas.drawText("NEON DISTRICT  •  NEXUS RUN", width * .5f, height * .285f, text)

        val button = RectF(width * .20f, height * .70f, width * .80f, height * .785f)
        paint.color = Color.rgb(91, 73, 247)
        canvas.drawRoundRect(button, width * .055f, width * .055f, paint)
        stroke.strokeWidth = width * .006f
        stroke.color = Color.rgb(93, 242, 255)
        canvas.drawRoundRect(button, width * .055f, width * .055f, stroke)
        text.color = Color.WHITE
        text.textSize = width * .052f
        canvas.drawText("RUN", width * .5f, height * .755f, text)
        text.textSize = width * .024f
        text.color = Color.rgb(183, 194, 221)
        canvas.drawText("SWIPE ← →   JUMP ↑   SLIDE ↓", width * .5f, height * .835f, text)
        canvas.drawText("TAP WHEN OVERDRIVE IS FULL", width * .5f, height * .872f, text)
    }

    private fun drawGameOver(canvas: Canvas) {
        paint.color = Color.argb(165, 3, 5, 17)
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        text.textAlign = Paint.Align.CENTER
        text.color = Color.WHITE
        text.textSize = width * .075f
        canvas.drawText("RUN COMPLETE", width * .5f, height * .35f, text)
        text.textSize = width * .13f
        text.color = Color.rgb(87, 241, 255)
        canvas.drawText(score.toString(), width * .5f, height * .47f, text)
        text.textSize = width * .030f
        text.color = Color.rgb(184, 194, 223)
        canvas.drawText("BEST $best   •   ZQ $shards   •   ${distance.toInt()}m", width * .5f, height * .525f, text)
        val button = RectF(width * .20f, height * .61f, width * .80f, height * .695f)
        paint.color = Color.rgb(91, 73, 247)
        canvas.drawRoundRect(button, width * .055f, width * .055f, paint)
        text.color = Color.WHITE
        text.textSize = width * .047f
        canvas.drawText("RUN AGAIN", width * .5f, height * .665f, text)
    }

    private fun burst(x: Float, y: Float, count: Int, color: Int, velocity: Float) {
        repeat(count) {
            val angle = random.nextFloat() * 6.283f
            val v = velocity * (.35f + random.nextFloat() * .75f)
            particles += Particle(x, y, cos(angle) * v, sin(angle) * v, .28f + random.nextFloat() * .35f, 2f + random.nextFloat() * 5f, color)
        }
        if (particles.size > 150) particles.subList(0, particles.size - 150).clear()
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchX = event.x
                touchY = event.y
                touchTime = SystemClock.uptimeMillis()
                return true
            }
            MotionEvent.ACTION_UP -> {
                val dx = event.x - touchX
                val dy = event.y - touchY
                val elapsed = SystemClock.uptimeMillis() - touchTime
                if (mode == Mode.MENU || mode == Mode.GAME_OVER) {
                    startRun()
                    performClick()
                    return true
                }
                if (mode == Mode.RUNNING) {
                    val threshold = min(width, height) * .055f
                    if (abs(dx) < threshold && abs(dy) < threshold && elapsed < 420) {
                        activateOverdrive()
                    } else if (abs(dx) > abs(dy)) {
                        if (dx > threshold) targetLane = min(2, targetLane + 1)
                        if (dx < -threshold) targetLane = max(0, targetLane - 1)
                    } else {
                        if (dy < -threshold && jump == 0f) {
                            jumpVelocity = 1.45f
                            action("JUMP")
                        }
                        if (dy > threshold && jump < .08f) {
                            slide = .62f
                            action("SLIDE")
                        }
                    }
                    performClick()
                    return true
                }
            }
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
