ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;
ALTER TABLE "User" ADD COLUMN "settingsRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("settingsRevision" >= 0);
ALTER TABLE "Household" ADD COLUMN "settingsRevision" INTEGER NOT NULL DEFAULT 0 CHECK ("settingsRevision" >= 0);
ALTER TABLE "Membership" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0 CHECK ("revision" >= 0);
ALTER TABLE "Membership" ADD COLUMN "joinedAt" DATETIME;
ALTER TABLE "Membership" ADD COLUMN "leftAt" DATETIME;
ALTER TABLE "Membership" ADD COLUMN "removedByUserId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "endedAt" DATETIME;

CREATE INDEX "Membership_householdId_active_role_idx" ON "Membership" ("householdId", "active", "role");

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "createdByUserId" TEXT NOT NULL REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "targetEmail" TEXT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "consumedByUserId" TEXT REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "revokedAt" DATETIME,
    CHECK ("expiresAt" > "createdAt"),
    CHECK ("consumedAt" IS NULL OR "revokedAt" IS NULL),
    CHECK (("consumedAt" IS NULL) = ("consumedByUserId" IS NULL)),
    CHECK (("consumedAt" IS NULL AND "revokedAt" IS NULL) OR "targetEmail" IS NULL)
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation" ("tokenHash");
CREATE INDEX "Invitation_householdId_createdAt_id_idx" ON "Invitation" ("householdId", "createdAt", "id");
CREATE INDEX "Invitation_expiresAt_id_idx" ON "Invitation" ("expiresAt", "id");

CREATE TABLE "HouseholdSettings" (
    "householdId" TEXT NOT NULL PRIMARY KEY REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "minRadiusM" INTEGER NOT NULL DEFAULT 50,
    "defaultRadiusM" INTEGER NOT NULL DEFAULT 100,
    "maxRadiusM" INTEGER NOT NULL DEFAULT 500,
    "maxLocationDurationMin" INTEGER NOT NULL DEFAULT 60,
    "weeklyCalendarConvention" TEXT NOT NULL DEFAULT 'MONDAY_START',
    CHECK (0 <= "minRadiusM" AND "minRadiusM" <= "defaultRadiusM" AND "defaultRadiusM" <= "maxRadiusM"),
    CHECK ("maxLocationDurationMin" BETWEEN 10 AND 1440),
    CHECK ("weeklyCalendarConvention" IN ('MONDAY_START', 'SUNDAY_START', 'ISO_8601'))
);

CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "locale" TEXT
);

CREATE TABLE "HouseholdAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "details" TEXT NOT NULL
);
CREATE INDEX "HouseholdAudit_householdId_createdAt_id_idx" ON "HouseholdAudit" ("householdId", "createdAt", "id");

CREATE TABLE "HouseholdCommandResult" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "inputSalt" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    PRIMARY KEY ("scope", "key")
);
