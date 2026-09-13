package network.zoryq.games.runtime

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager

open class ZoryqArenaActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(ZoryqArenaView(this))
    }
}
