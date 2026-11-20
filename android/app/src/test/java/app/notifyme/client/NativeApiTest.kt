package app.notifyme.client

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeApiTest {
    @Test fun successPayloadsPreserveListsAndObjects() {
        val rows = NativeApi.decode("""[{"userId":"household-member"}]""") as JSONArray
        assertEquals("household-member", rows.getJSONObject(0).getString("userId"))
        val snapshot = NativeApi.decode("""{"epoch":"next"}""") as JSONObject
        assertEquals("next", snapshot.getString("epoch"))
        assertEquals(0, (NativeApi.decode("") as JSONObject).length())
    }

    @Test fun onlySupportedLocalPathsAndVerbsAreAllowedThroughTheBridge() {
        assertTrue(NativeApi.allows("GET", "/households/home/members", fromWeb = true))
        assertTrue(NativeApi.allows("GET", "/households/home/installations/device/location-exclusions?limit=1", fromWeb = true))
        assertFalse(NativeApi.allows("GET", "/households/home/installations/device/sync", fromWeb = true))
        assertTrue(NativeApi.allows("GET", "/households/home/installations/device/sync", fromWeb = false))
        assertFalse(NativeApi.allows("GET", "//outside.invalid/api/v1/me", fromWeb = true))
        assertFalse(NativeApi.allows("GET", "/households/home/%2e%2e/members", fromWeb = true))
        assertFalse(NativeApi.allows("POST", "/sessions", fromWeb = true))
        assertFalse(NativeApi.allows("DELETE", "/households/home/members", fromWeb = true))
    }
}
