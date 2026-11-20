package app.notifyme.client

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.Process
import app.notifyme.schedule.StartEvidence

internal fun launchEvidence(context: Context): StartEvidence {
    if (Build.VERSION.SDK_INT < 35) return StartEvidence.UNKNOWN
    val start = context.getSystemService(ActivityManager::class.java).getHistoricalProcessStartReasons(16)
        .firstOrNull { it.pid == Process.myPid() } ?: return StartEvidence.UNKNOWN
    return if (start.wasForceStopped()) StartEvidence.FORCE_STOPPED else StartEvidence.ORDINARY
}
