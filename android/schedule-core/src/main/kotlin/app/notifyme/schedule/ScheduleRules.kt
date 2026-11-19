package app.notifyme.schedule

import java.nio.charset.StandardCharsets.UTF_8
import java.util.UUID

const val DAY_MS = 86_400_000L

enum class TimeAction { EXACT, INEXACT, POST, DROP }

fun timeAction(scheduled: Long, utc: Long, exactAllowed: Boolean, posted: Boolean): TimeAction {
    if (posted || (utc >= scheduled && utc - scheduled > DAY_MS)) return TimeAction.DROP
    if (utc >= scheduled) return TimeAction.POST
    return if (exactAllowed) TimeAction.EXACT else TimeAction.INEXACT
}

data class ScheduleVersion(val scopeRef: String, val epoch: String, val revision: Long)

fun requiresCleanup(current: ScheduleVersion, next: ScheduleVersion): Boolean =
    current.scopeRef != next.scopeRef || current.epoch != next.epoch

fun freshFull(pending: ScheduleVersion, confirmed: ScheduleVersion, authorized: Boolean): Boolean =
    authorized && pending == confirmed

fun canApplyAfterCleanup(pending: ScheduleVersion, confirmed: ScheduleVersion?): Boolean =
    confirmed != null && (requiresCleanup(pending, confirmed) || confirmed.revision >= pending.revision)

data class LocationResult(val state: LocationState, val event: ConditionEvent? = null)

fun stableId(vararg values: String): String =
    UUID.nameUUIDFromBytes(values.joinToString("") { "${it.length}:$it" }.toByteArray(UTF_8)).toString()

private fun event(occurrenceId: String, state: LocationState, condition: String, utc: Long) =
    ConditionEvent(
        stableId(occurrenceId, state.version.toString(), state.transition.toString(), condition),
        occurrenceId, state.version, condition, utc,
    )

fun changeBoundary(
    occurrenceId: String, condition: String, durationMs: Long, state: LocationState,
    boundary: Boundary, utc: Long, elapsed: Long, bootId: String, initial: Boolean = false,
): LocationResult {
    if (boundary == Boundary.UNKNOWN || state.boundary == boundary) return LocationResult(state)
    if (initial) return LocationResult(state.copy(boundary = boundary, timer = null))
    val next = state.copy(boundary = boundary, transition = state.transition + 1, timer = null)
    val immediate = when (condition) {
        "ENTER" -> boundary == Boundary.INSIDE
        "EXIT" -> boundary == Boundary.OUTSIDE
        else -> false
    }
    if (immediate) return LocationResult(next, event(occurrenceId, next, condition, utc))
    val timed = (condition == "DWELL" && boundary == Boundary.INSIDE) ||
        (condition == "AFTER_EXIT" && boundary == Boundary.OUTSIDE)
    if (!timed || durationMs <= 0) return LocationResult(next)
    return LocationResult(next.copy(timer = LocationTimer(next.transition, condition, elapsed + durationMs, utc + durationMs, bootId)))
}

fun timerEvent(occurrenceId: String, state: LocationState, utc: Long, elapsed: Long, bootId: String): LocationResult {
    val timer = state.timer ?: return LocationResult(state)
    if (timer.bootId != bootId || timer.transition != state.transition || elapsed < timer.elapsedDeadline) {
        return LocationResult(state)
    }
    return LocationResult(state.copy(timer = null), event(occurrenceId, state, timer.condition, utc))
}

fun recoverTimer(state: LocationState, utc: Long, elapsed: Long, bootId: String, continuity: Boolean): LocationState {
    val timer = state.timer ?: return state
    if (timer.bootId == bootId) return state
    if (!continuity) return state.copy(timer = null, boundary = Boundary.UNKNOWN)
    return state.copy(timer = timer.copy(elapsedDeadline = elapsed + (timer.utcDeadline - utc).coerceAtLeast(0), bootId = bootId))
}
