package app.notifyme.schedule

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class ScheduleStateTest {
    @Test
    fun separateEventsPreserveIndependentPostingAndUploadState() {
        val first = ConditionEvent("entry", "one", 7, "ENTER", 55)
        val second = ConditionEvent("exit", "one", 7, "EXIT", 65)
        val posted = first.copy(posted = true)
        assertFalse(posted.uploaded)
        assertTrue(posted.posted)
        assertFalse(second.posted)
        assertNotEquals(first.id, second.id)
        assertEquals(first.id, posted.copy(uploaded = true).id)
    }
}
