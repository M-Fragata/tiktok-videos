import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.ts';
import { STORAGE_OUTPUT_DIR } from './remotion.service.ts';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

const TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.manage',
].join(',');

const TOKEN_STORE_PATH = path.join(STORAGE_OUTPUT_DIR, 'tiktok-auth.json');

interface PkceEntry {
  codeVerifier: string;
  createdAt: number;
}

export interface TikTokTokenData {
  open_id: string;
  scope: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  token_type: string;
  obtained_at: number;
}

const pkceStore = new Map<string, PkceEntry>();

function getTikTokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI?.trim() ||
    'http://127.0.0.1:3333/api/tiktok/callback';

  if (!clientKey || !clientSecret) {
    throw new Error(
      'TIKTOK_CLIENT_KEY ou TIKTOK_CLIENT_SECRET não configurados no backend/.env.'
    );
  }

  return { clientKey, clientSecret, redirectUri };
}

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallengeHex(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('hex');
}

export function buildTikTokAuthorizeUrl(): string {
  const { clientKey, redirectUri } = getTikTokConfig();
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallengeHex(codeVerifier);

  // Limpa estados com mais de 15 minutos
  const now = Date.now();
  for (const [key, entry] of pkceStore.entries()) {
    if (now - entry.createdAt > 15 * 60 * 1000) {
      pkceStore.delete(key);
    }
  }

  pkceStore.set(state, { codeVerifier, createdAt: now });

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: TIKTOK_SCOPES,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

function saveTokenData(data: TikTokTokenData): void {
  fs.mkdirSync(path.dirname(TOKEN_STORE_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadTokenData(): TikTokTokenData | null {
  if (!fs.existsSync(TOKEN_STORE_PATH)) return null;
  try {
    return JSON.parse(
      fs.readFileSync(TOKEN_STORE_PATH, 'utf-8')
    ) as TikTokTokenData;
  } catch {
    return null;
  }
}

export async function exchangeTikTokCode(
  code: string,
  state: string
): Promise<TikTokTokenData> {
  const { clientKey, clientSecret, redirectUri } = getTikTokConfig();
  const entry = pkceStore.get(state);
  if (!entry) {
    throw new Error(
      'Parâmetro state inválido ou expirado. Inicie o login novamente em /api/tiktok/login.'
    );
  }
  pkceStore.delete(state);

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: entry.codeVerifier,
  });

  const resp = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });

  const json = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Falha ao trocar code por token (${resp.status}): ${JSON.stringify(json)}`
    );
  }

  const tokenData: TikTokTokenData = {
    open_id: String(json.open_id || ''),
    scope: String(json.scope || ''),
    access_token: String(json.access_token),
    expires_in: Number(json.expires_in || 86400),
    refresh_token: String(json.refresh_token || ''),
    refresh_expires_in: Number(json.refresh_expires_in || 31536000),
    token_type: String(json.token_type || 'Bearer'),
    obtained_at: Date.now(),
  };

  saveTokenData(tokenData);
  return tokenData;
}

export async function refreshTikTokToken(
  currentRefreshToken: string
): Promise<TikTokTokenData> {
  const { clientKey, clientSecret } = getTikTokConfig();

  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
  });

  const resp = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });

  const json = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok || !json.access_token) {
    throw new Error(
      `Falha ao renovar token TikTok (${resp.status}): ${JSON.stringify(json)}`
    );
  }

  const tokenData: TikTokTokenData = {
    open_id: String(json.open_id || ''),
    scope: String(json.scope || ''),
    access_token: String(json.access_token),
    expires_in: Number(json.expires_in || 86400),
    refresh_token: String(json.refresh_token || currentRefreshToken),
    refresh_expires_in: Number(json.refresh_expires_in || 31536000),
    token_type: String(json.token_type || 'Bearer'),
    obtained_at: Date.now(),
  };

  saveTokenData(tokenData);
  return tokenData;
}

export async function getValidTikTokAccessToken(): Promise<string> {
  const stored = loadTokenData();
  if (!stored) {
    throw new Error(
      'Conta TikTok ainda não conectada. Acesse /api/tiktok/login para autorizar.'
    );
  }

  const elapsedSec = (Date.now() - stored.obtained_at) / 1000;
  if (elapsedSec >= stored.expires_in - 120) {
    const refreshed = await refreshTikTokToken(stored.refresh_token);
    return refreshed.access_token;
  }

  return stored.access_token;
}

export async function fetchTikTokUserInfo(accessToken: string) {
  const fields = [
    'open_id',
    'union_id',
    'avatar_url',
    'display_name',
    'bio_description',
    'profile_deep_link',
    'is_verified',
    'follower_count',
    'following_count',
    'likes_count',
    'video_count',
  ].join(',');

  const resp = await fetch(
    `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return (await resp.json()) as Record<string, unknown>;
}

export async function fetchTikTokVideoList(
  accessToken: string,
  maxCount = 20,
  cursor?: number
) {
  const fields = [
    'id',
    'create_time',
    'cover_image_url',
    'share_url',
    'video_description',
    'duration',
    'title',
    'embed_link',
    'like_count',
    'comment_count',
    'share_count',
    'view_count',
  ].join(',');

  const payload: Record<string, unknown> = { max_count: maxCount };
  if (typeof cursor === 'number') {
    payload.cursor = cursor;
  }

  const resp = await fetch(
    `${TIKTOK_VIDEO_LIST_URL}?fields=${encodeURIComponent(fields)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  return (await resp.json()) as Record<string, unknown>;
}

/**
 * Sincroniza em tempo real os dados da conta e dos vídeos com a API do TikTok
 * e grava novos snapshots históricos no banco SQLite (Prisma).
 */
export async function syncTikTokData(): Promise<{
  accountSnapshot: unknown;
  videosSynced: number;
}> {
  const accessToken = await getValidTikTokAccessToken();
  const [userInfoResp, firstPageResp] = await Promise.all([
    fetchTikTokUserInfo(accessToken),
    fetchTikTokVideoList(accessToken, 20),
  ]);

  const userInfoData = userInfoResp?.data as
    | {
        user?: {
          open_id?: string;
          union_id?: string;
          display_name?: string;
          avatar_url?: string;
          bio_description?: string;
          profile_deep_link?: string;
          is_verified?: boolean;
          follower_count?: number;
          following_count?: number;
          likes_count?: number;
          video_count?: number;
        };
      }
    | undefined;

  const user = userInfoData?.user;
  if (!user || !user.open_id) {
    throw new Error(
      `Resposta inválida da API TikTok ao obter perfil: ${JSON.stringify(userInfoResp)}`
    );
  }

  const accountSnapshot = await prisma.tikTokAccountSnapshot.create({
    data: {
      openId: String(user.open_id),
      unionId: user.union_id ? String(user.union_id) : null,
      displayName: user.display_name ? String(user.display_name) : null,
      avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
      bioDescription: user.bio_description ? String(user.bio_description) : null,
      profileDeepLink: user.profile_deep_link
        ? String(user.profile_deep_link)
        : null,
      isVerified: Boolean(user.is_verified),
      followerCount: Number(user.follower_count || 0),
      followingCount: Number(user.following_count || 0),
      likesCount: Number(user.likes_count || 0),
      videoCount: Number(user.video_count || 0),
    },
  });

  interface RawTikTokVideoItem {
    id: string;
    create_time?: number;
    title?: string;
    video_description?: string;
    duration?: number;
    cover_image_url?: string;
    share_url?: string;
    embed_link?: string;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
  }

  interface RawPageData {
    cursor?: number;
    has_more?: boolean;
    videos?: RawTikTokVideoItem[];
  }

  const allVideos: RawTikTokVideoItem[] = [];
  const firstData = firstPageResp?.data as RawPageData | undefined;
  if (Array.isArray(firstData?.videos)) {
    allVideos.push(...firstData.videos);
  }

  let currentCursor = firstData?.cursor;
  let hasMore = Boolean(firstData?.has_more);
  let pageCount = 1;

  while (hasMore && typeof currentCursor === 'number' && pageCount < 5) {
    try {
      const nextPageResp = await fetchTikTokVideoList(
        accessToken,
        20,
        currentCursor
      );
      const nextData = nextPageResp?.data as RawPageData | undefined;
      if (Array.isArray(nextData?.videos) && nextData.videos.length > 0) {
        allVideos.push(...nextData.videos);
      }
      hasMore = Boolean(nextData?.has_more);
      currentCursor = nextData?.cursor;
      pageCount++;
    } catch (err) {
      console.warn('[TikTok Sync] Erro ao paginar vídeos adicionais:', err);
      break;
    }
  }

  for (const v of allVideos) {
    if (!v.id) continue;

    await prisma.tikTokVideo.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        createTime: typeof v.create_time === 'number' ? v.create_time : null,
        title: v.title ? String(v.title) : null,
        videoDescription: v.video_description
          ? String(v.video_description)
          : null,
        duration: typeof v.duration === 'number' ? v.duration : null,
        coverImageUrl: v.cover_image_url ? String(v.cover_image_url) : null,
        shareUrl: v.share_url ? String(v.share_url) : null,
        embedLink: v.embed_link ? String(v.embed_link) : null,
      },
      update: {
        createTime: typeof v.create_time === 'number' ? v.create_time : null,
        title: v.title ? String(v.title) : null,
        videoDescription: v.video_description
          ? String(v.video_description)
          : null,
        duration: typeof v.duration === 'number' ? v.duration : null,
        coverImageUrl: v.cover_image_url ? String(v.cover_image_url) : null,
        shareUrl: v.share_url ? String(v.share_url) : null,
        embedLink: v.embed_link ? String(v.embed_link) : null,
      },
    });

    await prisma.tikTokVideoSnapshot.create({
      data: {
        tiktokVideoId: v.id,
        viewCount: Number(v.view_count || 0),
        likeCount: Number(v.like_count || 0),
        commentCount: Number(v.comment_count || 0),
        shareCount: Number(v.share_count || 0),
      },
    });
  }

  return {
    accountSnapshot,
    videosSynced: allVideos.length,
  };
}

export interface TikTokDashboardPayload {
  connected: boolean;
  lastSyncAt: string | null;
  account: {
    openId: string;
    displayName: string | null;
    avatarUrl: string | null;
    bioDescription: string | null;
    profileDeepLink: string | null;
    isVerified: boolean;
    followerCount: number;
    followingCount: number;
    likesCount: number;
    videoCount: number;
    followerDelta: number;
    likesDelta: number;
    videoDelta: number;
    totalViews: number;
    totalViewsDelta: number;
    averageEngagementRate: number;
  } | null;
  accountHistory: Array<{
    recordedAt: string;
    followerCount: number;
    likesCount: number;
    videoCount: number;
  }>;
  videos: Array<{
    id: string;
    createTime: number | null;
    title: string | null;
    videoDescription: string | null;
    duration: number | null;
    coverImageUrl: string | null;
    shareUrl: string | null;
    embedLink: string | null;
    localVideoId: string | null;
    localVideo: {
      id: string;
      theme: string;
      status: string;
      videoUrl: string | null;
    } | null;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    viewDelta: number;
    likeDelta: number;
    commentDelta: number;
    shareDelta: number;
    engagementRate: number;
    snapshots: Array<{
      recordedAt: string;
      viewCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
    }>;
  }>;
  studioVideos: Array<{
    id: string;
    theme: string;
    status: string;
    videoUrl: string | null;
    createdAt: string;
  }>;
}

/**
 * Retorna os dados consolidados do painel do TikTok a partir do banco SQLite,
 * calculando deltas de crescimento, taxa de engajamento e histórico.
 */
export async function getTikTokDashboardData(): Promise<TikTokDashboardPayload> {
  const tokenData = loadTokenData();
  const isConnected = Boolean(tokenData);

  const accountSnapshots = await prisma.tikTokAccountSnapshot.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 30,
  });

  const latestAccount = accountSnapshots[0] || null;
  const previousAccount = accountSnapshots[1] || null;

  const dbVideos = await prisma.tikTokVideo.findMany({
    include: {
      snapshots: {
        orderBy: { recordedAt: 'desc' },
        take: 15,
      },
      localVideo: {
        select: {
          id: true,
          theme: true,
          status: true,
          videoUrl: true,
        },
      },
    },
    orderBy: { createTime: 'desc' },
  });

  let totalViews = 0;
  let previousTotalViews = 0;
  let sumEngagementRates = 0;

  const processedVideos = dbVideos.map((v) => {
    const latestSnap = v.snapshots[0];
    const prevSnap = v.snapshots[1];

    const viewCount = latestSnap?.viewCount || 0;
    const likeCount = latestSnap?.likeCount || 0;
    const commentCount = latestSnap?.commentCount || 0;
    const shareCount = latestSnap?.shareCount || 0;

    const prevViews = prevSnap?.viewCount || 0;
    const prevLikes = prevSnap?.likeCount || 0;
    const prevComments = prevSnap?.commentCount || 0;
    const prevShares = prevSnap?.shareCount || 0;

    totalViews += viewCount;
    previousTotalViews += prevViews;

    const engagementRate =
      viewCount > 0
        ? Number((((likeCount + commentCount + shareCount) / viewCount) * 100).toFixed(2))
        : 0;

    sumEngagementRates += engagementRate;

    return {
      id: v.id,
      createTime: v.createTime,
      title: v.title,
      videoDescription: v.videoDescription,
      duration: v.duration,
      coverImageUrl: v.coverImageUrl,
      shareUrl: v.shareUrl,
      embedLink: v.embedLink,
      localVideoId: v.localVideoId,
      localVideo: v.localVideo,
      viewCount,
      likeCount,
      commentCount,
      shareCount,
      viewDelta: prevSnap ? viewCount - prevViews : 0,
      likeDelta: prevSnap ? likeCount - prevLikes : 0,
      commentDelta: prevSnap ? commentCount - prevComments : 0,
      shareDelta: prevSnap ? shareCount - prevShares : 0,
      engagementRate,
      snapshots: v.snapshots.map((s) => ({
        recordedAt: s.recordedAt.toISOString(),
        viewCount: s.viewCount,
        likeCount: s.likeCount,
        commentCount: s.commentCount,
        shareCount: s.shareCount,
      })),
    };
  });

  const studioVideos = await prisma.video.findMany({
    select: {
      id: true,
      theme: true,
      status: true,
      videoUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const averageEngagementRate =
    processedVideos.length > 0
      ? Number((sumEngagementRates / processedVideos.length).toFixed(2))
      : 0;

  return {
    connected: isConnected,
    lastSyncAt: latestAccount?.recordedAt?.toISOString() || null,
    account: latestAccount
      ? {
          openId: latestAccount.openId,
          displayName: latestAccount.displayName,
          avatarUrl: latestAccount.avatarUrl,
          bioDescription: latestAccount.bioDescription,
          profileDeepLink: latestAccount.profileDeepLink,
          isVerified: latestAccount.isVerified,
          followerCount: latestAccount.followerCount,
          followingCount: latestAccount.followingCount,
          likesCount: latestAccount.likesCount,
          videoCount: latestAccount.videoCount,
          followerDelta: previousAccount
            ? latestAccount.followerCount - previousAccount.followerCount
            : 0,
          likesDelta: previousAccount
            ? latestAccount.likesCount - previousAccount.likesCount
            : 0,
          videoDelta: previousAccount
            ? latestAccount.videoCount - previousAccount.videoCount
            : 0,
          totalViews,
          totalViewsDelta: previousAccount ? totalViews - previousTotalViews : 0,
          averageEngagementRate,
        }
      : null,
    accountHistory: accountSnapshots.map((s) => ({
      recordedAt: s.recordedAt.toISOString(),
      followerCount: s.followerCount,
      likesCount: s.likesCount,
      videoCount: s.videoCount,
    })),
    videos: processedVideos,
    studioVideos: studioVideos.map((s) => ({
      id: s.id,
      theme: s.theme,
      status: s.status,
      videoUrl: s.videoUrl,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

/**
 * Vincula ou desvincula uma publicação do TikTok a um projeto de vídeo do Studio
 */
export async function linkTikTokVideoToStudio(
  tiktokVideoId: string,
  localVideoId: string | null
) {
  return prisma.tikTokVideo.update({
    where: { id: tiktokVideoId },
    data: { localVideoId },
    include: {
      localVideo: true,
    },
  });
}

/**
 * Ações de controle (video.manage): editar legenda / excluir postagem.
 * Estrutura preparada para receber a documentação e endpoint oficial da API do TikTok.
 */
export async function handleTikTokVideoManageAction(
  tiktokVideoId: string,
  action: 'edit' | 'delete',
  _payload?: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  // O escopo video.manage já foi solicitado no OAuth.
  // Assim que o endpoint oficial for disponibilizado no portal de desenvolvedores,
  // basta plugar a requisição POST/DELETE aqui.
  return {
    success: false,
    message: `Ação de "${action}" no vídeo ${tiktokVideoId} registrada! O endpoint de controle direto (video.manage) está preparado para integração assim que os parâmetros da chamada forem detalhados.`,
  };
}


