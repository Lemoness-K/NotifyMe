package app.notifyme.client

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.webkit.WebViewFeature
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@CapacitorPlugin(name = "NotifyDevice")
class NotifyDevicePlugin : Plugin() {
    private val jobs = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val schedule get() = DeviceSchedule.get(context)
    private var signingIn = false

    override fun shouldOverrideLoad(url: Uri): Boolean? {
        if (local(url)) return null
        if (url.scheme == "https" && url.host != null) {
            runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)) }
        }
        return true
    }

    private fun local(url: Uri): Boolean = url.scheme == "https" && url.encodedAuthority == "localhost"

    private fun safely(call: PluginCall, action: suspend () -> JSObject?) {
        activity.runOnUiThread {
            val source = bridge.webView.url
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) || source == null || !local(Uri.parse(source))) {
                call.reject("Bridge origin denied", "ORIGIN_DENIED")
                return@runOnUiThread
            }
            jobs.launch {
                try {
                    val payload = action()
                    if (payload == null) call.resolve() else call.resolve(payload)
                } catch (failure: ApiFailure) {
                    val data = JSObject().apply {
                        put("status", failure.status)
                        put("body", failure.payload)
                        put("retryAfter", failure.retryAfter)
                    }
                    call.reject("Request failed", failure.code, data)
                } catch (_: Exception) {
                    call.reject("Device operation unavailable", "DEVICE_UNAVAILABLE")
                }
            }
        }
    }

    @PluginMethod
    fun status(call: PluginCall) = safely(call) { JSObject(schedule.identity().toString()) }

    @PluginMethod
    fun request(call: PluginCall) = safely(call) {
        val method = requireNotNull(call.getString("method"))
        val path = requireNotNull(call.getString("path"))
        val body = call.getObject("body")
        val key = call.getString("key")
        val revision = call.getString("revision")
        require(path.length <= 2_048 && (key == null || key.matches(Regex("[A-Za-z0-9._-]{1,128}"))))
        require(revision == null || revision.matches(Regex("[0-9]{1,10}|\"[0-9]{1,10}\"")))
        require(method != "GET" || body == null)
        val installation = path.substringBefore('?').split('/').let { segments ->
            if (segments.getOrNull(3) == "installations" && segments.getOrNull(5) == "location-exclusions") segments[4] else null
        }
        if (installation != null) require(installation == schedule.identity().getString("installationId"))
        try {
            val response = schedule.api.webRequest(method, path, body, key, revision)
            JSObject().apply { put("status", response.status); put("body", response.payload) }
        } finally {
            if (method == "DELETE" && path == "/sessions/current") schedule.signOut()
        }
    }

    @PluginMethod
    fun signIn(call: PluginCall) = safely(call) {
        withContext(Dispatchers.Main) {
            check(!signingIn)
            signingIn = true
        }
        try {
            val api = schedule.api
            check(api.auth() != null)
            if (api.hasSession()) schedule.signOut()
            val clientId = api.clientId()
            val challenge = api.challenge()
            val receivedAt = android.os.SystemClock.elapsedRealtime()
            val proof = withContext(Dispatchers.Main) {
                val option = GetGoogleIdOption.Builder().setServerClientId(clientId)
                    .setFilterByAuthorizedAccounts(false).setNonce(challenge.nonce).build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val credential = CredentialManager.create(activity).getCredential(activity, request).credential
                check(credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
                GoogleIdTokenCredential.createFrom(credential.data).idToken
            }
            delay((1_030 - (android.os.SystemClock.elapsedRealtime() - receivedAt)).coerceAtLeast(0))
            val invitation = call.getObject("invitation")
            if (invitation != null) {
                require(invitation.getString("code").matches(Regex("[A-Za-z0-9_-]{32}")))
                require(invitation.getString("key").matches(Regex("[A-Za-z0-9._-]{1,128}")))
            }
            api.signIn(challenge, proof, invitation)
            applyScope()
            JSObject(schedule.identity().toString())
        } finally {
            withContext(Dispatchers.Main) { signingIn = false }
        }
    }

    @PluginMethod
    fun clearSession(call: PluginCall) = safely(call) { schedule.clearCredentials(); null }

    @PluginMethod
    fun bind(call: PluginCall) = safely(call) {
        applyScope()
        ScheduleWork.periodic(context)
        ScheduleWork.enqueue(context, "recover")
        schedule.refresh(full = true)
        JSObject(schedule.identity().toString())
    }

    private fun applyScope() {
        val identity = schedule.api.userRequest("GET", "/me").body
        schedule.scope(identity.getString("userId"), identity.optString("householdId").ifEmpty { null })
    }

    @PluginMethod
    fun locale(call: PluginCall) = safely(call) {
        call.getString("locale")?.takeIf { it == "ko" || it == "en" }?.let(schedule::locale)
        null
    }

    @PluginMethod
    fun openSettings(call: PluginCall) = safely(call) {
        withContext(Dispatchers.Main) {
            val packageUri = Uri.parse("package:${context.packageName}")
            val appDetails = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
            when (call.getString("kind")) {
                "notification" -> if (Build.VERSION.SDK_INT >= 33 && !schedule.os.status().getBoolean("notifications") &&
                    !context.getSharedPreferences("notify-ui", 0).getBoolean("notificationAsked", false)) {
                    context.getSharedPreferences("notify-ui", 0).edit().putBoolean("notificationAsked", true).apply()
                    ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 801)
                } else if (Build.VERSION.SDK_INT >= 26) activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)) else activity.startActivity(appDetails)
                "timeChannel", "locationChannel" -> if (Build.VERSION.SDK_INT >= 26) {
                    val channel = if (call.getString("kind") == "timeChannel") DeviceNotifications.timeChannel else DeviceNotifications.locationChannel
                    activity.startActivity(Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).putExtra(Settings.EXTRA_CHANNEL_ID, channel))
                } else activity.startActivity(appDetails)
                "exact" -> if (Build.VERSION.SDK_INT >= 31) activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri))
                "location" -> if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED &&
                    !context.getSharedPreferences("notify-ui", 0).getBoolean("locationAsked", false)) {
                    context.getSharedPreferences("notify-ui", 0).edit().putBoolean("locationAsked", true).apply()
                    ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION), 802)
                } else activity.startActivity(appDetails)
                else -> error("Unsupported setting")
            }
        }
        null
    }

    override fun handleOnResume() {
        ScheduleWork.enqueue(context, "recover")
        notifyListeners("capabilitiesChanged", JSObject())
    }

    override fun handleOnDestroy() { jobs.cancel() }
}
