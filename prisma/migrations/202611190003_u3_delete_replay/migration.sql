ALTER TABLE "DeletionCommit" ADD COLUMN "inputDigest" TEXT;

CREATE TABLE "DeletedCreateKey" (
  "scopeDigest" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "inputDigest" TEXT NOT NULL,
  PRIMARY KEY ("scopeDigest", "format")
);
