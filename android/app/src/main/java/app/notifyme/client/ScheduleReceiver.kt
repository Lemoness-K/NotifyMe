package app.notifyme.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.LocationManager
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import app.notifyme.schedule.Boundary
import app.notifyme.schedule.LocationInterruption
import app.notifyme.schedule.ScheduleEntry
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingEvent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

class ScheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "alarm", "timer" -> intent.data?.lastPathSegment?.let { ScheduleWork.enqueue(context, intent.action!!, listOf(it)) }
            "fence" -> {
                val event = GeofencingEvent.fromIntent(intent) ?: return
                if (event.hasError()) {
                    if (event.errorCode == GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE) {
                        interruptMonitoring(context, LocationInterruption.UNAVAILABLE)
                    }
                    return
                }
                val action = when (event.geofenceTransition) {
                    Geofence.GEOFENCE_TRANSITION_ENTER -> "enter"
                    Geofence.GEOFENCE_TRANSITION_EXIT -> "exit"
                    else -> return
                }
                val ids = event.triggeringGeofences?.map(Geofence::getRequestId).orEmpty()
                ids.chunked(25).forEach { ScheduleWork.enqueue(context, action, it) }
            }
            Intent.ACTION_BOOT_COMPLETED -> ScheduleWork.enqueue(context, "boot")
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                DeviceSchedule.get(context).requireAuthorization()
                ScheduleWork.enqueue(context, "foreground")
            }
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED, "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" ->
                ScheduleWork.enqueue(context, "clock")
            LocationManager.MODE_CHANGED_ACTION -> {
                val enabled = if (intent.hasExtra(LocationManager.EXTRA_LOCATION_ENABLED)) {
                    intent.getBooleanExtra(LocationManager.EXTRA_LOCATION_ENABLED, false)
                } else DeviceSchedule.get(context).os.locationAllowed()
                if (enabled) ScheduleWork.enqueue(context, "location")
                else interruptMonitoring(context, LocationInterruption.DISABLED)
            }
        }
    }

    private fun interruptMonitoring(context: Context, reason: LocationInterruption) {
        try {
            DeviceSchedule.get(context).locationInterrupted(reason)
        } finally {
            ScheduleWork.enqueue(context, "location")
        }
    }
}

class DeviceMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = ScheduleWork.enqueue(this, "refresh")

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        if (data["schemaVersion"] != "1" || data["eventType"] !in setOf("reminder.changed", "household.access_revoked") ||
            data["scopeRef"]?.matches(Regex("[A-Za-z0-9_-]{1,128}")) != true || data["householdRevision"]?.toLongOrNull() == null ||
            data["expiresAt"]?.let { runCatching { Instant.parse(it).isAfter(Instant.now()) }.getOrDefault(false) } != true) return
        val signal = JSONObject().put("scopeRef", data["scopeRef"]).put("eventType", data["eventType"])
            .put("householdRevision", data["householdRevision"])
        DeviceSchedule.get(this).observeRevocation(signal)
        ScheduleWork.enqueue(this, "signal", listOf(signal.toString()))
    }
}

class ScheduleWork(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val schedule = DeviceSchedule.get(applicationContext)
        val values = inputData.getStringArray("values").orEmpty().toList()
        return try {
            when (inputData.getString("action")) {
                "alarm", "timer" -> schedule.fired(values.single(), inputData.getString("action") == "timer")
                "enter", "exit" -> schedule.boundary(values, if (inputData.getString("action") == "enter") Boundary.INSIDE else Boundary.OUTSIDE)
                "signal" -> schedule.refresh(signal = JSONObject(values.single()))
                "boot" -> schedule.recover(ScheduleEntry.BOOT)
                "foreground" -> schedule.recover(ScheduleEntry.FOREGROUND)
                "clock" -> schedule.replanTime()
                "location" -> schedule.retryLocation()
                else -> schedule.refresh()
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private val connected = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        internal fun enqueue(context: Context, action: String, values: List<String> = emptyList()) {
            val request = OneTimeWorkRequestBuilder<ScheduleWork>()
                .setInputData(workDataOf("action" to action, "values" to values.toTypedArray()))
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            if (action == "refresh") request.setConstraints(connected)
            val manager = WorkManager.getInstance(context)
            if (action in setOf("enter", "exit", "alarm", "timer")) {
                manager.enqueueUniqueWork("notify-schedule-events", ExistingWorkPolicy.APPEND_OR_REPLACE, request.build())
            } else manager.enqueue(request.build())
        }

        internal fun periodic(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("notify-installation-sync", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<ScheduleWork>(15, TimeUnit.MINUTES).setConstraints(connected).build())
        }
    }
}
