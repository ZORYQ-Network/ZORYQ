package network.zoryq.wallet.migration

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.util.concurrent.Executors

class ZoryqSocialApi(
    private val baseUrl: String = DEFAULT_BASE_URL
) {
    data class Session(val token: String, val profileRegistrationRequired: Boolean)
    data class RemotePost(
        val id: String,
        val author: String,
        val content: String,
        val createdAt: Long,
        val likeCount: Int,
        val liked: Boolean
    )

    private val executor = Executors.newSingleThreadExecutor()

    fun authenticate(
        address: String,
        signPersonal: (String) -> String,
        callback: (Result<Session>) -> Unit
    ) {
        executor.execute {
            callback(runCatching {
                val normalized = ZoryqAddress.normalize(address)
                require(ZoryqAddress.isValid(normalized)) { "Invalid wallet address" }
                val challengePath = "/social/v1/auth/challenge?address=" +
                    URLEncoder.encode(normalized, Charsets.UTF_8.name())
                val challenge = request("GET", challengePath)
                val message = challenge.getString("message")
                val signature = signPersonal(message)
                val verified = request(
                    "POST",
                    "/social/v1/auth/verify",
                    JSONObject().put("address", normalized).put("signature", signature)
                )
                Session(
                    token = verified.getString("token"),
                    profileRegistrationRequired = verified.optBoolean("profileRegistrationRequired", false)
                )
            })
        }
    }

    fun registerProfile(
        token: String,
        handle: String,
        displayName: String,
        bio: String,
        signTypedData: (String) -> String,
        callback: (Result<Unit>) -> Unit
    ) {
        executor.execute {
            callback(runCatching {
                val challenge = request(
                    "POST",
                    "/social/v1/profile/registration-challenge",
                    JSONObject()
                        .put("handle", handle)
                        .put("displayName", displayName)
                        .put("bio", bio),
                    token
                )
                val typedData = challenge.getJSONObject("typedData")
                ensureEip712DomainType(typedData)
                val signature = signTypedData(typedData.toString())
                request(
                    "POST",
                    "/social/v1/profile/register",
                    JSONObject().put("signature", signature),
                    token
                )
                Unit
            })
        }
    }

    fun fetchFeed(token: String?, callback: (Result<List<RemotePost>>) -> Unit) {
        executor.execute {
            callback(runCatching {
                val json = request("GET", "/social/v1/feed", token = token)
                val items = json.optJSONArray("items") ?: JSONArray()
                buildList {
                    for (index in 0 until items.length()) {
                        val item = items.optJSONObject(index) ?: continue
                        add(parsePost(item))
                    }
                }
            })
        }
    }

    fun createPost(token: String, content: String, callback: (Result<RemotePost>) -> Unit) {
        executor.execute {
            callback(runCatching {
                val clean = content.trim()
                require(clean.isNotEmpty()) { "Post cannot be empty" }
                require(clean.length <= 500) { "Remote post is limited to 500 characters" }
                val json = request(
                    "POST",
                    "/social/v1/posts",
                    JSONObject().put("content", clean).put("kind", "text"),
                    token
                )
                parsePost(json.getJSONObject("post"))
            })
        }
    }

    fun toggleLike(token: String, postId: String, callback: (Result<RemotePost>) -> Unit) {
        executor.execute {
            callback(runCatching {
                val safeId = URLEncoder.encode(postId, Charsets.UTF_8.name())
                val json = request("POST", "/social/v1/posts/$safeId/like", JSONObject(), token)
                parsePost(json.getJSONObject("post"))
            })
        }
    }

    fun shutdown() = executor.shutdownNow()

    private fun parsePost(item: JSONObject): RemotePost {
        val profile = item.optJSONObject("authorProfile")
        return RemotePost(
            id = item.optString("id"),
            author = profile?.optString("handle")?.takeIf { it.isNotBlank() }
                ?: item.optString("author").take(12),
            content = item.optString("content"),
            createdAt = item.optLong("createdAt"),
            likeCount = item.optInt("likeCount"),
            liked = item.optBoolean("liked")
        )
    }

    private fun ensureEip712DomainType(typedData: JSONObject) {
        val types = typedData.getJSONObject("types")
        if (types.has("EIP712Domain")) return
        types.put(
            "EIP712Domain",
            JSONArray()
                .put(JSONObject().put("name", "name").put("type", "string"))
                .put(JSONObject().put("name", "version").put("type", "string"))
                .put(JSONObject().put("name", "chainId").put("type", "uint256"))
        )
    }

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        token: String? = null
    ): JSONObject {
        val connection = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 7_000
            readTimeout = 12_000
            setRequestProperty("Accept", "application/json")
            if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }
        if (body != null) {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val raw = BufferedReader(InputStreamReader(stream, Charsets.UTF_8)).use { it.readText() }
        connection.disconnect()
        val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject().put("error", "INVALID_JSON") }
        if (status !in 200..299 || json.optBoolean("ok", true).not()) {
            error(json.optString("error", "HTTP_$status"))
        }
        return json
    }

    companion object {
        const val DEFAULT_BASE_URL = "https://zoryq-wallet-swap-production.up.railway.app"
    }
}
