-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "videoUrl" TEXT,
    "remotionProps" JSONB,
    "seriesId" TEXT,
    "episodeNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_sfx" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_sfx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_account_snapshots" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "unionId" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bioDescription" TEXT,
    "profileDeepLink" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_videos" (
    "id" TEXT NOT NULL,
    "createTime" INTEGER,
    "title" TEXT,
    "videoDescription" TEXT,
    "duration" INTEGER,
    "coverImageUrl" TEXT,
    "shareUrl" TEXT,
    "embedLink" TEXT,
    "localVideoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_video_snapshots" (
    "id" TEXT NOT NULL,
    "tiktokVideoId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiktok_video_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_sfx_slug_key" ON "custom_sfx"("slug");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_videos" ADD CONSTRAINT "tiktok_videos_localVideoId_fkey" FOREIGN KEY ("localVideoId") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiktok_video_snapshots" ADD CONSTRAINT "tiktok_video_snapshots_tiktokVideoId_fkey" FOREIGN KEY ("tiktokVideoId") REFERENCES "tiktok_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
