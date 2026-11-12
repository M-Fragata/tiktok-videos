import { Router } from 'express';
import {
  buildTikTokAuthorizeUrl,
  exchangeTikTokCode,
  fetchTikTokUserInfo,
  fetchTikTokVideoList,
  getTikTokDashboardData,
  getValidTikTokAccessToken,
  handleTikTokVideoManageAction,
  linkTikTokVideoToStudio,
  loadTokenData,
  syncTikTokData,
} from '../services/tiktok.service.ts';

export const tiktokRoutes = Router();

/**
 * GET /api/tiktok/login
 * Redireciona para o fluxo OAuth 2.0 + PKCE (Desktop) do TikTok.
 */
tiktokRoutes.get('/login', (_req, res) => {
  try {
    const authUrl = buildTikTokAuthorizeUrl();
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error ? err.message : 'Erro ao gerar URL OAuth TikTok',
    });
  }
});

/**
 * GET /api/tiktok/callback
 * Recebe code + state, troca por tokens, sincroniza dados no banco e redireciona ao Dashboard.
 */
tiktokRoutes.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  const frontendUrl =
    process.env.PUBLIC_BASE_URL?.replace(':3333', ':5173') ||
    'http://127.0.0.1:5173';

  if (error) {
    console.error('[TikTok Callback Error]:', error, error_description);
    res.redirect(
      `${frontendUrl}/dashboard?error=${encodeURIComponent(String(error_description || error))}`
    );
    return;
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    res.redirect(
      `${frontendUrl}/dashboard?error=${encodeURIComponent('Parâmetros de autorização inválidos.')}`
    );
    return;
  }

  try {
    await exchangeTikTokCode(code, state);
    // Realiza a primeira sincronização completa e gravação de snapshots no SQLite
    await syncTikTokData();
    res.redirect(`${frontendUrl}/dashboard?tiktok=connected`);
  } catch (err) {
    console.error('[TikTok Callback] Erro:', err);
    const msg =
      err instanceof Error ? err.message : 'Falha ao concluir autorização.';
    res.redirect(`${frontendUrl}/dashboard?error=${encodeURIComponent(msg)}`);
  }
});

/**
 * GET /api/tiktok/dashboard
 * Retorna os dados consolidados do painel: KPIs, histórico, vídeos e lista de projetos do Studio.
 */
tiktokRoutes.get('/dashboard', async (_req, res) => {
  try {
    const data = await getTikTokDashboardData();
    res.status(200).json(data);
  } catch (err) {
    console.error('[TikTok Dashboard] Erro:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao carregar dados do Dashboard',
    });
  }
});

/**
 * POST /api/tiktok/sync
 * Força a busca dos dados mais recentes na API do TikTok e salva um novo snapshot.
 */
tiktokRoutes.post('/sync', async (_req, res) => {
  try {
    const syncResult = await syncTikTokData();
    const dashboardData = await getTikTokDashboardData();
    res.status(200).json({
      message: 'Sincronização com o TikTok realizada com sucesso!',
      syncResult,
      ...dashboardData,
    });
  } catch (err) {
    console.error('[TikTok Sync] Erro:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao sincronizar dados com o TikTok',
    });
  }
});

/**
 * PATCH /api/tiktok/videos/:tiktokVideoId/link
 * Vincula ou desvincula uma publicação do TikTok a um projeto do Studio.
 */
tiktokRoutes.patch('/videos/:tiktokVideoId/link', async (req, res) => {
  const { tiktokVideoId } = req.params;
  const { localVideoId } = req.body as { localVideoId?: string | null };

  if (!tiktokVideoId) {
    res.status(400).json({ error: 'tiktokVideoId é obrigatório.' });
    return;
  }

  try {
    const updated = await linkTikTokVideoToStudio(
      tiktokVideoId,
      localVideoId || null
    );
    res.status(200).json({
      message: localVideoId
        ? 'Publicação vinculada ao projeto do Studio com sucesso!'
        : 'Vínculo removido com sucesso.',
      video: updated,
    });
  } catch (err) {
    console.error('[TikTok Link] Erro:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao vincular publicação ao projeto',
    });
  }
});

/**
 * POST /api/tiktok/videos/:tiktokVideoId/manage
 * Dispara ação de gerenciamento (video.manage: edit ou delete).
 */
tiktokRoutes.post('/videos/:tiktokVideoId/manage', async (req, res) => {
  const { tiktokVideoId } = req.params;
  const { action, payload } = req.body as {
    action: 'edit' | 'delete';
    payload?: Record<string, unknown>;
  };

  if (!tiktokVideoId || !action) {
    res.status(400).json({
      error: 'tiktokVideoId e action ("edit" | "delete") são obrigatórios.',
    });
    return;
  }

  try {
    const result = await handleTikTokVideoManageAction(
      tiktokVideoId,
      action,
      payload
    );
    res.status(200).json(result);
  } catch (err) {
    console.error('[TikTok Manage] Erro:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao executar ação de gerenciamento',
    });
  }
});

/**
 * GET /api/tiktok/stats (legado/retrocompatibilidade)
 */
tiktokRoutes.get('/stats', async (_req, res) => {
  try {
    const tokenData = loadTokenData();
    if (!tokenData) {
      res.status(401).json({
        connected: false,
        message:
          'Conta TikTok não conectada. Acesse /api/tiktok/login primeiro.',
      });
      return;
    }

    const accessToken = await getValidTikTokAccessToken();
    const [userInfo, videoList] = await Promise.all([
      fetchTikTokUserInfo(accessToken),
      fetchTikTokVideoList(accessToken, 20),
    ]);

    res.status(200).json({
      connected: true,
      userInfo,
      videoList,
    });
  } catch (err) {
    console.error('[TikTok Stats] Erro:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Erro ao consultar métricas TikTok',
    });
  }
});
