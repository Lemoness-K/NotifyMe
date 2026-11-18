-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("issuer", "subject"),
    CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singleton" INTEGER NOT NULL DEFAULT 1 CHECK ("singleton" = 1),
    "defaultTimeZone" TEXT NOT NULL DEFAULT 'Asia/Seoul'
);

-- CreateTable
CREATE TABLE "Membership" (
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('ADMIN', 'MEMBER')),
    "active" BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY ("householdId", "userId"),
    CONSTRAINT "Membership_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginChallenge" (
    "digest" TEXT NOT NULL PRIMARY KEY,
    "nonce" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LoginProof" (
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "authTime" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,

    PRIMARY KEY ("issuer", "subject", "authTime")
);

-- CreateTable
CREATE TABLE "Session" (
    "digest" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "authTime" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lifecycle" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reminder_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reminder_householdId_createdBy_fkey" FOREIGN KEY ("householdId", "createdBy") REFERENCES "Membership" ("householdId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reminder_householdId_requesterId_fkey" FOREIGN KEY ("householdId", "requesterId") REFERENCES "Membership" ("householdId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "householdId" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("reminderId", "userId"),
    CONSTRAINT "Assignment_reminderId_householdId_fkey" FOREIGN KEY ("reminderId", "householdId") REFERENCES "Reminder" ("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assignment_householdId_userId_fkey" FOREIGN KEY ("householdId", "userId") REFERENCES "Membership" ("householdId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trigger" (
    "reminderId" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'TIME',
    "scheduledAt" DATETIME NOT NULL,
    "timeZone" TEXT NOT NULL,
    CONSTRAINT "Trigger_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reminderId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" DATETIME NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Occurrence_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestResult" (
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,

    PRIMARY KEY ("householdId", "userId", "operation", "key"),
    CONSTRAINT "RequestResult_reminderId_householdId_fkey" FOREIGN KEY ("reminderId", "householdId") REFERENCES "Reminder" ("id", "householdId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_singleton_key" ON "Household"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "LoginChallenge_nonce_key" ON "LoginChallenge"("nonce");

-- CreateIndex
CREATE INDEX "LoginChallenge_expiresAt_idx" ON "LoginChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginProof_expiresAt_idx" ON "LoginProof"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Reminder_householdId_createdAt_id_idx" ON "Reminder"("householdId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Reminder_householdId_requesterId_idx" ON "Reminder"("householdId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_id_householdId_key" ON "Reminder"("id", "householdId");

-- CreateIndex
CREATE INDEX "Assignment_householdId_userId_idx" ON "Assignment"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Occurrence_reminderId_key" ON "Occurrence"("reminderId");
