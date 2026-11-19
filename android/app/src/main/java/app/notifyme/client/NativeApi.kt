package app.notifyme.client

import android.content.Context
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import org.json.JSONObject
import java.io.IOException
import java.net.URI
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

internal class ApiFailure(val status: Int, val payload: JSONObject) : IOException() {
    val code: String get() = payload.optString("code", "API_UNAVAILABLE")
}

internal class NativeApi(context: Context) {
    private val store = ProtectedState(context)
    private val context = context.applicationContext

    fun auth(): FirebaseAuth? = FirebaseApp.getApps(context).firstOrNull()?.let(FirebaseAuth::getInstance)
    fun hasSession(): Boolean = auth()?.currentUser != null && store.read("login").has("cookie")

    fun clientId(): String = request("GET", "/client-config", authenticated = false).body.getString("googleClientId")

    fun challenge(): Challenge {
        val result = request("POST", "/sessions/challenges", authenticated = false)
        return Challenge(result.body.getString("nonce"), result.cookie(challengeCookie))
    }

    fun signIn(proof: Challenge, googleToken: String) = synchronized(lock) {
        val firebase = auth() ?: throw IOException("Firebase configuration unavailable")
        try {
            val credential = GoogleAuthProvider.getCredential(googleToken, null)
            val user = Tasks.await(firebase.signInWithCredential(credential), 15, TimeUnit.SECONDS).user ?: throw IOException()
            val token = Tasks.await(user.getIdToken(true), 15, TimeUnit.SECONDS).token ?: throw IOException()
            val result = request("POST", "/sessions", JSONObject().put("googleToken", googleToken),
                authenticated = false, authorization = token, cookie = "$challengeCookie=${proof.cookie}")
            store.write("login", JSONObject().put("cookie", result.cookie(sessionCookie)))
        } catch (failure: Exception) {
            clearSession()
            throw failure
        }
    }

    fun clearSession() = synchronized(lock) {
        store.write("login", JSONObject())
        auth()?.signOut()
    }

    fun userRequest(method: String, path: String, body: JSONObject? = null, key: String? = null): Reply {
        val route = path.substringBefore('?')
        check(!route.contains("..") && webRoutes.any { (verbs, pattern) -> method in verbs && pattern.matches(route) })
        return request(method, path, body, key)
    }

    fun webRequest(method: String, path: String, body: JSONObject?, key: String?): Reply {
        val route = path.substringBefore('?')
        check(route != "/installations" && route.endsWith("/events").not() && route.endsWith("/sync").not())
        return userRequest(method, path, body, key)
    }

    private fun request(method: String, path: String, body: JSONObject? = null, key: String? = null,
                        authenticated: Boolean = true, authorization: String? = null, cookie: String? = null): Reply {
        val origin = BuildConfig.NOTIFY_API_ORIGIN
        val target = URI(origin + "/api/v1" + path)
        if (origin.isEmpty() || target.scheme != "https" || target.host == null || target.fragment != null) throw IOException()
        val connection = target.toURL().openConnection() as HttpsURLConnection
        try {
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 7_500
            connection.readTimeout = 7_500
            connection.requestMethod = method
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Origin", origin)
            if (authenticated) {
                val session = store.read("login").optString("cookie")
                val task = auth()?.currentUser?.getIdToken(false) ?: throw ApiFailure(401, JSONObject().put("code", "UNAUTHENTICATED"))
                val token = Tasks.await(task, 10, TimeUnit.SECONDS).token
                if (session.isEmpty() || token == null) throw ApiFailure(401, JSONObject().put("code", "UNAUTHENTICATED"))
                connection.setRequestProperty("Cookie", "$sessionCookie=$session")
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            authorization?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            cookie?.let { connection.setRequestProperty("Cookie", it) }
            key?.let { connection.setRequestProperty("Idempotency-Key", it) }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { reader ->
                val content = StringBuilder()
                val chunk = CharArray(4096)
                var count = reader.read(chunk)
                while (count != -1) {
                    if (content.length + count > 4_000_000) throw IOException()
                    content.append(chunk, 0, count)
                    count = reader.read(chunk)
                }
                content.toString()
            }.orEmpty()
            val payload = if (raw.isBlank()) JSONObject() else JSONObject(raw)
            if (status !in 200..299) throw ApiFailure(status, payload)
            val cookies = connection.headerFields.entries.filter { it.key.equals("Set-Cookie", ignoreCase = true) }.flatMap { it.value }
            return Reply(status, payload, cookies)
        } finally {
            connection.disconnect()
        }
    }

    data class Challenge(val nonce: String, val cookie: String)
    data class Reply(val status: Int, val body: JSONObject, private val cookies: List<String>) {
        fun cookie(name: String): String = cookies.asSequence().map { it.substringBefore(';') }
            .firstOrNull { it.startsWith("$name=") }?.substringAfter('=')?.takeIf { tokenPattern.matches(it) } ?: throw IOException()
    }

    companion object {
        private const val challengeCookie = "__Host-notify-login"
        private const val sessionCookie = "__Host-notify-session"
        private val lock = Any()
        private val tokenPattern = Regex("[A-Za-z0-9_-]{43}")
        private const val id = "[A-Za-z0-9_-]{1,128}"
        private val webRoutes = listOf(
            setOf("GET") to Regex("/me|/settings/catalog"),
            setOf("PATCH", "GET") to Regex("/me/settings|/households/$id/settings"),
            setOf("POST") to Regex("/invitations/accept"),
            setOf("GET", "POST") to Regex("/households/$id/invitations|/households/$id/reminders"),
            setOf("DELETE") to Regex("/households/$id/invitations/$id|/sessions/current"),
            setOf("GET", "PATCH", "DELETE") to Regex("/households/$id/reminders/$id|/households/$id/members/$id"),
            setOf("GET") to Regex("/households/$id/(members|history)|/households/$id/reminders/$id/occurrences"),
            setOf("POST") to Regex("/households/$id/reminders/$id/lifecycle|/households/$id/occurrences/$id/actions"),
            setOf("PUT") to Regex("/installations|/households/$id/installations/$id/location-exclusions/$id"),
            setOf("GET") to Regex("/households/$id/installations/$id/(sync|location-exclusions)"),
            setOf("POST") to Regex("/households/$id/installations/$id/events"),
        )

        fun key(): String = UUID.randomUUID().toString()
    }
}
