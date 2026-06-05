-- CreateTable
CREATE TABLE "Manual" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "productName" TEXT,
    "yellowPinCount" INTEGER,
    "otherPinsNote" TEXT,
    "robotEnvironments" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "toollessToolColor" TEXT,
    "workVideoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "EnvironmentBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manualId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    CONSTRAINT "EnvironmentBlock_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envBlockId" TEXT NOT NULL,
    "programNumber" INTEGER NOT NULL,
    "robots" TEXT NOT NULL DEFAULT '[]',
    "number" TEXT,
    "name" TEXT,
    CONSTRAINT "Program_envBlockId_fkey" FOREIGN KEY ("envBlockId") REFERENCES "EnvironmentBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JigProcessStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manualId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    CONSTRAINT "JigProcessStep_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "manualId" TEXT,
    "jigStepId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaFile_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaFile_jigStepId_fkey" FOREIGN KEY ("jigStepId") REFERENCES "JigProcessStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Manual_processCode_key" ON "Manual"("processCode");

-- CreateIndex
CREATE INDEX "EnvironmentBlock_manualId_idx" ON "EnvironmentBlock"("manualId");

-- CreateIndex
CREATE INDEX "Program_envBlockId_idx" ON "Program"("envBlockId");

-- CreateIndex
CREATE INDEX "JigProcessStep_manualId_idx" ON "JigProcessStep"("manualId");

-- CreateIndex
CREATE INDEX "MediaFile_manualId_idx" ON "MediaFile"("manualId");

-- CreateIndex
CREATE INDEX "MediaFile_jigStepId_idx" ON "MediaFile"("jigStepId");
