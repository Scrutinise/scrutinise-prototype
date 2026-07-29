-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "managerId" TEXT;

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "BulletinPost" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT,
    "body" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulletinVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulletinPost_communityId_parentId_idx" ON "BulletinPost"("communityId", "parentId");

-- CreateIndex
CREATE INDEX "BulletinPost_communityId_category_idx" ON "BulletinPost"("communityId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BulletinVote_postId_userId_key" ON "BulletinVote"("postId", "userId");

-- CreateIndex
CREATE INDEX "Community_managerId_idx" ON "Community"("managerId");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BulletinPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinVote" ADD CONSTRAINT "BulletinVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BulletinPost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulletinVote" ADD CONSTRAINT "BulletinVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
