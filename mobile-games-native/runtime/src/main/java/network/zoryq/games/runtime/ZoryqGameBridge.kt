package network.zoryq.games.runtime

import android.app.Activity
import android.content.Context
import android.content.Intent

/**
 * Public bridge API for hosts such as ZORYQ Wallet.
 *
 * Never pass a seed phrase, private key or signing secret through this API.
 * Only bounded public/session context is accepted.
 */
object ZoryqGameBridge {
    const val GAME_RUSH = "zoryq_rush"
    const val GAME_ARENA = "zoryq_arena"
    const val GAME_EMPIRE = "zoryq_empire"

    const val EXTRA_PUBLIC_ADDRESS = "zoryq.games.publicAddress"
    const val EXTRA_PROFILE_ID = "zoryq.games.profileId"
    const val EXTRA_SESSION_CAPABILITY = "zoryq.games.sessionCapability"

    fun hubIntent(
        context: Context,
        publicAddress: String? = null,
        profileId: String? = null,
        sessionCapability: String? = null
    ): Intent = Intent(context, ZoryqGamesHubActivity::class.java).apply {
        publicAddress?.let { putExtra(EXTRA_PUBLIC_ADDRESS, it) }
        profileId?.let { putExtra(EXTRA_PROFILE_ID, it) }
        sessionCapability?.let { putExtra(EXTRA_SESSION_CAPABILITY, it) }
    }

    fun openHub(
        activity: Activity,
        publicAddress: String? = null,
        profileId: String? = null,
        sessionCapability: String? = null
    ) {
        activity.startActivity(hubIntent(activity, publicAddress, profileId, sessionCapability))
    }
}
