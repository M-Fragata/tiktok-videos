import React, { useState } from 'react';

export interface StudioVideoItem {
  id: string;
  theme: string;
  status: string;
  videoUrl: string | null;
  createdAt: string;
}

export type SupportedSocialPlatform = 'youtube' | 'instagram' | 'kwai';

interface PlatformPreset {
  name: string;
  badgeName: string;
  handle: string;
  channelTitle: string;
  brandColor: string;
  gradientHero: string;
  borderHero: string;
  buttonBg: string;
  portalName: string;
  portalUrl: string;
  envSnippet: string;
  metrics: {
    label: string;
    value: string;
    subtext: string;
    badge: string;
  }[];
  steps: string[];
  capabilities: string[];
}

const PLATFORM_PRESETS: Record<SupportedSocialPlatform, PlatformPreset> = {
  youtube: {
    name: 'YouTube Shorts',
    badgeName: 'Google Cloud OAuth',
    handle: '@billyaventureiro',
    channelTitle: 'Billy, O Aventureiro!',
    brandColor: '#ef4444',
    gradientHero: 'from-red-950/40 via-slate-900/60 to-slate-950',
    borderHero: 'border-red-900/40',
    buttonBg: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/25',
    portalName: 'Google Cloud Console',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    envSnippet: `# YouTube Shorts (Google Cloud OAuth 2.0)
YOUTUBE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-seu_client_secret
YOUTUBE_REDIRECT_URI=http://127.0.0.1:3333/api/youtube/callback`,
    metrics: [
      {
        label: 'Inscritos no Canal',
        value: '--',
        subtext: 'Base de inscritos do Billy',
        badge: 'Shorts Audience',
      },
      {
        label: 'Visualizações de Shorts',
        value: '--',
        subtext: 'Exibições no Feed nos últimos 28d',
        badge: 'Alcance Orgânico',
      },
      {
        label: 'Retenção Média',
        value: '--',
        subtext: 'Tempo médio assistido por vídeo',
        badge: 'Qualidade do Roteiro',
      },
      {
        label: 'Curtidas e Engajamento',
        value: '--',
        subtext: 'Reações positivas acumuladas',
        badge: 'Interação da Comunidade',
      },
    ],
    steps: [
      'Acesse o Google Cloud Console e crie ou selecione o projeto do canal do Billy.',
      'Na seção "APIs e Serviços > Biblioteca", pesquise e ative a "YouTube Data API v3".',
      'Em "Credenciais", crie um ID do cliente OAuth 2.0 (Aplicativo da Web) com o URI de redirecionamento configurado.',
      'Copie o Client ID e Client Secret para o seu arquivo .env e reinicie o backend.',
    ],
    capabilities: [
      'Publicação automática de vídeos 9:16 direto no feed do YouTube Shorts',
      'Sincronização de estatísticas com cota gratuita de 10.000 unidades/dia',
      'Inserção automática de título SEO, descrição e hashtags estratégicas',
      'Monitoramento de inscritos ganhos a partir de cada Short publicado',
    ],
  },
  instagram: {
    name: 'Instagram Reels',
    badgeName: 'Meta Graph API',
    handle: '@billy_aventureiro',
    channelTitle: 'Billy, O Aventureiro!',
    brandColor: '#ec4899',
    gradientHero: 'from-pink-950/40 via-purple-950/30 to-slate-950',
    borderHero: 'border-pink-900/40',
    buttonBg: 'bg-gradient-to-r from-pink-600 via-purple-600 to-amber-500 hover:opacity-95 text-white shadow-lg shadow-pink-500/25',
    portalName: 'Meta for Developers',
    portalUrl: 'https://developers.facebook.com/apps',
    envSnippet: `# Instagram Reels (Meta Graph API)
INSTAGRAM_CLIENT_ID=seu_meta_app_id
INSTAGRAM_CLIENT_SECRET=seu_meta_app_secret
INSTAGRAM_REDIRECT_URI=http://127.0.0.1:3333/api/instagram/callback`,
    metrics: [
      {
        label: 'Seguidores no Instagram',
        value: '--',
        subtext: 'Audiência do perfil oficial do Billy',
        badge: 'Comunidade Reels',
      },
      {
        label: 'Alcance de Reels',
        value: '--',
        subtext: 'Contas únicas alcançadas pelo algoritmo',
        badge: 'Descoberta Orgânica',
      },
      {
        label: 'Reproduções Totais',
        value: '--',
        subtext: 'Plays no feed e na aba dedicada Reels',
        badge: 'Visualizações',
      },
      {
        label: 'Taxa de Engajamento',
        value: '--',
        subtext: 'Curtidas, comentários e salvamentos',
        badge: 'Conversão',
      },
    ],
    steps: [
      'Garanta que a conta @billy_aventureiro seja do tipo Profissional (Criador de Conteúdo).',
      'Vincule a conta do Instagram a uma Página correspondente no Facebook.',
      'No portal Meta for Developers, crie um aplicativo com caso de uso "Instagram Graph API".',
      'Adicione as permissões instagram_content_publish e instagram_manage_insights e salve as chaves no .env.',
    ],
    capabilities: [
      'Upload direto em 1080x1920 com geração automática de capas atrativas',
      'Leitura de insights oficiais: impressões, compartilhamentos e salvamentos',
      'Sincronização com as hashtags geradas pelo Roteirista de IA',
      'Distribuição multiplataforma coordenada em menos de 1 minuto',
    ],
  },
  kwai: {
    name: 'Kwai',
    badgeName: 'Kwai Open Platform',
    handle: '@billy_aventureiro',
    channelTitle: 'Billy, O Aventureiro!',
    brandColor: '#f97316',
    gradientHero: 'from-orange-950/40 via-amber-950/30 to-slate-950',
    borderHero: 'border-orange-900/40',
    buttonBg: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 shadow-lg shadow-orange-500/25 font-bold',
    portalName: 'Kwai Open Platform',
    portalUrl: 'https://open.kwai.com',
    envSnippet: `# Kwai (Open API)
KWAI_APP_ID=seu_kwai_app_id
KWAI_APP_SECRET=seu_kwai_app_secret
KWAI_REDIRECT_URI=http://127.0.0.1:3333/api/kwai/callback`,
    metrics: [
      {
        label: 'Fãs (Seguidores)',
        value: '--',
        subtext: 'Base conectada no ecossistema Kwai',
        badge: 'Kwai Fanbase',
      },
      {
        label: 'Visualizações Totais',
        value: '--',
        subtext: 'Distribuição na aba Para Você do Kwai',
        badge: 'Viralidade',
      },
      {
        label: 'Compartilhamentos',
        value: '--',
        subtext: 'Disseminação em grupos e mensageiros',
        badge: 'Multiplicação',
      },
      {
        label: 'Curtidas Acumuladas',
        value: '--',
        subtext: 'Reações calorosas da audiência Kwai',
        badge: 'Aprovação',
      },
    ],
    steps: [
      'Acesse o portal de desenvolvedores Kwai Open Platform ou o Kwai Creator Center.',
      'Cadastre a conta @billy_aventureiro para adesão ao programa de criadores/Open API.',
      'Solicite a credencial de integração para publicação de vídeos (Video Publish API).',
      'Adicione o App ID e App Secret ao seu arquivo .env e vincule a conta.',
    ],
    capabilities: [
      'Expansão massiva no público de entretenimento rápido no Brasil',
      'Algoritmo receptivo a animações de stickman bem-humoradas e storytelling dinâmico',
      'Painel unificado com acompanhamento de plays e engajamento',
      'Publicação unificada em lote a partir do Fragata Shorts',
    ],
  },
};

interface MultiPlatformViewProps {
  platform: SupportedSocialPlatform;
  studioVideos: StudioVideoItem[];
  onNavigateStudio: () => void;
  onCopyEnv: (text: string) => void;
}

export const MultiPlatformView: React.FC<MultiPlatformViewProps> = ({
  platform,
  studioVideos,
  onNavigateStudio,
  onCopyEnv,
}) => {
  const preset = PLATFORM_PRESETS[platform];
  const [copied, setCopied] = useState(false);
  const [crossPostNotice, setCrossPostNotice] = useState<string | null>(null);

  const handleConnect = () => {
    window.location.href = `/api/${platform}/login`;
  };

  const handleCopySnippet = () => {
    onCopyEnv(preset.envSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const renderedVideos = studioVideos.filter((v) => v.status === 'RENDERED');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ─── 1. HERO BANNER DO CANAL ─── */}
      <section
        className={`rounded-2xl border ${preset.borderHero} bg-gradient-to-b ${preset.gradientHero} p-6 shadow-xl backdrop-blur relative overflow-hidden`}
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Ícone da Plataforma */}
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-700/80 shadow-inner">
                {platform === 'youtube' && (
                  <svg className="w-10 h-10 fill-current text-red-500" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                )}
                {platform === 'instagram' && (
                  <svg className="w-10 h-10 fill-current text-pink-400" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
                  </svg>
                )}
                {platform === 'kwai' && (
                  <svg className="w-10 h-10 fill-current text-orange-400" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                OFF
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {preset.channelTitle}
                </h2>
                <span className="inline-flex items-center rounded-md bg-slate-800/90 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700">
                  {preset.handle}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Desconectado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Conecte o canal do Billy para publicar automaticamente em{' '}
                <strong className="text-slate-200">{preset.name}</strong> e sincronizar métricas
                oficiais de audiência.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleConnect}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold transition flex items-center gap-2 ${preset.buttonBg}`}
            >
              <span>🔗 Conectar {preset.name}</span>
            </button>
            <a
              href={preset.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5"
            >
              <span>{preset.portalName}</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── 2. CARDS DE MÉTRICAS / KPIS PREVIEW ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Métricas de Desempenho ({preset.name})
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Aguardando autenticação da API
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {preset.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-lg backdrop-blur flex flex-col justify-between hover:border-slate-700/60 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{metric.label}</span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
                  {metric.badge}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-slate-200 tracking-tight font-mono">
                  {metric.value}
                </span>
                <span className="text-xs text-slate-500 font-mono">acumulado</span>
              </div>
              <p className="text-[11px] text-slate-500">{metric.subtext}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 3. VÍDEOS PRONTOS DO STUDIO PARA PUBLICAÇÃO CRUZADA ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Vídeos Renderizados no Studio</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-cyan-400 border border-slate-700">
                {renderedVideos.length} prontos
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Envie suas produções concluídas diretamente para este canal com 1 clique.
            </p>
          </div>
          <button
            onClick={onNavigateStudio}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Abrir Studio de Criação 🎬
          </button>
        </div>

        {crossPostNotice && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-300 flex items-center justify-between animate-fadeIn">
            <span>{crossPostNotice}</span>
            <button
              onClick={() => setCrossPostNotice(null)}
              className="text-amber-400 hover:text-white ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {renderedVideos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
            <p className="text-xs text-slate-400 mb-3">
              Nenhum vídeo renderizado encontrado no Studio ainda.
            </p>
            <button
              onClick={onNavigateStudio}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
            >
              Criar Primeiro Episódio no Studio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderedVideos.map((video) => (
              <div
                key={video.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex items-center justify-between gap-4 hover:border-slate-700/80 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                      RENDERED
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 truncate">
                      {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate" title={video.theme}>
                    {video.theme}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                    ID: {video.id}
                  </p>
                </div>

                <button
                  onClick={() =>
                    setCrossPostNotice(
                      `Para publicar no ${preset.name}, conecte a conta utilizando as variáveis de ambiente abaixo.`
                    )
                  }
                  className={`flex-shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${preset.buttonBg}`}
                >
                  Publicar no {preset.name.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── 4. GUIA DE INTEGRAÇÃO & CONFIGURAÇÃO .ENV ─── */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Guia de Integração e Chaves de API</span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono text-amber-400 border border-slate-700">
                Setup Rápido
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Siga os passos abaixo para liberar a postagem direta e métricas automáticas.
            </p>
          </div>

          <button
            onClick={handleCopySnippet}
            className="self-start sm:self-auto rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition flex items-center gap-2"
          >
            <span>{copied ? '✓ Copiado!' : '📋 Copiar Variáveis .env'}</span>
          </button>
        </div>

        {/* Passos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Passo a Passo
            </h4>
            <ol className="space-y-2 text-xs text-slate-300">
              {preset.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-amber-400 font-bold text-[11px] border border-slate-700">
                    {idx + 1}
                  </span>
                  <span className="mt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recursos Liberados Após a Conexão
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              {preset.capabilities.map((cap, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 text-emerald-400">✓</span>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Snippet .env */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Variáveis necessárias no backend/.env</span>
            <span className="text-[11px] text-slate-500">Clique para copiar</span>
          </div>
          <pre
            onClick={handleCopySnippet}
            className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs text-cyan-300 overflow-x-auto cursor-pointer hover:border-slate-700 transition"
          >
            {preset.envSnippet}
          </pre>
        </div>
      </section>
    </div>
  );
};
