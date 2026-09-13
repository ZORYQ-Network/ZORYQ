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
import kotlin.math.max
import kotlin.math.min

class ZoryqEmpireView(context: Context) : View(context) {

    private enum class BuildingType { FACTORY, HABITAT, SOLAR }
    private data class Building(val type: BuildingType, var level: Int = 1)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
    }
    private val prefs = context.getSharedPreferences("zoryq_empire_alpha", Context.MODE_PRIVATE)

    private val plots = arrayOfNulls<Building>(9)
    private val plotRects = ArrayList<RectF>()
    private val buildButtons = ArrayList<RectF>()
    private var selectedType = BuildingType.FACTORY
    private var credits = 500f
    private var energy = 80f
    private var population = 20f
    private var reputation = 0f
    private var productionAccumulator = 0f
    private var lastFrame = 0L
    private var bg: Shader? = null
    private var toast = "Construa seu primeiro distrito"
    private var toastTimer = 2.6f

    init {
        isClickable = true
        contentDescription = "ZORYQ Empire"
        restore()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        bg = LinearGradient(
            0f, 0f, 0f, h.toFloat(),
            intArrayOf(Color.rgb(4, 7, 19), Color.rgb(9, 20, 38), Color.rgb(16, 9, 38)),
            null,
            Shader.TileMode.CLAMP
        )
        plotRects.clear()
        val left = w * 0.08f
        val top = h * 0.28f
        val gap = w * 0.025f
        val size = (w * 0.84f - gap * 2f) / 3f
        repeat(3) { row ->
            repeat(3) { col ->
                val x = left + col * (size + gap)
                val y = top + row * (size * 0.78f + gap)
                plotRects += RectF(x, y, x + size, y + size * 0.72f)
            }
        }

        buildButtons.clear()
        val buttonTop = h * 0.78f
        val bw = w * 0.265f
        val bh = h * 0.075f
        val startX = w * 0.065f
        repeat(3) { i ->
            buildButtons += RectF(startX + i * (bw + w * 0.035f), buttonTop, startX + i * (bw + w * 0.035f) + bw, buttonTop + bh)
        }
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        if (lastFrame == 0L) lastFrame = now
        val dt = min(0.05f, max(0f, (now - lastFrame) / 1000f))
        lastFrame = now
        update(dt)

        paint.shader = bg
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        drawHeader(canvas)
        drawResources(canvas)
        drawCity(canvas)
        drawBuildMenu(canvas)
        drawFooter(canvas)
        if (toastTimer > 0f) drawToast(canvas)
        postInvalidateOnAnimation()
    }

    private fun update(dt: Float) {
        productionAccumulator += dt
        toastTimer = max(0f, toastTimer - dt)
        if (productionAccumulator < 1f) return
        val ticks = productionAccumulator.toInt()
        productionAccumulator -= ticks

        repeat(ticks) {
            var creditGain = 0f
            var energyGain = 0f
            var populationGain = 0f
            var energyUse = 0f
            for (b in plots.filterNotNull()) {
                val level = b.level.toFloat()
                when (b.type) {
                    BuildingType.FACTORY -> {
                        creditGain += 7.5f * level
                        energyUse += 1.1f * level
                    }
                    BuildingType.HABITAT -> {
                        populationGain += 0.18f * level
                        energyUse += 0.5f * level
                    }
                    BuildingType.SOLAR -> energyGain += 3.8f * level
                }
            }
            if (energy + energyGain >= energyUse) {
                credits += creditGain
                population += populationGain
                energy += energyGain - energyUse
                reputation += (creditGain + populationGain * 6f) * 0.012f
            } else {
                energy += energyGain
                toast = "Energia insuficiente — construa Solar"
                toastTimer = 1.7f
            }
            energy = energy.coerceIn(0f, 9999f)
            reputation = reputation.coerceAtMost(9999f)
        }
    }

    private fun drawHeader(canvas: Canvas) {
        text.textAlign = Paint.Align.LEFT
        text.textSize = width * 0.067f
        text.color = Color.WHITE
        canvas.drawText("ZORYQ", width * 0.065f, height * 0.085f, text)
        text.color = Color.rgb(176, 116, 255)
        canvas.drawText("EMPIRE", width * 0.065f, height * 0.14f, text)
        text.textSize = width * 0.025f
        text.color = Color.rgb(161, 172, 204)
        canvas.drawText("CONSTRUA • PRODUZA • EVOLUA", width * 0.067f, height * 0.178f, text)
    }

    private fun drawResources(canvas: Canvas) {
        val top = height * 0.205f
        val left = width * 0.065f
        val totalW = width * 0.87f
        paint.color = Color.argb(190, 8, 13, 30)
        canvas.drawRoundRect(RectF(left, top, left + totalW, top + height * 0.062f), width * 0.03f, width * 0.03f, paint)
        val labels = listOf(
            "CR ${credits.toInt()}",
            "⚡ ${energy.toInt()}",
            "POP ${population.toInt()}",
            "REP ${reputation.toInt()}"
        )
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.025f
        labels.forEachIndexed { i, label ->
            text.color = when (i) {
                0 -> Color.rgb(91, 238, 255)
                1 -> Color.rgb(255, 218, 86)
                2 -> Color.rgb(119, 255, 172)
                else -> Color.rgb(202, 126, 255)
            }
            canvas.drawText(label, left + totalW * (i + 0.5f) / 4f, top + height * 0.039f, text)
        }
    }

    private fun drawCity(canvas: Canvas) {
        plotRects.forEachIndexed { index, rect ->
            val building = plots[index]
            paint.color = if (building == null) Color.argb(150, 11, 20, 38) else Color.argb(205, 13, 23, 43)
            canvas.drawRoundRect(rect, width * 0.025f, width * 0.025f, paint)
            stroke.strokeWidth = width * 0.0028f
            stroke.color = if (building == null) Color.argb(75, 107, 143, 190) else accent(building.type)
            canvas.drawRoundRect(rect, width * 0.025f, width * 0.025f, stroke)

            if (building == null) {
                text.textAlign = Paint.Align.CENTER
                text.textSize = width * 0.055f
                text.color = Color.argb(100, 176, 190, 222)
                canvas.drawText("+", rect.centerX(), rect.centerY() + width * 0.018f, text)
            } else {
                drawBuilding(canvas, rect, building)
            }
        }
    }

    private fun drawBuilding(canvas: Canvas, rect: RectF, building: Building) {
        val c = accent(building.type)
        val cx = rect.centerX()
        val base = rect.bottom - rect.height() * 0.14f
        val levelScale = 0.55f + building.level * 0.10f
        val bh = rect.height() * min(0.68f, levelScale)
        val bw = rect.width() * 0.44f

        paint.color = Color.argb(45, Color.red(c), Color.green(c), Color.blue(c))
        canvas.drawCircle(cx, base - bh * 0.45f, rect.width() * 0.30f, paint)
        paint.color = Color.rgb(27, 35, 61)
        canvas.drawRoundRect(RectF(cx - bw / 2f, base - bh, cx + bw / 2f, base), bw * 0.12f, bw * 0.12f, paint)
        stroke.strokeWidth = max(1f, rect.width() * 0.018f)
        stroke.color = c
        canvas.drawRoundRect(RectF(cx - bw / 2f, base - bh, cx + bw / 2f, base), bw * 0.12f, bw * 0.12f, stroke)

        when (building.type) {
            BuildingType.FACTORY -> {
                paint.color = c
                canvas.drawRect(cx - bw * 0.28f, base - bh * 0.78f, cx + bw * 0.28f, base - bh * 0.68f, paint)
                canvas.drawRect(cx + bw * 0.10f, base - bh * 1.10f, cx + bw * 0.25f, base - bh * 0.77f, paint)
            }
            BuildingType.HABITAT -> {
                repeat(3) { row ->
                    repeat(2) { col ->
                        paint.color = Color.argb(190, Color.red(c), Color.green(c), Color.blue(c))
                        val wx = cx - bw * 0.23f + col * bw * 0.32f
                        val wy = base - bh * 0.77f + row * bh * 0.19f
                        canvas.drawRect(wx, wy, wx + bw * 0.13f, wy + bh * 0.08f, paint)
                    }
                }
            }
            BuildingType.SOLAR -> {
                paint.color = c
                canvas.drawRect(cx - bw * 0.35f, base - bh * 0.55f, cx + bw * 0.35f, base - bh * 0.42f, paint)
                stroke.color = Color.WHITE
                stroke.strokeWidth = 1.5f
                canvas.drawLine(cx, base - bh * 0.55f, cx, base - bh * 0.10f, stroke)
            }
        }

        text.textAlign = Paint.Align.CENTER
        text.textSize = rect.width() * 0.105f
        text.color = Color.WHITE
        canvas.drawText("LV ${building.level}", cx, rect.bottom - rect.height() * 0.025f, text)
    }

    private fun drawBuildMenu(canvas: Canvas) {
        val types = listOf(BuildingType.FACTORY, BuildingType.HABITAT, BuildingType.SOLAR)
        val labels = listOf("FÁBRICA\n200 CR", "HABITAT\n150 CR", "SOLAR\n120 CR")
        buildButtons.forEachIndexed { index, rect ->
            val type = types[index]
            paint.color = if (selectedType == type) Color.argb(215, 35, 45, 85) else Color.argb(175, 10, 15, 33)
            canvas.drawRoundRect(rect, width * 0.028f, width * 0.028f, paint)
            stroke.strokeWidth = if (selectedType == type) width * 0.004f else width * 0.002f
            stroke.color = if (selectedType == type) accent(type) else Color.argb(75, 130, 141, 176)
            canvas.drawRoundRect(rect, width * 0.028f, width * 0.028f, stroke)

            val lines = labels[index].split("\n")
            text.textAlign = Paint.Align.CENTER
            text.textSize = width * 0.025f
            text.color = Color.WHITE
            canvas.drawText(lines[0], rect.centerX(), rect.top + rect.height() * 0.42f, text)
            text.textSize = width * 0.021f
            text.color = accent(type)
            canvas.drawText(lines[1], rect.centerX(), rect.top + rect.height() * 0.72f, text)
        }
    }

    private fun drawFooter(canvas: Canvas) {
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.023f
        text.color = Color.rgb(126, 138, 174)
        canvas.drawText("Toque em lote vazio para construir • edifício para evoluir", width * 0.5f, height * 0.90f, text)
        text.color = Color.rgb(100, 215, 255)
        canvas.drawText("Produção acontece em tempo real enquanto o jogo está aberto", width * 0.5f, height * 0.935f, text)
    }

    private fun drawToast(canvas: Canvas) {
        val rect = RectF(width * 0.13f, height * 0.70f, width * 0.87f, height * 0.755f)
        paint.color = Color.argb(215, 5, 8, 22)
        canvas.drawRoundRect(rect, width * 0.025f, width * 0.025f, paint)
        text.textAlign = Paint.Align.CENTER
        text.textSize = width * 0.025f
        text.color = Color.WHITE
        canvas.drawText(toast, rect.centerX(), rect.centerY() + width * 0.008f, text)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_UP) return true

        buildButtons.forEachIndexed { index, rect ->
            if (rect.contains(event.x, event.y)) {
                selectedType = listOf(BuildingType.FACTORY, BuildingType.HABITAT, BuildingType.SOLAR)[index]
                performClick()
                return true
            }
        }

        plotRects.forEachIndexed { index, rect ->
            if (!rect.contains(event.x, event.y)) return@forEachIndexed
            val existing = plots[index]
            if (existing == null) build(index) else upgrade(existing)
            persist()
            performClick()
            return true
        }

        performClick()
        return true
    }

    private fun build(index: Int) {
        val cost = cost(selectedType)
        if (credits < cost) {
            toast = "Créditos insuficientes"
            toastTimer = 1.6f
            return
        }
        credits -= cost
        plots[index] = Building(selectedType)
        reputation += 4f
        toast = when (selectedType) {
            BuildingType.FACTORY -> "Fábrica ativa: gerando créditos"
            BuildingType.HABITAT -> "Habitat ativo: atraindo população"
            BuildingType.SOLAR -> "Solar ativo: aumentando energia"
        }
        toastTimer = 1.8f
    }

    private fun upgrade(building: Building) {
        if (building.level >= 5) {
            toast = "Edifício no nível máximo"
            toastTimer = 1.5f
            return
        }
        val upgradeCost = cost(building.type) * (0.65f + building.level * 0.48f)
        if (credits < upgradeCost) {
            toast = "Faltam ${upgradeCost.toInt()} CR para evoluir"
            toastTimer = 1.6f
            return
        }
        credits -= upgradeCost
        building.level += 1
        reputation += 8f * building.level
        toast = "Evoluído para nível ${building.level}"
        toastTimer = 1.6f
    }

    private fun cost(type: BuildingType): Float = when (type) {
        BuildingType.FACTORY -> 200f
        BuildingType.HABITAT -> 150f
        BuildingType.SOLAR -> 120f
    }

    private fun accent(type: BuildingType): Int = when (type) {
        BuildingType.FACTORY -> Color.rgb(89, 235, 255)
        BuildingType.HABITAT -> Color.rgb(118, 255, 177)
        BuildingType.SOLAR -> Color.rgb(255, 211, 84)
    }

    private fun persist() {
        val editor = prefs.edit()
            .putFloat("credits", credits)
            .putFloat("energy", energy)
            .putFloat("population", population)
            .putFloat("reputation", reputation)
        plots.forEachIndexed { i, b ->
            if (b == null) {
                editor.remove("type_$i").remove("level_$i")
            } else {
                editor.putString("type_$i", b.type.name).putInt("level_$i", b.level)
            }
        }
        editor.apply()
    }

    private fun restore() {
        credits = prefs.getFloat("credits", 500f)
        energy = prefs.getFloat("energy", 80f)
        population = prefs.getFloat("population", 20f)
        reputation = prefs.getFloat("reputation", 0f)
        repeat(9) { i ->
            val name = prefs.getString("type_$i", null) ?: return@repeat
            val type = runCatching { BuildingType.valueOf(name) }.getOrNull() ?: return@repeat
            plots[i] = Building(type, prefs.getInt("level_$i", 1).coerceIn(1, 5))
        }
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    override fun onDetachedFromWindow() {
        persist()
        super.onDetachedFromWindow()
    }
}
