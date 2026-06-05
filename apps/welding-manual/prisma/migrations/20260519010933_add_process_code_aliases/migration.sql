-- CreateTable
CREATE TABLE "ProcessCodeAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "manualId" TEXT NOT NULL,
    CONSTRAINT "ProcessCodeAlias_manualId_fkey" FOREIGN KEY ("manualId") REFERENCES "Manual" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessCodeAlias_processCode_key" ON "ProcessCodeAlias"("processCode");

-- CreateIndex
CREATE INDEX "ProcessCodeAlias_manualId_idx" ON "ProcessCodeAlias"("manualId");
