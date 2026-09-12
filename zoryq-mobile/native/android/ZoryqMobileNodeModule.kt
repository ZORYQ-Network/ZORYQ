package com.zoryq.wallet.mobilenodebridge

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import network.zoryq.mobilenode.NodeMode
import network.zoryq.mobilenode.WitnessService

class ZoryqMobileNodeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "ZoryqMobileNode"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            ContextCompat.startForegroundService(context, Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_START))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NODE_START_FAILED", "Unable to start ZORYQ Mobile Node", e)
        }
    }

    @ReactMethod
    fun pause(promise: Promise) {
        try {
            context.startService(Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_PAUSE))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NODE_PAUSE_FAILED", "Unable to pause ZORYQ Mobile Node", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            context.startService(Intent(context, WitnessService::class.java).setAction(WitnessService.ACTION_STOP))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NODE_STOP_FAILED", "Unable to stop ZORYQ Mobile Node", e)
        }
    }

    @ReactMethod
    fun setMode(mode: String, promise: Promise) {
        try {
            val parsed = NodeMode.valueOf(mode.uppercase())
            context.getSharedPreferences("zoryq_mobile_node", 0).edit().putString("nodeMode", parsed.name).apply()
            promise.resolve(parsed.name)
        } catch (e: Exception) {
            promise.reject("INVALID_NODE_MODE", "Unsupported ZORYQ node mode", e)
        }
    }

    @ReactMethod
    fun configure(
        wifiOnly: Boolean,
        chargingOnly: Boolean,
        allowMobileData: Boolean,
        batteryMinimum: Int,
        dailyMobileDataLimitMb: Int,
        promise: Promise
    ) {
        try {
            require(batteryMinimum in 5..80) { "batteryMinimum must be between 5 and 80" }
            require(dailyMobileDataLimitMb == 0 || dailyMobileDataLimitMb in 10..2048) {
                "dailyMobileDataLimitMb must be 0 (unlimited) or between 10 and 2048"
            }
            val bytes = if (dailyMobileDataLimitMb == 0) 0L else dailyMobileDataLimitMb.toLong() * 1024L * 1024L
            context.getSharedPreferences("zoryq_mobile_node", 0).edit()
                .putBoolean("wifiOnly", wifiOnly)
                .putBoolean("chargingOnly", chargingOnly)
                .putBoolean("allowMobileData", allowMobileData)
                .putInt("batteryMinimum", batteryMinimum)
                .putLong("dailyMobileDataLimitBytes", bytes)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INVALID_NODE_CONFIG", "Invalid ZORYQ Mobile Node resource policy", e)
        }
    }

    @ReactMethod
    fun status(promise: Promise) {
        try {
            val p = context.getSharedPreferences("zoryq_mobile_node", 0)
            val result = Arguments.createMap().apply {
                putBoolean("running", p.getBoolean("running", false))
                putBoolean("paused", p.getBoolean("paused", false))
                putBoolean("resumeRequired", p.getBoolean("resumeRequired", false))
                putString("nodeId", p.getString("nodeId", "") ?: "")
                putString("state", p.getString("state", "Offline") ?: "Offline")
                putString("mode", p.getString("effectiveNodeMode", p.getString("nodeMode", NodeMode.BALANCED.name)) ?: NodeMode.BALANCED.name)
                putDouble("lastBlock", p.getLong("lastBlock", 0L).toDouble())
                putString("lastBlockHash", p.getString("lastBlockHash", "") ?: "")
                putString("lastCheck", p.getString("lastCheck", "") ?: "")
                putString("proofStatus", p.getString("proofStatus", "No verified proof yet") ?: "No verified proof yet")
                putDouble("lastXpAwarded", p.getLong("lastXpAwarded", 0L).toDouble())
                putDouble("totalXp", p.getLong("totalXp", 0L).toDouble())
                putString("lastXpEventId", p.getString("lastXpEventId", "") ?: "")
                putString("lastVerifiedProofHash", p.getString("lastVerifiedProofHash", "") ?: "")
                putString("heartbeatStatus", p.getString("heartbeatStatus", "Not sent yet") ?: "Not sent yet")
                putString("lastHeartbeatAt", p.getString("lastHeartbeatAt", "") ?: "")
                putDouble("lastHeartbeatXp", p.getLong("lastHeartbeatXp", 0L).toDouble())
                putBoolean("wifiOnly", p.getBoolean("wifiOnly", false))
                putBoolean("chargingOnly", p.getBoolean("chargingOnly", false))
                putBoolean("allowMobileData", p.getBoolean("allowMobileData", true))
                putInt("batteryMinimum", p.getInt("batteryMinimum", 20))
                putDouble("mobileDataBytesToday", p.getLong("mobileDataBytesToday", 0L).toDouble())
                putDouble("dailyMobileDataLimitBytes", p.getLong("dailyMobileDataLimitBytes", 250L * 1024L * 1024L).toDouble())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("NODE_STATUS_FAILED", "Unable to read ZORYQ Mobile Node status", e)
        }
    }
}
