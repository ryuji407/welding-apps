-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EnvironmentBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manualId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "stepPhotos" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "EnvironmentBlock_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EnvironmentBlock" ("environment", "id", "manualId") SELECT "environment", "id", "manualId" FROM "EnvironmentBlock";
DROP TABLE "EnvironmentBlock";
ALTER TABLE "new_EnvironmentBlock" RENAME TO "EnvironmentBlock";
CREATE INDEX "EnvironmentBlock_manualId_idx" ON "EnvironmentBlock"("manualId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
