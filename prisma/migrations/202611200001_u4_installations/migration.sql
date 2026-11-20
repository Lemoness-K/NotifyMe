-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionDigest" TEXT,
    "appVersion" TEXT NOT NULL,
    "tokenCiphertext" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallationScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "epoch" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "retainedFrom" INTEGER NOT NULL DEFAULT 0,
    "locationCount" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "InstallationScope_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallationScope_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DevicePlan" (
    "scopeId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT,
    "version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" DATETIME,

    PRIMARY KEY ("scopeId", "id"),
    CONSTRAINT "DevicePlan_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "InstallationScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationExclusion" (
    "scopeId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,

    PRIMARY KEY ("scopeId", "reminderId"),
    CONSTRAINT "LocationExclusion_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "InstallationScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "readyAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" DATETIME,
    "leaseToken" TEXT,
    CONSTRAINT "DeviceSignal_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "InstallationScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "scopeId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "digest" TEXT NOT NULL,

    PRIMARY KEY ("scopeId", "id"),
    CONSTRAINT "LocationEvent_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "InstallationScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallationCommand" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,

    PRIMARY KEY ("scope", "key")
);

-- CreateIndex
CREATE INDEX "Installation_userId_active_idx" ON "Installation"("userId", "active");

-- CreateIndex
CREATE INDEX "Installation_sessionDigest_idx" ON "Installation"("sessionDigest");

-- CreateIndex
CREATE INDEX "InstallationScope_householdId_state_idx" ON "InstallationScope"("householdId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationScope_installationId_householdId_key" ON "InstallationScope"("installationId", "householdId");

-- CreateIndex
CREATE INDEX "DevicePlan_scopeId_revision_id_idx" ON "DevicePlan"("scopeId", "revision", "id");

-- CreateIndex
CREATE INDEX "DevicePlan_scopeId_kind_reminderId_idx" ON "DevicePlan"("scopeId", "kind", "reminderId");

-- CreateIndex
CREATE INDEX "DevicePlan_removedAt_idx" ON "DevicePlan"("removedAt");

-- CreateIndex
CREATE INDEX "DeviceSignal_state_readyAt_id_idx" ON "DeviceSignal"("state", "readyAt", "id");

-- CreateIndex
CREATE INDEX "DeviceSignal_expiresAt_idx" ON "DeviceSignal"("expiresAt");

-- CreateIndex
CREATE INDEX "LocationEvent_detectedAt_idx" ON "LocationEvent"("detectedAt");

-- CreateIndex
CREATE INDEX "InstallationCommand_expiresAt_idx" ON "InstallationCommand"("expiresAt");
