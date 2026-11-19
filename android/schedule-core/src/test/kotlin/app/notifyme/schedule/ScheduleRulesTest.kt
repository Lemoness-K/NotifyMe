package app.notifyme.schedule

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScheduleRulesTest {
    @Test fun exactAndInexactBeforeDeadline() {
        assertEquals(TimeAction.EXACT, timeAction(1_000, 999, true, false))
        assertEquals(TimeAction.INEXACT, timeAction(1_000, 999, false, false))
    }

    @Test fun overdueNotificationIncludesBoundaryOnlyOnce() {
        assertEquals(TimeAction.POST, timeAction(1_000, 1_000 + DAY_MS, false, false))
        assertEquals(TimeAction.DROP, timeAction(1_000, 1_001 + DAY_MS, true, false))
        assertEquals(TimeAction.DROP, timeAction(1_000, 1_000, true, true))
    }

    @Test fun geofenceInitialSampleAndDuplicateTransitionDoNotNotify() {
        val start = LocationState(2)
        val initial = changeBoundary("p", "ENTER", 0, start, Boundary.INSIDE, 500, 100, "boot", initial = true)
        assertNull(initial.event)
        val duplicate = changeBoundary("p", "ENTER", 0, initial.state, Boundary.INSIDE, 600, 200, "boot")
        assertNull(duplicate.event)
        val exit = changeBoundary("p", "ENTER", 0, duplicate.state, Boundary.OUTSIDE, 700, 300, "boot")
        assertNotNull(changeBoundary("p", "ENTER", 0, exit.state, Boundary.INSIDE, 800, 400, "boot").event)
    }

    @Test fun dwellMustBeContinuousAndClockChangeDoesNotShiftElapsedDeadline() {
        val enter = changeBoundary("p", "DWELL", 1_000, LocationState(2), Boundary.INSIDE, 500, 100, "boot")
        assertNull(timerEvent("p", enter.state, 5_000, 1_099, "boot").event)
        assertNotNull(timerEvent("p", enter.state, 5_000, 1_100, "boot").event)
        val exit = changeBoundary("p", "DWELL", 1_000, enter.state, Boundary.OUTSIDE, 700, 300, "boot")
        assertNull(timerEvent("p", exit.state, 7_000, 1_300, "boot").event)
    }

    @Test fun reentryCancelsAfterExitAndRebootRequiresEvidence() {
        val exit = changeBoundary("p", "AFTER_EXIT", 500, LocationState(2), Boundary.OUTSIDE, 500, 100, "boot")
        assertNull(recoverTimer(exit.state, 600, 100, "new", false).timer)
        val recovered = recoverTimer(exit.state, 600, 100, "new", true)
        assertNotNull(timerEvent("p", recovered, 1_001, 500, "new").event)
        val enter = changeBoundary("p", "AFTER_EXIT", 500, recovered, Boundary.INSIDE, 700, 200, "new")
        assertNull(enter.state.timer)
    }

    @Test fun newerEpochCanApplyOnlyAfterCleanupAndAuthoritativeConfirmation() {
        val old = ScheduleVersion("before", "epoch-a", 14)
        val next = ScheduleVersion("after", "epoch-b", 1)
        assertTrue(requiresCleanup(old, next))
        assertTrue(freshFull(next, next, authorized = true))
        assertFalse(freshFull(next, next.copy(revision = 2), authorized = true))
        assertFalse(freshFull(next, next, authorized = false))
        assertFalse(requiresCleanup(next, next.copy(revision = 2)))
    }

    @Test fun cleanupCommitsBeforeAnyAuthoritativeFullIsApplied() {
        val pending = ScheduleVersion("next", "epoch-b", 4)
        assertFalse(canApplyAfterCleanup(pending, null)) // Offline, revoked, or session has expired.
        assertFalse(canApplyAfterCleanup(pending, pending.copy(revision = 3)))
        assertTrue(canApplyAfterCleanup(pending, pending))
        assertTrue(canApplyAfterCleanup(pending, pending.copy(revision = 5)))
        assertTrue(canApplyAfterCleanup(pending, ScheduleVersion("restored", "epoch-c", 1)))
    }
}
