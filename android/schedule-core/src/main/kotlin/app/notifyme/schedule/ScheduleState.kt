package app.notifyme.schedule

data class ConditionEvent(
    val id: String,
    val occurrenceId: String,
    val version: Int,
    val condition: String,
    val detectedAt: Long,
    val posted: Boolean = false,
    val uploaded: Boolean = false,
    val epoch: String = "",
)

enum class Boundary { UNKNOWN, INSIDE, OUTSIDE }

data class LocationTimer(
    val transition: Long,
    val condition: String,
    val elapsedDeadline: Long,
    val utcDeadline: Long,
    val bootId: String,
)

data class LocationState(
    val version: Int,
    val boundary: Boundary = Boundary.UNKNOWN,
    val transition: Long = 0,
    val timer: LocationTimer? = null,
)
