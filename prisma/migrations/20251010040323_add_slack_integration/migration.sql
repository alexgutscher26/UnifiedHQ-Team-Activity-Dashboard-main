-- AlterTable
ALTER TABLE "connection" ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "teamName" TEXT;

-- CreateTable
CREATE TABLE "selectedChannel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "selectedChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttl" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "selectedChannel_userId_channelId_key" ON "selectedChannel"("userId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "slack_cache_userId_cacheKey_key" ON "slack_cache"("userId", "cacheKey");

-- AddForeignKey
ALTER TABLE "selectedChannel" ADD CONSTRAINT "selectedChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_cache" ADD CONSTRAINT "slack_cache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
