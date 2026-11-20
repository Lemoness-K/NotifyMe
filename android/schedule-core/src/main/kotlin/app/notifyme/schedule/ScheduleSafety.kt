package app.notifyme.schedule

enum class LocationInterruption { DISABLED, UNAVAILABLE }
enum class StartEvidence { ORDINARY, FORCE_STOPPED, UNKNOWN }

fun needsAuthorizedFull(evidence: StartEvidence, firstForeground: Boolean): Boolean =
    evidence == StartEvidence.FORCE_STOPPED || (firstForeground && evidence == StartEvidence.UNKNOWN)

fun canRecoverBootTime(evidence: StartEvidence, lastBoot: String, currentBoot: String): Boolean =
    evidence != StartEvidence.FORCE_STOPPED && lastBoot.isNotEmpty() && currentBoot.isNotEmpty() && lastBoot != currentBoot

data class LocationRegistration(val boot: String, val locationVersion: Long, val ids: Set<String>) {
    fun accepts(id: String, currentBoot: String, currentVersion: Long, allowed: Boolean): Boolean =
        allowed && boot == currentBoot && locationVersion == currentVersion && id in ids
}

data class ScheduleSafetyState(
    val locationVersion: Long = 0,
    val locationInterruption: LocationInterruption? = null,
    val authorizationVersion: Long = 0,
    val confirmedVersion: Long = 0,
) {
    val awaitsAuthorization: Boolean get() = authorizationVersion != confirmedVersion
}

class ScheduleSafety(initial: ScheduleSafetyState, private val persist: (ScheduleSafetyState) -> Unit) {
    private var snapshot = initial

    @Synchronized fun current(): ScheduleSafetyState = snapshot

    @Synchronized fun interruptLocation(reason: LocationInterruption) {
        change(snapshot.copy(locationVersion = snapshot.locationVersion + 1, locationInterruption = reason))
    }

    @Synchronized fun requireAuthorization(location: LocationInterruption? = null): Long {
        val locked = snapshot.copy(authorizationVersion = snapshot.authorizationVersion + 1)
        change(if (location == null) locked else locked.copy(locationVersion = locked.locationVersion + 1,
            locationInterruption = location))
        return snapshot.authorizationVersion
    }

    @Synchronized fun confirmAuthorization(version: Long): Boolean {
        if (snapshot.authorizationVersion != version) return false
        if (snapshot.awaitsAuthorization) change(snapshot.copy(confirmedVersion = version))
        return true
    }

    @Synchronized fun admitLocation(registrationVersion: Long, action: () -> Unit): Boolean {
        if (snapshot.locationVersion != registrationVersion || snapshot.awaitsAuthorization) return false
        action()
        return true
    }

    @Synchronized fun admitTime(action: () -> Unit): Boolean {
        if (snapshot.awaitsAuthorization) return false
        action()
        return true
    }

    private fun change(next: ScheduleSafetyState) {
        snapshot = next
        persist(next)
    }
}
