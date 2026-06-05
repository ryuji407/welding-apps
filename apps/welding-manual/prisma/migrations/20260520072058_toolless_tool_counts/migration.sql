/*
  Warnings:

  - You are about to drop the column `bluePinCount` on the `Manual` table. All the data in the column will be lost.
  - You are about to drop the column `redPinCount` on the `Manual` table. All the data in the column will be lost.
  - You are about to drop the column `yellowPinCount` on the `Manual` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Manual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "productName" TEXT,
    "toollessToolCounts" TEXT NOT NULL DEFAULT '{}',
    "robotEnvironments" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "toollessToolColor" TEXT,
    "workVideoUrl" TEXT,
    "layoutPhotoUrl" TEXT,
    "wagonPhotoUrl" TEXT,
    "notesPhotoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);
INSERT INTO "new_Manual" ("createdAt", "createdBy", "id", "layoutPhotoUrl", "notes", "notesPhotoUrl", "processCode", "productName", "robotEnvironments", "toollessToolColor", "updatedAt", "wagonPhotoUrl", "workVideoUrl") SELECT "createdAt", "createdBy", "id", "layoutPhotoUrl", "notes", "notesPhotoUrl", "processCode", "productName", "robotEnvironments", "toollessToolColor", "updatedAt", "wagonPhotoUrl", "workVideoUrl" FROM "Manual";
DROP TABLE "Manual";
ALTER TABLE "new_Manual" RENAME TO "Manual";
CREATE UNIQUE INDEX "Manual_processCode_key" ON "Manual"("processCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
