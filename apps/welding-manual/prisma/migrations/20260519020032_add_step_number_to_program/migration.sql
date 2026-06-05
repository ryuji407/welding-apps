-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envBlockId" TEXT NOT NULL,
    "programNumber" INTEGER NOT NULL,
    "stepNumber" INTEGER NOT NULL DEFAULT 1,
    "robots" TEXT NOT NULL DEFAULT '[]',
    "number" TEXT,
    "name" TEXT,
    CONSTRAINT "Program_envBlockId_fkey" FOREIGN KEY ("envBlockId") REFERENCES "EnvironmentBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Program" ("envBlockId", "id", "name", "number", "programNumber", "robots") SELECT "envBlockId", "id", "name", "number", "programNumber", "robots" FROM "Program";
DROP TABLE "Program";
ALTER TABLE "new_Program" RENAME TO "Program";
CREATE INDEX "Program_envBlockId_idx" ON "Program"("envBlockId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
