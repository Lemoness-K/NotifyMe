package app.notifyme.client

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.Tasks
import org.json.JSONObject
import java.util.concurrent.TimeUnit

internal class DeviceNotifications(private val context: Context) {
    private val alarms = context.getSystemService(AlarmManager::class.java)
    private val notices = context.getSystemService(NotificationManager::class.java)
    private val geofences get() = LocationServices.getGeofencingClient(context)

    fun status(): JSONObject {
        channels()
        return JSONObject().put("notifications", notices.areNotificationsEnabled())
            .put("exactAlarms", exactAllowed()).put("timeChannel", channelEnabled(timeChannel))
            .put("locationChannel", channelEnabled(locationChannel)).put("location", locationAllowed())
    }

    fun exactAllowed() = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()

    private fun permission(name: String) = ContextCompat.checkSelfPermission(context, name) == PackageManager.PERMISSION_GRANTED

    fun locationAllowed(): Boolean {
        val manager = context.getSystemService(LocationManager::class.java)
        val enabled = if (Build.VERSION.SDK_INT >= 28) manager.isLocationEnabled else
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) || manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        return enabled && permission(Manifest.permission.ACCESS_FINE_LOCATION) &&
            (Build.VERSION.SDK_INT < 29 || permission(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
    }

    fun cancel(id: String) {
        alarms.cancel(alarm(id, false))
        alarms.cancel(alarm(id, true))
    }

    fun alarmAt(id: String, at: Long, timer: Boolean, exact: Boolean) {
        val type = if (timer) AlarmManager.ELAPSED_REALTIME_WAKEUP else AlarmManager.RTC_WAKEUP
        val intent = alarm(id, timer)
        if (exact) {
            try {
                alarms.setExactAndAllowWhileIdle(type, at, intent)
                return
            } catch (_: SecurityException) {
                // Permission can change after the capability check.
            }
        }
        alarms.setAndAllowWhileIdle(type, at, intent)
    }

    private fun alarm(id: String, timer: Boolean) = PendingIntent.getBroadcast(context, 0,
        Intent(context, ScheduleReceiver::class.java).setAction(if (timer) "timer" else "alarm")
            .setData(Uri.Builder().scheme("notify-plan").authority("local").appendPath(id).build()),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun fenceIntent(flags: Int) = PendingIntent.getBroadcast(context, 0,
        Intent(context, ScheduleReceiver::class.java).setAction("fence"),
        flags or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)

    fun cancelFenceDelivery() { fenceIntent(PendingIntent.FLAG_NO_CREATE)?.cancel() }

    fun removeFences(ids: List<String>) {
        if (ids.isNotEmpty()) Tasks.await(geofences.removeGeofences(ids), 10, TimeUnit.SECONDS)
    }

    @SuppressLint("MissingPermission")
    fun addFences(plans: Map<String, JSONObject>) {
        if (plans.isEmpty()) return
        if (!locationAllowed()) throw SecurityException("Location capability changed during registration")
        val fences = plans.map { (id, plan) ->
            val trigger = plan.getJSONObject("trigger")
            Geofence.Builder().setRequestId(id)
                .setCircularRegion(trigger.getDouble("latitude"), trigger.getDouble("longitude"), trigger.getDouble("radiusM").toFloat())
                .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                .setExpirationDuration(Geofence.NEVER_EXPIRE).build()
        }
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER or GeofencingRequest.INITIAL_TRIGGER_EXIT)
            .addGeofences(fences).build()
        Tasks.await(geofences.addGeofences(request, requireNotNull(fenceIntent(PendingIntent.FLAG_UPDATE_CURRENT))), 10, TimeUnit.SECONDS)
    }

    private fun channelEnabled(id: String) = Build.VERSION.SDK_INT < 26 ||
        notices.getNotificationChannel(id)?.importance != NotificationManager.IMPORTANCE_NONE

    private fun channels() {
        if (Build.VERSION.SDK_INT < 26) return
        notices.createNotificationChannels(listOf(
            NotificationChannel(timeChannel, context.getString(R.string.notification_time_channel), NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(locationChannel, context.getString(R.string.notification_location_channel), NotificationManager.IMPORTANCE_DEFAULT),
        ))
    }

    @SuppressLint("MissingPermission")
    fun post(id: String, location: Boolean, english: Boolean, plan: JSONObject): Boolean {
        channels()
        val channel = if (location) locationChannel else timeChannel
        if (!notices.areNotificationsEnabled() || !channelEnabled(channel) ||
            (Build.VERSION.SDK_INT >= 33 && !permission(Manifest.permission.POST_NOTIFICATIONS))) return false
        val publicText = if (english) "You have a reminder." else "새 리마인더가 있어요."
        val title = if (plan.has("title")) plan.getString("title") else if (english) "Notify Me reminder" else "Notify Me 리마인더"
        val message = if (plan.has("description")) plan.getString("description") else if (location) {
            if (english) "A location condition was met." else "장소 조건이 충족됐어요."
        } else {
            if (english) "A reminder is due." else "리마인더 예정 시간이에요."
        }
        val open = Intent(context, MainActivity::class.java)
        if (plan.has("reminderId")) open.data = Uri.Builder().scheme("notify-detail").authority("local")
            .appendPath(plan.getString("reminderId")).build()
        val launch = PendingIntent.getActivity(context, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val public = NotificationCompat.Builder(context, channel).setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Notify Me").setContentText(publicText).build()
        val notification = NotificationCompat.Builder(context, channel).setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title).setContentText(message).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPublicVersion(public).setOnlyAlertOnce(true).setAutoCancel(true).setContentIntent(launch).build()
        notices.notify(id, 1, notification)
        return true
    }

    fun cancelPost(id: String) = notices.cancel(id, 1)

    companion object {
        const val timeChannel = "time-reminders"
        const val locationChannel = "location-reminders"
    }
}
