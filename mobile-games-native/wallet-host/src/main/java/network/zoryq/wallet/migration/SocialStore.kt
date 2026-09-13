package network.zoryq.wallet.migration

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class SocialStore(context: Context) {
    data class Post(
        val id: String,
        val author: String,
        val body: String,
        val createdAt: Long,
        val likes: Int
    )

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun handle(): String = prefs.getString(KEY_HANDLE, "zoryq_user") ?: "zoryq_user"

    fun saveHandle(value: String) {
        val clean = value.trim().replace(Regex("[^A-Za-z0-9_.-]"), "").take(24)
        require(clean.length >= 3) { "Handle must have at least 3 valid characters" }
        prefs.edit().putString(KEY_HANDLE, clean).apply()
    }

    fun posts(): List<Post> {
        val source = prefs.getString(KEY_POSTS, "[]") ?: "[]"
        val array = runCatching { JSONArray(source) }.getOrDefault(JSONArray())
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(
                    Post(
                        id = item.optString("id"),
                        author = item.optString("author", "zoryq_user"),
                        body = item.optString("body"),
                        createdAt = item.optLong("createdAt"),
                        likes = item.optInt("likes")
                    )
                )
            }
        }.sortedByDescending { it.createdAt }
    }

    fun addPost(body: String): Post {
        val clean = body.trim()
        require(clean.isNotEmpty()) { "Post cannot be empty" }
        require(clean.length <= 280) { "Post is limited to 280 characters" }
        val post = Post(UUID.randomUUID().toString(), handle(), clean, System.currentTimeMillis(), 0)
        persist(listOf(post) + posts())
        return post
    }

    fun like(postId: String) {
        persist(posts().map { if (it.id == postId) it.copy(likes = it.likes + 1) else it })
    }

    private fun persist(posts: List<Post>) {
        val array = JSONArray()
        posts.take(MAX_POSTS).forEach { post ->
            array.put(
                JSONObject()
                    .put("id", post.id)
                    .put("author", post.author)
                    .put("body", post.body)
                    .put("createdAt", post.createdAt)
                    .put("likes", post.likes)
            )
        }
        prefs.edit().putString(KEY_POSTS, array.toString()).apply()
    }

    companion object {
        private const val PREFS = "zoryq_social_local_v1"
        private const val KEY_HANDLE = "handle"
        private const val KEY_POSTS = "posts"
        private const val MAX_POSTS = 100
    }
}
