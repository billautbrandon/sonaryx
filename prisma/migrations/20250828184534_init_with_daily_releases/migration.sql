-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lastReleaseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_releases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "spotifyLink" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "releaseName" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseType" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_releases_date_releaseId_key" ON "daily_releases"("date", "releaseId");
