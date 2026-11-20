package app.notifyme.client

import android.content.Context
import android.content.IntentFilter
import android.location.LocationManager
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import app.notifyme.schedule.Boundary
import app.notifyme.schedule.ConditionEvent
import app.notifyme.schedule.DAY_MS
import app.notifyme.schedule.LocationResult
import app.notifyme.schedule.LocationState
import app.notifyme.schedule.LocationTimer
import app.notifyme.schedule.ScheduleVersion
import app.notifyme.schedule.ScheduleEntry
import app.notifyme.schedule.TimeAction
import app.notifyme.schedule.applyIndependentSchedules
import app.notifyme.schedule.canApplyAfterCleanup
import app.notifyme.schedule.changeBoundary
import app.notifyme.schedule.requiresCleanup
import app.notifyme.schedule.restoreSchedule
import app.notifyme.schedule.stableId
import app.notifyme.schedule.suspendMonitoring
import app.notifyme.schedule.timeAction
import app.notifyme.schedule.timerEvent
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

internal class DeviceSchedule(private val context: Context) {
    private val protected = ProtectedState(context)
    val api = NativeApi(context)
    val os = DeviceNotifications(context)
    private val foregroundRequest = AtomicLong()
    private var confirmedForeground = 0L

    init {
        // Android delivers location-mode changes only to context-registered receivers.
        ContextCompat.registerReceiver(context, ScheduleReceiver(), IntentFilter(LocationManager.MODE_CHANGED_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    // Mutations, network responses and receiver callbacks are serialized in the app process.
    private fun state() = protected.read("schedule")
    private fun save(state: JSONObject) = protected.write("schedule", state)

    fun beginForeground() { foregroundRequest.incrementAndGet() }

    private fun awaitsFull(state: JSONObject) = state.optBoolean("awaitingFull") || foregroundRequest.get() != confirmedForeground

    @Synchronized
    fun identity(): JSONObject {
        val state = state()
        if (!state.has("installationId")) {
            state.put("installationId", UUID.randomUUID().toString())
            save(state)
        }
        return os.status().put("installationId", state.getString("installationId"))
            .put("installationName", Build.MODEL).put("signedIn", api.hasSession())
    }

    @Synchronized
    fun scope(user: String, household: String?) {
        val state = state()
        if (state.optString("user") != user || state.optString("household") != household.orEmpty()) {
            retire(state)
            if (state.has("lastUser") && state.optString("lastUser") != user) {
                state.remove("installationId")
                state.remove("displayedTime")
                state.remove("locale")
            }
            state.put("user", user).put("lastUser", user).put("household", household.orEmpty()).remove("registered")
            save(state)
        }
    }

    @Synchronized
    fun signOut() {
        val state = state()
        // Leave durable cleanup state if an OS operation is unavailable during logout.
        try { retire(state) } finally {
            state.remove("user")
            state.remove("household")
            state.remove("registered")
            save(state)
            api.clearSession()
        }
    }

    @Synchronized
    fun clearCredentials() {
        val state = state()
        state.remove("registered")
        save(state)
        api.clearSession()
    }

    @Synchronized
    fun refresh(full: Boolean = false, signal: JSONObject? = null) {
        val state = state()
        val foreground = foregroundRequest.get()
        val needsFull = full || awaitsFull(state)
        if (awaitsFull(state) && !state.optBoolean("awaitingFull")) {
            state.put("awaitingFull", true)
            save(state)
        }
        finishRetirement(state)
        val current = state.optJSONObject("active")
        if (signal != null) {
            if (current == null || signal.optString("scopeRef") != current.optString("scopeRef")) return
            if (signal.optString("eventType") == "household.access_revoked" &&
                signal.optLong("householdRevision") >= current.optLong("revision")) retire(state)
            else if (signal.optLong("householdRevision") <= current.optLong("revision")) return
        }
        if (!api.hasSession() || state.optString("household").isEmpty()) return
        try {
            val id = identity().getString("installationId")
            val latest = state()
            val household = latest.getString("household")
            register(latest, id)
            val base = "/households/$household/installations/$id"
            val active = latest.optJSONObject("active")
            val cursor = if (needsFull) "" else active?.let { "?afterEpoch=${it.getString("epoch")}&afterRevision=${it.getLong("revision")}" }.orEmpty()
            var reply = api.userRequest("GET", "$base/sync$cursor").body

            if (active != null && requiresCleanup(version(active), version(reply))) {
                val pending = version(reply)
                retire(latest)
                // Pending fetched plans cannot survive a failed authorization/revalidation.
                reply = api.userRequest("GET", "$base/sync").body
                check(reply.getString("mode") == "FULL" && canApplyAfterCleanup(pending, version(reply)))
            }
            if (foreground != foregroundRequest.get()) return
            val currentVersion = version(reply)
            val previous = latest.optJSONObject("active")?.let(::version)
            if (needsFull && reply.getString("mode") != "FULL") return
            if (previous != null && previous.revision > currentVersion.revision) return
            if (needsFull) {
                latest.remove("awaitingFull")
                confirmedForeground = foreground
            }
            reconcile(latest, reply)
            drain(latest, base)
        } catch (failure: ApiFailure) {
            when {
                failure.status == 401 -> clearCredentials()
                failure.code in listOf("HOUSEHOLD_ACCESS_REVOKED", "HOUSEHOLD_ACCESS_DENIED", "INSTALLATION_ACCESS_DENIED") -> retire(state())
                else -> throw failure
            }
        }
    }

    @Synchronized
    fun recover(entry: ScheduleEntry) = restoreSchedule(entry, {
        replanTime(afterBoot = true)
    }, { refresh(full = true) })

    @Synchronized
    fun replanTime(afterBoot: Boolean = false) {
        val state = state()
        finishRetirement(state)
        val active = state.optJSONObject("active")
        if (active != null && !awaitsFull(state)) {
            if (afterBoot) interruptLocation(state, active)
            active.collection("plans").objects().filterNot { (_, plan) -> plan.location() }
                .forEach { (_, plan) -> applyTime(state, plan) }
        }
    }

    private fun register(state: JSONObject, id: String) {
        val token = if (FirebaseApp.getApps(context).isNotEmpty()) runCatching {
            Tasks.await(FirebaseMessaging.getInstance().token, 8, TimeUnit.SECONDS)
        }.getOrNull() else null
        val previous = state.optString("registered")
        val key = stableId(id, BuildConfig.VERSION_NAME, token.orEmpty(), state.getString("user"))
        if (key == previous) return
        val input = JSONObject().put("installationId", id).put("platform", "ANDROID").put("appVersion", BuildConfig.VERSION_NAME)
        if (token != null) input.put("pushToken", token)
        try {
            api.userRequest("PUT", "/installations", input, key)
        } catch (failure: ApiFailure) {
            if (failure.code != "PUSH_UNAVAILABLE") throw failure
            input.remove("pushToken")
            api.userRequest("PUT", "/installations", input, stableId(key, "without-push"))
            return
        }
        state.put("registered", key)
        save(state)
    }

    private fun version(value: JSONObject) = ScheduleVersion(value.getString("scopeRef"), value.getString("epoch"), value.getLong("revision"))

    private fun retire(state: JSONObject) {
        val active = state.optJSONObject("active")
        if (active != null) {
            state.put("retiring", active).remove("active")
            save(state)
        }
        finishRetirement(state)
    }

    private fun finishRetirement(state: JSONObject) {
        val pending = state.optJSONObject("retiring") ?: return
        val plans = pending.collection("plans")
        val events = pending.collection("events")
        plans.keys().asSequence().forEach { id ->
            val plan = plans.getJSONObject(id)
            os.cancel(planId(pending, plan))
            os.cancelPost(timeId(state, plan))
        }
        val cancelled = pending.collection("cancelled")
        cancelled.objects().forEach { (id, plan) ->
            os.cancel(id)
            os.cancelPost(timeId(state, plan))
        }
        events.keys().asSequence().forEach(os::cancelPost)
        val fences = state.collection("pendingFenceRemovals")
        plans.objects().filter { (_, plan) -> plan.location() }.forEach { (_, plan) -> fences.put(planId(pending, plan), true) }
        cancelled.objects().filter { (_, plan) -> plan.location() }.forEach { (id, _) -> fences.put(id, true) }
        os.cancelFenceDelivery()
        state.remove("retiring")
        save(state)
        ScheduleWork.enqueue(context, "location")
    }

    private fun reconcile(state: JSONObject, reply: JSONObject) {
        val previous = state.optJSONObject("active")
        val currentVersion = version(reply)
        val delta = reply.getString("mode") == "DELTA"
        if (delta && (previous == null || requiresCleanup(version(previous), currentVersion))) return
        if (previous != null && version(previous).revision > currentVersion.revision) return
        val applied = if (previous == null) JSONObject() else JSONObject(previous.toString())
        if (!applied.has("fenceRound")) applied.put("fenceRound", if (previous == null) UUID.randomUUID().toString() else "")
        applied.put("scopeRef", currentVersion.scopeRef).put("epoch", currentVersion.epoch).put("revision", currentVersion.revision)
        val before = previous?.collection("plans") ?: JSONObject()
        val plans = if (delta) applied.collection("plans") else JSONObject()
        val removed = reply.getJSONArray("removedPlanIds")
        val changed = reply.getJSONArray("plans")
        for (i in 0 until removed.length()) plans.remove(removed.getString(i))
        for (i in 0 until changed.length()) {
            val plan = changed.getJSONObject(i)
            plans.put(plan.getString("planId"), plan)
        }
        val oldIds = before.objects().filter { (id, old) -> plans.optJSONObject(id)?.optInt("version") != old.getInt("version") }
        val cancelled = applied.collection("cancelled")
        oldIds.forEach { (_, old) -> cancelled.put(planId(previous!!, old), old) }
        applied.put("plans", plans)
        val events = applied.collection("events")
        val locations = applied.collection("locations")
        locations.keys().asSequence().toList().forEach { id ->
            val location = locations.getJSONObject(id)
            if (plans.optJSONObject(id)?.optInt("version") != location.getInt("version")) locations.remove(id)
        }
        state.put("active", applied)
        save(state)

        cancelled.objects().forEach { (id, old) ->
            os.cancel(id)
            if (!plans.has(old.getString("planId"))) os.cancelPost(timeId(state, old))
        }
        events.objects().forEach { (id, event) ->
            if (plans.optJSONObject(event.getString("occurrenceId"))?.optInt("version") != event.getInt("triggerVersion") ||
                System.currentTimeMillis() - instant(event.getString("detectedAt")) >= 30 * DAY_MS) {
                os.cancelPost(id)
                events.remove(id)
            }
        }
        val pending = state.collection("pendingFenceRemovals")
        cancelled.objects().filter { (_, plan) -> plan.location() }.forEach { (id, _) -> pending.put(id, true) }
        applied.remove("cancelled")
        save(state)
        if (!applyIndependentSchedules({
            plans.objects().filterNot { (_, plan) -> plan.location() }.forEach { (_, plan) -> applyTime(state, plan) }
        }, { reconcileLocation(state) })) ScheduleWork.enqueue(context, "location")
    }

    private fun locationPlans(active: JSONObject) = active.collection("plans").objects().filter { (_, plan) -> plan.location() }

    private fun interruptLocation(state: JSONObject, active: JSONObject) {
        if (active.optBoolean("locationInterrupted")) return
        val plans = locationPlans(active)
        val previousIds = plans.map { (_, plan) -> planId(active, plan) }
        val pending = state.collection("pendingFenceRemovals")
        previousIds.forEach { pending.put(it, true) }
        val locations = active.collection("locations")
        locations.objects().forEach { (id, data) -> locations.put(id, suspendMonitoring(data.locationState()).toJson()) }
        active.put("locationInterrupted", true).put("fenceRound", UUID.randomUUID().toString()).remove("fences")
        save(state)
        previousIds.forEach(os::cancel)
        os.cancelFenceDelivery()
    }

    @Synchronized
    fun retryLocation() = reconcileLocation(state())

    @Synchronized
    fun locationInterrupted() {
        val state = state()
        state.optJSONObject("active")?.let { interruptLocation(state, it) }
        ScheduleWork.enqueue(context, "location")
    }

    private fun reconcileLocation(state: JSONObject) {
        val active = state.optJSONObject("active")
        if (!os.locationAllowed()) {
            if (active != null) interruptLocation(state, active)
            return
        }
        if (active != null && active.collection("fences").length() > 0 && !monitoringContinuous(active)) {
            interruptLocation(state, active)
        }
        val pending = state.collection("pendingFenceRemovals")
        pending.keys().asSequence().toList().chunked(100).forEach { batch ->
            os.removeFences(batch)
            batch.forEach(pending::remove)
            save(state)
        }
        if (active == null || awaitsFull(state)) return
        val desired = locationPlans(active).associate { (_, plan) -> planId(active, plan) to plan }
        val registered = active.collection("fences")
        registered.keys().asSequence().filter { it !in desired }.toList().forEach(registered::remove)
        val unregistered = desired.filterKeys { !registered.has(it) }
        os.addFences(unregistered)
        unregistered.keys.forEach { registered.put(it, true) }
        active.put("monitoringBoot", bootId()).put("monitoringProcess", processId).remove("locationInterrupted")
        save(state)
        locationPlans(active).forEach { (id, plan) ->
            val existing = active.collection("locations").optJSONObject(id)?.locationState() ?: return@forEach
            updateLocation(state, plan, LocationResult(existing))
        }
    }

    private fun monitoringContinuous(active: JSONObject) =
        active.optString("monitoringBoot") == bootId() && active.optString("monitoringProcess") == processId

    private fun checkMonitoring(state: JSONObject, active: JSONObject): Boolean {
        if (os.locationAllowed() && monitoringContinuous(active)) return true
        interruptLocation(state, active)
        ScheduleWork.enqueue(context, "location")
        return false
    }

    @Synchronized
    fun fired(id: String, timer: Boolean) {
        val state = state()
        if (awaitsFull(state)) return
        val active = state.optJSONObject("active") ?: return
        val plan = active.collection("plans").objects().firstOrNull { (_, plan) -> planId(active, plan) == id }?.second ?: return
        if (timer) {
            if (!checkMonitoring(state, active)) return
            val location = active.collection("locations").optJSONObject(plan.getString("planId"))?.locationState() ?: return
            updateLocation(state, plan, timerEvent(plan.getString("occurrenceId"), location, System.currentTimeMillis(),
                SystemClock.elapsedRealtime(), bootId(), epoch = active.getString("epoch")))
        } else applyTime(state, plan)
        drain(state, upload = false)
        ScheduleWork.enqueue(context, "refresh")
    }

    @Synchronized
    fun boundary(ids: List<String>, boundary: Boundary) {
        val state = state()
        val active = state.optJSONObject("active") ?: return
        if (awaitsFull(state)) {
            if (locationPlans(active).any { (_, plan) -> planId(active, plan) in ids }) interruptLocation(state, active)
            return
        }
        if (!checkMonitoring(state, active)) return
        val registered = active.collection("fences")
        locationPlans(active).filter { (_, plan) -> planId(active, plan).let { it in ids && registered.has(it) } }
            .forEach { (id, plan) ->
                val trigger = plan.getJSONObject("trigger")
                val location = active.collection("locations").optJSONObject(id)?.locationState() ?: LocationState(plan.getInt("version"))
                updateLocation(state, plan, changeBoundary(plan.getString("occurrenceId"), trigger.getString("event"),
                    trigger.optLong("durationMinutes") * 60_000, location, boundary, System.currentTimeMillis(),
                    SystemClock.elapsedRealtime(), bootId(), initial = location.boundary == Boundary.UNKNOWN, epoch = active.getString("epoch")))
            }
        drain(state, upload = false)
        ScheduleWork.enqueue(context, "refresh")
    }

    private fun updateLocation(state: JSONObject, plan: JSONObject, result: LocationResult) {
        val active = state.getJSONObject("active")
        active.collection("locations").put(plan.getString("planId"), result.state.toJson())
        result.event?.let { event -> active.collection("events").put(event.id, event.toJson()) }
        save(state)
        val id = planId(active, plan)
        os.cancel(id)
        result.state.timer?.let { os.alarmAt(id, it.elapsedDeadline, true, os.exactAllowed()) }
    }

    private fun applyTime(state: JSONObject, plan: JSONObject) {
        if (awaitsFull(state)) return
        val active = state.getJSONObject("active")
        val alarmId = planId(active, plan)
        val tag = timeId(state, plan)
        val at = instant(plan.getJSONObject("trigger").getString("scheduledAt"))
        val displayed = state.collection("displayedTime")
        val now = System.currentTimeMillis()
        displayed.keys().asSequence().toList().filter { now - displayed.getLong(it) > 30 * DAY_MS }.forEach(displayed::remove)
        when (val action = timeAction(at, now, os.exactAllowed(), displayed.has(tag))) {
            TimeAction.DROP -> os.cancel(alarmId)
            TimeAction.EXACT, TimeAction.INEXACT -> os.alarmAt(alarmId, at, false, action == TimeAction.EXACT)
            TimeAction.POST -> if (os.post(tag, false, english(state), plan)) {
                displayed.put(tag, now)
                save(state)
            }
        }
    }

    private fun drain(state: JSONObject, base: String? = null, upload: Boolean = true) {
        if (awaitsFull(state)) return
        val active = state.optJSONObject("active") ?: return
        val endpoint = base ?: "/households/${state.getString("household")}/installations/${state.getString("installationId")}"
        val plans = active.collection("plans")
        active.collection("events").objects().forEach { (id, event) ->
            if (event.optString("epoch") != active.getString("epoch") ||
                System.currentTimeMillis() - instant(event.getString("detectedAt")) >= 30 * DAY_MS) return@forEach
            val plan = plans.optJSONObject(event.getString("occurrenceId")) ?: return@forEach
            if (!event.optBoolean("posted") && os.post(id, true, english(state), plan)) {
                event.put("posted", true)
                save(state)
            }
            if (upload && !event.optBoolean("uploaded")) {
                val input = JSONObject(event.toString()).apply { remove("posted"); remove("uploaded") }
                try {
                    api.userRequest("POST", "$endpoint/events", input, id)
                    event.put("uploaded", true)
                    save(state)
                } catch (failure: ApiFailure) {
                    if (failure.status in 400..499) return@forEach
                    throw failure
                }
            }
        }
    }

    @Synchronized
    fun locale(value: String) {
        val state = state()
        state.put("locale", value)
        save(state)
    }

    private fun english(state: JSONObject): Boolean {
        val account = state.optString("locale").ifEmpty { context.resources.configuration.locales[0].language }
        return account == "en"
    }

    private fun bootId() = Settings.Global.getString(context.contentResolver, Settings.Global.BOOT_COUNT) ?: processId
    private fun instant(raw: String) = Instant.parse(raw).toEpochMilli()
    private fun planId(active: JSONObject, plan: JSONObject): String {
        val identity = arrayOf(active.getString("epoch"), plan.getString("planId"), plan.getString("version"))
        val round = active.optString("fenceRound")
        return if (plan.location() && round.isNotEmpty()) stableId(*identity, round) else stableId(*identity)
    }
    private fun timeId(state: JSONObject, plan: JSONObject) = stableId(state.getString("installationId"), plan.getString("occurrenceId"))
    private fun JSONObject.location() = getJSONObject("trigger").getString("kind") == "LOCATION"
    private fun JSONObject.collection(key: String) = optJSONObject(key) ?: JSONObject().also { put(key, it) }
    private fun JSONObject.objects() = keys().asSequence().map { it to getJSONObject(it) }.toList()

    private fun JSONObject.locationState() = LocationState(getInt("version"), Boundary.valueOf(getString("boundary")), getLong("transition"),
        optJSONObject("timer")?.let { LocationTimer(it.getLong("transition"), it.getString("condition"),
            it.getLong("elapsedDeadline"), it.getLong("utcDeadline"), it.getString("bootId")) })

    private fun LocationState.toJson() = JSONObject().put("version", version).put("boundary", boundary.name).put("transition", transition)
        .put("timer", timer?.let { JSONObject().put("transition", it.transition).put("condition", it.condition)
            .put("elapsedDeadline", it.elapsedDeadline).put("utcDeadline", it.utcDeadline).put("bootId", it.bootId) })

    private fun ConditionEvent.toJson() = JSONObject().put("epoch", epoch).put("eventId", id).put("occurrenceId", occurrenceId)
        .put("triggerVersion", version).put("condition", condition).put("detectedAt", Instant.ofEpochMilli(detectedAt).toString())
        .put("posted", posted).put("uploaded", uploaded)

    companion object {
        private val processId = UUID.randomUUID().toString()
        @Volatile private var instance: DeviceSchedule? = null
        fun get(context: Context): DeviceSchedule = instance ?: synchronized(this) {
            instance ?: DeviceSchedule(context.applicationContext).also { instance = it }
        }
    }
}
