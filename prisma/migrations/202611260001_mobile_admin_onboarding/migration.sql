-- A restored snapshot may already have these tables from recovery migrations
-- before Prisma records this deployment in its migration history.
CREATE TABLE IF NOT EXISTS "InstallationSetup" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
    "setupCycle" TEXT NOT NULL,
    "databaseIdentity" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstallationSetup_setupCycle_key" ON "InstallationSetup"("setupCycle");
CREATE UNIQUE INDEX IF NOT EXISTS "InstallationSetup_databaseIdentity_key" ON "InstallationSetup"("databaseIdentity");

CREATE TABLE IF NOT EXISTS "SetupCandidate" (
    "candidateId" TEXT NOT NULL PRIMARY KEY,
    "setupCycle" TEXT NOT NULL,
    "verifiedIssuer" TEXT NOT NULL,
    "verifiedSubject" TEXT NOT NULL,
    "verifiedGoogleSubject" TEXT NOT NULL,
    "credentialDigest" TEXT NOT NULL,
    "authenticationTime" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "SetupCandidate_setupCycle_fkey" FOREIGN KEY ("setupCycle") REFERENCES "InstallationSetup" ("setupCycle") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SetupCandidate_setupCycle_key" ON "SetupCandidate"("setupCycle");
CREATE UNIQUE INDEX IF NOT EXISTS "SetupCandidate_credentialDigest_key" ON "SetupCandidate"("credentialDigest");

CREATE TABLE IF NOT EXISTS "SetupCompletion" (
    "setupCycle" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "committedAt" DATETIME NOT NULL,
    "replayUntil" DATETIME NOT NULL,
    CONSTRAINT "SetupCompletion_setupCycle_fkey" FOREIGN KEY ("setupCycle") REFERENCES "InstallationSetup" ("setupCycle") ON DELETE RESTRICT ON UPDATE CASCADE
);
