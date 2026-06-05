/*
  Warnings:

  - You are about to drop the column `otherPinsNote` on the `Manual` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Manual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "productName" TEXT,
    "yellowPinCount" INTEGER,
    "redPinCount" INTEGER,
    "bluePinCount" INTEGER,
    "robotEnvironments" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "toollessToolColor" TEXT,
    "workVideoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);
INSERT INTO "new_Manual" ("createdAt", "createdBy", "id", "notes", "processCode", "productName", "robotEnvironments", "toollessToolColor", "updatedAt", "workVideoUrl", "yellowPinCount") SELECT "createdAt", "createdBy", "id", "notes", "processCode", "productName", "robotEnvironments", "toollessToolColor", "updatedAt", "workVideoUrl", "yellowPinCount" FROM "Manual";
DROP TABLE "Manual";
ALTER TABLE "new_Manual" RENAME TO "Manual";
CREATE UNIQUE INDEX "Manual_processCode_key" ON "Manual"("processCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
