-- CreateTable
CREATE TABLE "userPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubOwner" TEXT,
    "githubRepo" TEXT,
    "githubRepoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "userPreferences_userId_key" ON "userPreferences"("userId");

-- AddForeignKey
ALTER TABLE "userPreferences" ADD CONSTRAINT "userPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
