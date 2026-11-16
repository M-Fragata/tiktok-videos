import { Router } from 'express';

export const socialRoutes = Router();

/**
 * GET /api/social/status
 * Retorna o status de configuração e conectividade para YouTube, Instagram e Kwai.
 */
socialRoutes.get('/social/status', (_req, res) => {
  const youtubeConfigured = Boolean(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET
  );
  const instagramConfigured = Boolean(
    process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET
  );
  const kwaiConfigured = Boolean(
    process.env.KWAI_APP_ID && process.env.KWAI_APP_SECRET
  );

  return res.status(200).json({
    youtube: {
      platform: 'youtube',
      name: 'YouTube Shorts',
      configured: youtubeConfigured,
      connected: false,
      channelTitle: youtubeConfigured ? 'Billy, O Aventureiro!' : null,
      channelHandle: '@billyaventureiro',
      requiredEnv: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REDIRECT_URI'],
      portalUrl: 'https://console.cloud.google.com/apis/credentials',
      features: [
        'Publicação direta de YouTube Shorts em 1080x1920',
        'Métricas de visualizações, inscritos e tempo médio de exibição',
        'Sincronização de comentários e engajamento da comunidade',
      ],
    },
    instagram: {
      platform: 'instagram',
      name: 'Instagram Reels',
      configured: instagramConfigured,
      connected: false,
      channelTitle: instagramConfigured ? 'Billy, O Aventureiro!' : null,
      channelHandle: '@billy_aventureiro',
      requiredEnv: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET', 'INSTAGRAM_REDIRECT_URI'],
      portalUrl: 'https://developers.facebook.com/apps',
      features: [
        'Publicação automática de Reels na conta de criador/comercial',
        'Métricas de alcance, impressões e reproduções de Reels',
        'Controle de legendas e hashtags nativas de SEO',
      ],
    },
    kwai: {
      platform: 'kwai',
      name: 'Kwai',
      configured: kwaiConfigured,
      connected: false,
      channelTitle: kwaiConfigured ? 'Billy, O Aventureiro!' : null,
      channelHandle: '@billy_aventureiro',
      requiredEnv: ['KWAI_APP_ID', 'KWAI_APP_SECRET'],
      portalUrl: 'https://open.kwai.com',
      features: [
        'Distribuição no ecossistema Kwai Brasil',
        'Acompanhamento de fãs, visualizações e compartilhamentos',
        'Potencial de monetização via Kwai Creator Center',
      ],
    },
  });
});

/**
 * GET /api/youtube/login
 * Redireciona para o fluxo Google OAuth 2.0 ou retorna instruções caso faltem variáveis.
 */
socialRoutes.get('/youtube/login', (_req, res) => {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    'http://127.0.0.1:3333/api/youtube/callback';

  if (!clientId || !process.env.YOUTUBE_CLIENT_SECRET) {
    const frontendUrl =
      process.env.PUBLIC_BASE_URL?.replace(':3333', ':5173') ||
      'http://127.0.0.1:5173';
    return res.redirect(
      `${frontendUrl}/dashboard?tab=youtube&error=${encodeURIComponent(
        'Configure YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET no arquivo .env para conectar ao YouTube Shorts.'
      )}`
    );
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${encodeURIComponent(
    scopes
  )}&access_type=offline&prompt=consent`;

  return res.redirect(authUrl);
});

/**
 * GET /api/instagram/login
 * Redireciona para o fluxo Meta Graph API ou retorna instruções caso faltem variáveis.
 */
socialRoutes.get('/instagram/login', (_req, res) => {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ||
    'http://127.0.0.1:3333/api/instagram/callback';

  if (!clientId || !process.env.INSTAGRAM_CLIENT_SECRET) {
    const frontendUrl =
      process.env.PUBLIC_BASE_URL?.replace(':3333', ':5173') ||
      'http://127.0.0.1:5173';
    return res.redirect(
      `${frontendUrl}/dashboard?tab=instagram&error=${encodeURIComponent(
        'Configure INSTAGRAM_CLIENT_ID e INSTAGRAM_CLIENT_SECRET no arquivo .env para conectar ao Instagram Reels.'
      )}`
    );
  }

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_insights',
    'pages_show_list',
  ].join(',');

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&response_type=code`;

  return res.redirect(authUrl);
});

/**
 * GET /api/kwai/login
 * Retorna instruções ou redireciona para o Kwai Open Platform.
 */
socialRoutes.get('/kwai/login', (_req, res) => {
  const appId = process.env.KWAI_APP_ID;
  const redirectUri =
    process.env.KWAI_REDIRECT_URI ||
    'http://127.0.0.1:3333/api/kwai/callback';

  if (!appId || !process.env.KWAI_APP_SECRET) {
    const frontendUrl =
      process.env.PUBLIC_BASE_URL?.replace(':3333', ':5173') ||
      'http://127.0.0.1:5173';
    return res.redirect(
      `${frontendUrl}/dashboard?tab=kwai&error=${encodeURIComponent(
        'Configure KWAI_APP_ID e KWAI_APP_SECRET no arquivo .env para conectar ao Kwai.'
      )}`
    );
  }

  const authUrl = `https://open.kwai.com/oauth2/authorize?app_id=${encodeURIComponent(
    appId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=user_info,video_publish`;

  return res.redirect(authUrl);
});
