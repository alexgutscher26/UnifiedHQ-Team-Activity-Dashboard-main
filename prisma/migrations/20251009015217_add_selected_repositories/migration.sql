-- CreateTable
CREATE TABLE "selectedRepository" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "selectedRepository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "selectedRepository_userId_repoId_key" ON "selectedRepository"("userId", "repoId");

-- AddForeignKey
ALTER TABLE "selectedRepository" ADD CONSTRAINT "selectedRepository_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
