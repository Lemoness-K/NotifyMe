ALTER TABLE "Reminder" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Reminder" ADD COLUMN "verificationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reminder" ADD COLUMN "verifierUserId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN "pausedAt" DATETIME;
CREATE INDEX "Reminder_householdId_lifecycle_archivedAt_id_idx" ON "Reminder"("householdId", "lifecycle", "archivedAt", "id");

ALTER TABLE "Assignment" RENAME TO "PreviousAssignment";
CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "reminderId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endedAt" DATETIME,
  "assignedAt" DATETIME,
  FOREIGN KEY ("reminderId","householdId") REFERENCES "Reminder"("id","householdId") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("householdId","userId") REFERENCES "Membership"("householdId","userId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Assignment" ("id","householdId","reminderId","userId","endedAt")
SELECT lower(hex(randomblob(16))), "householdId","reminderId","userId","endedAt" FROM "PreviousAssignment";
DROP TABLE "PreviousAssignment";
CREATE INDEX "Assignment_householdId_userId_idx" ON "Assignment"("householdId","userId");
CREATE INDEX "Assignment_reminderId_userId_endedAt_idx" ON "Assignment"("reminderId","userId","endedAt");
CREATE UNIQUE INDEX "Assignment_one_active" ON "Assignment"("reminderId","userId") WHERE "endedAt" IS NULL;

ALTER TABLE "Trigger" RENAME TO "PreviousTrigger";
CREATE TABLE "Trigger" (
  "reminderId" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL DEFAULT 'TIME',
  "scheduledAt" DATETIME,
  "timeZone" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "placeName" TEXT,
  "radiusM" INTEGER,
  "event" TEXT,
  "durationMin" INTEGER,
  FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "Trigger" ("reminderId", "kind", "scheduledAt", "timeZone")
SELECT "reminderId", "kind", "scheduledAt", "timeZone" FROM "PreviousTrigger";
DROP TABLE "PreviousTrigger";

CREATE TABLE "RecurrenceRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "definition" TEXT NOT NULL,
  "generatedThrough" TEXT,
  FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RecurrenceRule_reminderId_effectiveFrom_idx" ON "RecurrenceRule"("reminderId", "effectiveFrom");

ALTER TABLE "Occurrence" RENAME TO "PreviousOccurrence";
CREATE TABLE "Occurrence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reminderId" TEXT NOT NULL,
  "occurrenceKey" TEXT NOT NULL DEFAULT 'initial',
  "recurrenceRuleId" TEXT,
  "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','VERIFICATION_PENDING','COMPLETED','MISSED','SKIPPED','CANCELLED')),
  "scheduledAt" DATETIME,
  "stateAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "Occurrence" ("id", "reminderId", "state", "scheduledAt", "revision", "stateAt")
SELECT p."id", p."reminderId", p."state", p."scheduledAt", p."revision", r."createdAt"
FROM "PreviousOccurrence" p JOIN "Reminder" r ON r."id" = p."reminderId";
DROP TABLE "PreviousOccurrence";
CREATE UNIQUE INDEX "Occurrence_reminderId_occurrenceKey_key" ON "Occurrence"("reminderId","occurrenceKey");
CREATE INDEX "Occurrence_reminderId_state_scheduledAt_id_idx" ON "Occurrence"("reminderId","state","scheduledAt","id");
CREATE INDEX "Occurrence_reminderId_state_stateAt_id_idx" ON "Occurrence"("reminderId","state","stateAt","id");

CREATE TABLE "OccurrenceOverride" (
  "occurrenceId" TEXT NOT NULL PRIMARY KEY,
  "patch" TEXT NOT NULL,
  FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Completion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "occurrenceId" TEXT NOT NULL,
  "submittedBy" TEXT NOT NULL,
  "verifierUserId" TEXT,
  "state" TEXT NOT NULL,
  "requestedAt" DATETIME NOT NULL,
  "respondedAt" DATETIME,
  "responseActorId" TEXT,
  "reason" TEXT,
  FOREIGN KEY ("occurrenceId") REFERENCES "Occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Completion_open_occurrence" ON "Completion"("occurrenceId") WHERE "state" = 'OPEN';
CREATE INDEX "Completion_occurrenceId_requestedAt_id_idx" ON "Completion"("occurrenceId","requestedAt","id");
CREATE INDEX "Completion_verifierUserId_state_idx" ON "Completion"("verifierUserId","state");

CREATE TABLE "ReminderAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "reminderId" TEXT NOT NULL,
  "occurrenceId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "stateAt" DATETIME NOT NULL,
  "changes" TEXT NOT NULL,
  FOREIGN KEY ("reminderId","householdId") REFERENCES "Reminder"("id","householdId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReminderAudit_householdId_stateAt_id_idx" ON "ReminderAudit"("householdId","stateAt","id");
CREATE INDEX "ReminderAudit_reminderId_stateAt_id_idx" ON "ReminderAudit"("reminderId","stateAt","id");

CREATE TABLE "ReminderCommandResult" (
  "householdId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "reminderId" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  PRIMARY KEY ("householdId","actorId","operation","key"),
  FOREIGN KEY ("reminderId","householdId") REFERENCES "Reminder"("id","householdId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReminderCommandResult_reminderId_idx" ON "ReminderCommandResult"("reminderId");

CREATE TABLE "HouseholdFeedCursor" ("householdId" TEXT NOT NULL PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0);
CREATE TABLE "ReminderFeedEntry" (
  "householdId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "reminderId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "changedAt" DATETIME NOT NULL,
  "expiresAt" DATETIME,
  PRIMARY KEY ("householdId","revision")
);
CREATE INDEX "ReminderFeedEntry_expiresAt_idx" ON "ReminderFeedEntry"("expiresAt");
CREATE INDEX "ReminderFeedEntry_householdId_reminderId_idx" ON "ReminderFeedEntry"("householdId","reminderId");

CREATE TABLE "DeletionCommit" (
  "requestId" TEXT NOT NULL PRIMARY KEY,
  "householdId" TEXT NOT NULL,
  "reminderId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "committedAt" DATETIME NOT NULL
);
CREATE INDEX "DeletionCommit_householdId_reminderId_idx" ON "DeletionCommit"("householdId","reminderId");
CREATE TABLE "RecoveryJournalIdentity" ("id" INTEGER NOT NULL PRIMARY KEY, "token" TEXT NOT NULL);
