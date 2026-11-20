package app.notifyme.schedule

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScheduleSafetyTest {
    private class Disk {
        var record = ScheduleSafetyState()
        fun open() = ScheduleSafety(record) { record = it }
    }

    @Test fun locationOffAndProviderFailureFenceOffAlreadyQueuedEventsBeforeWorkRuns() {
        for (failure in listOf(LocationInterruption.DISABLED, LocationInterruption.UNAVAILABLE)) {
            val disk = Disk()
            val running = disk.open()
            val registered = running.current().locationVersion
            running.interruptLocation(failure)
            assertFalse(running.admitLocation(registered) { error("an old queued timer must never post") })
            val relaunched = disk.open()
            assertEquals(failure, relaunched.current().locationInterruption)
            assertFalse(relaunched.admitLocation(registered) { error("ON does not revive the old registration") })
            assertTrue(relaunched.admitLocation(relaunched.current().locationVersion) {})
        }
    }

    @Test fun liveGeofencingRegistrationSurvivesOrdinaryProcessRecreation() {
        val disk = Disk()
        val registration = LocationRegistration("boot", 0, setOf("fence"))
        val restored = disk.open().current()
        assertTrue(registration.accepts("fence", "boot", restored.locationVersion, allowed = true))
        assertFalse(registration.accepts("previous-fence", "boot", restored.locationVersion, allowed = true))
        assertFalse(registration.accepts("fence", "new-boot", restored.locationVersion, allowed = true))
        assertFalse(registration.accepts("fence", "boot", restored.locationVersion, allowed = false))
        val registeredState = LocationState(7, Boundary.OUTSIDE)
        assertNotNull(changeBoundary("reminder", "ENTER", 0, registeredState, Boundary.INSIDE, 100, 100, "boot").event)
        val running = changeBoundary("reminder", "DWELL", 10, registeredState, Boundary.INSIDE, 100, 100, "boot").state
        assertNotNull(timerEvent("reminder", running, 110, 110, "boot").event)
        assertFalse(registration.accepts("fence", "boot", restored.locationVersion + 1, allowed = true))
        assertNull(changeBoundary("reminder", "ENTER", 0, suspendMonitoring(registeredState), Boundary.INSIDE,
            111, 111, "boot", initial = true).event)
    }

    @Test fun warmAndVerifiedOrdinaryForegroundCanKeepAuthorizedStateOffline() {
        assertFalse(needsAuthorizedFull(StartEvidence.UNKNOWN, firstForeground = false))
        assertFalse(needsAuthorizedFull(StartEvidence.ORDINARY, firstForeground = true))
        assertTrue(needsAuthorizedFull(StartEvidence.UNKNOWN, firstForeground = true))
        assertTrue(needsAuthorizedFull(StartEvidence.FORCE_STOPPED, firstForeground = false))
        val gate = Disk().open()
        assertTrue(gate.admitTime {})
    }

    @Test fun forceStopBootAndScopeRevocationCannotBypassAnOutstandingFull() {
        assertFalse(canRecoverBootTime(StartEvidence.FORCE_STOPPED, "old", "boot"))
        assertFalse(canRecoverBootTime(StartEvidence.UNKNOWN, "boot", "boot"))
        assertFalse(canRecoverBootTime(StartEvidence.ORDINARY, "boot", "boot"))
        assertTrue(canRecoverBootTime(StartEvidence.ORDINARY, "old", "boot"))
        val disk = Disk()
        val gate = disk.open()
        val first = gate.requireAuthorization()
        assertFalse(disk.open().admitTime { error("cold foreground or boot must not post") })
        val revoked = gate.requireAuthorization()
        assertFalse(gate.confirmAuthorization(first))
        assertFalse(gate.admitTime {})
        assertTrue(gate.confirmAuthorization(revoked))
        assertTrue(disk.open().admitTime {})
    }
}
