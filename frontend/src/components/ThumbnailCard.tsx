import React, { useRef, useState } from 'react';
import type { ThumbnailConfig, ThumbnailTextConfig } from '../remotion/types';

export interface ThumbnailCardProps {
  videoId: string;
  theme: string;
  thumbnailConfig?: ThumbnailConfig;
  onUpdateThumbnailConfig: (config: ThumbnailConfig) => void;
  resolveAssetSrc: (url: string) => string;
}

const AVAILABLE_FONTS = [
  { id: 'Komika Axis', label: 'Komika Axis (Estilo HQ / Padrão)', family: '"Komika Axis", Impact, sans-serif', weight: 'normal' },
  { id: 'The Bold Font', label: 'The Bold Font (Impactante)', family: '"The Bold Font", Impact, sans-serif', weight: 'bold' },
  { id: 'Impact', label: 'Impact (Clássico Memes / Shorts)', family: 'Impact, sans-serif', weight: 'normal' },
  { id: 'Montserrat', label: 'Montserrat 900 (Moderno)', family: '"Montserrat", sans-serif', weight: '900' },
  { id: 'Anton', label: 'Anton (Vertical Condensado)', family: '"Anton", sans-serif', weight: 'normal' },
  { id: 'Bebas Neue', label: 'Bebas Neue (Cinematográfico)', family: '"Bebas Neue", sans-serif', weight: 'normal' },
  { id: 'Russo One', label: 'Russo One (Gamer / Épico)', family: '"Russo One", sans-serif', weight: 'normal' },
  { id: 'Luckiest Guy', label: 'Luckiest Guy (Cartoon Divertido)', family: '"Luckiest Guy", cursive', weight: 'normal' },
];

const QUICK_COLORS = [
  { label: 'Amarelo Viral', color: '#FACC15' },
  { label: 'Branco Puro', color: '#FFFFFF' },
  { label: 'Vermelho Alerta', color: '#EF4444' },
  { label: 'Ciano Neon', color: '#06B6D4' },
  { label: 'Verde Lima', color: '#84CC16' },
  { label: 'Laranja Fogo', color: '#F97316' },
];

export const ThumbnailCard: React.FC<ThumbnailCardProps> = ({
  videoId,
  theme,
  thumbnailConfig,
  onUpdateThumbnailConfig,
  resolveAssetSrc,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);

  // Estados de recolhimento no padrão do projeto
  const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(() => {
    if (!videoId) return false;
    try {
      const saved = localStorage.getItem(`studio_thumb_card_collapsed_${videoId}`);
      if (saved !== null) return saved === 'true';
    } catch {
      /* ignore storage error */
    }
    return false;
  });

  const [isTextCollapsed, setIsTextCollapsed] = useState<boolean>(() => {
    if (!videoId) return true;
    try {
      const saved = localStorage.getItem(`studio_thumb_text_collapsed_${videoId}`);
      if (saved !== null) return saved === 'true';
    } catch {
      /* ignore storage error */
    }
    return true;
  });

  const toggleCardCollapse = () => {
    setIsCardCollapsed((prev) => {
      const next = !prev;
      if (videoId) {
        try {
          localStorage.setItem(`studio_thumb_card_collapsed_${videoId}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  const toggleTextCollapse = () => {
    setIsTextCollapsed((prev) => {
      const next = !prev;
      if (videoId) {
        try {
          localStorage.setItem(`studio_thumb_text_collapsed_${videoId}`, String(next));
        } catch {
          /* ignore storage error */
        }
      }
      return next;
    });
  };

  // Estados de ações
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Valores padrão seguros
  const currentPrompt = thumbnailConfig?.prompt || '';
  const currentCandidateImages = thumbnailConfig?.candidateImages || [];
  const currentSelectedImage = thumbnailConfig?.selectedImage || currentCandidateImages[0] || null;

  const defaultYByPosition =
    thumbnailConfig?.textConfig?.position === 'top'
      ? 22
      : thumbnailConfig?.textConfig?.position === 'bottom'
        ? 75
        : 50;

  const textConfig: ThumbnailTextConfig = {
    text: thumbnailConfig?.textConfig?.text ?? thumbnailConfig?.titleHook ?? theme ?? '',
    fontFamily: thumbnailConfig?.textConfig?.fontFamily || 'Komika Axis',
    fontSize: thumbnailConfig?.textConfig?.fontSize || 64,
    textColor: thumbnailConfig?.textConfig?.textColor || '#EF4444',
    strokeColor: thumbnailConfig?.textConfig?.strokeColor || '#000000',
    strokeWidth: thumbnailConfig?.textConfig?.strokeWidth ?? 12,
    position: thumbnailConfig?.textConfig?.position || 'center',
    xPercent: thumbnailConfig?.textConfig?.xPercent ?? 50,
    yPercent: thumbnailConfig?.textConfig?.yPercent ?? defaultYByPosition,
  };

  // Handlers para arrastar a frase dentro do preview da capa
  const handleTextPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingText(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleTextPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingText || !previewContainerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const clampedX = Math.round(Math.max(5, Math.min(95, rawX)));
    const clampedY = Math.round(Math.max(5, Math.min(95, rawY)));

    updateTextConfig({
      position: 'custom',
      xPercent: clampedX,
      yPercent: clampedY,
    });
  };

  const handleTextPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingText) {
      setIsDraggingText(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  // Atualiza campo do thumbnailConfig
  const updateConfig = (updates: Partial<ThumbnailConfig>) => {
    const updated: ThumbnailConfig = {
      ...thumbnailConfig,
      prompt: currentPrompt,
      titleHook: thumbnailConfig?.titleHook || textConfig.text,
      selectedImage: currentSelectedImage,
      candidateImages: currentCandidateImages,
      textConfig,
      ...updates,
    };
    onUpdateThumbnailConfig(updated);
  };

  const updateTextConfig = (updates: Partial<ThumbnailTextConfig>) => {
    const updatedTextConfig: ThumbnailTextConfig = {
      ...textConfig,
      ...updates,
    };
    updateConfig({
      textConfig: updatedTextConfig,
      titleHook: updatedTextConfig.text,
    });
  };

  // Gerar imagens de thumbnail com IA
  const handleGenerateThumbnailImages = async () => {
    if (!currentPrompt.trim()) {
      alert('Digite ou gere um prompt visual para a thumbnail.');
      return;
    }
    try {
      setIsGenerating(true);
      setSaveNotice(null);
      const res = await fetch(`/api/videos/${videoId}/generate-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.thumbnailConfig) {
        onUpdateThumbnailConfig(data.thumbnailConfig);
      } else if (Array.isArray(data.candidateImages)) {
        updateConfig({
          candidateImages: data.candidateImages,
          selectedImage: data.selectedImage || data.candidateImages[0],
        });
      }
      setSaveNotice('✨ Imagens da thumbnail geradas com sucesso!');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha ao gerar imagens de thumbnail: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload manual de imagem do computador
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setSaveNotice(null);

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const res = await fetch(`/api/videos/${videoId}/upload-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          fileName: file.name,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.thumbnailConfig) {
        onUpdateThumbnailConfig(data.thumbnailConfig);
      } else if (data.imageUrl) {
        const newCandidates = [data.imageUrl, ...currentCandidateImages].slice(0, 4);
        updateConfig({
          candidateImages: newCandidates,
          selectedImage: data.imageUrl,
        });
      }

      setSaveNotice('📁 Imagem personalizada adicionada à capa!');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha ao enviar imagem da thumbnail: ${msg}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Salvar configurações no backend
  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      setSaveNotice(null);
      const payload: ThumbnailConfig = {
        prompt: currentPrompt,
        titleHook: textConfig.text,
        selectedImage: currentSelectedImage,
        candidateImages: currentCandidateImages,
        textConfig,
      };

      const res = await fetch(`/api/videos/${videoId}/thumbnail-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      setSaveNotice('💾 Capa e configurações salvas com sucesso!');
      setTimeout(() => setSaveNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha ao salvar capa: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Download composto em 1080x1920 via HTML5 Canvas
  const handleDownloadThumbnail = async () => {
    if (!currentSelectedImage) {
      alert('Selecione ou gere uma imagem para a thumbnail antes de baixar.');
      return;
    }

    try {
      setIsDownloading(true);
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível inicializar o canvas 2D.');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      const imageLoaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Erro ao carregar a imagem para renderizar a thumbnail.'));
      });
      img.src = resolveAssetSrc(currentSelectedImage);
      await imageLoaded;

      const imgRatio = img.width / img.height;
      const targetRatio = 1080 / 1920;
      let sWidth = img.width;
      let sHeight = img.height;
      let sx = 0;
      let sy = 0;

      if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 1080, 1920);

      const overlayText = textConfig.text?.trim() || '';
      if (overlayText) {
        const scaleFactor = 1080 / 360;
        const canvasFontSize = Math.round((textConfig.fontSize || 64) * scaleFactor);
        const activeFont = AVAILABLE_FONTS.find((f) => f.id === textConfig.fontFamily);
        const fontFamily = activeFont ? activeFont.id : (textConfig.fontFamily || 'Komika Axis');
        const fontFaceWeight = activeFont?.weight || 'normal';

        // Garante que a fonte webfont esteja totalmente carregada na memória do canvas
        try {
          await document.fonts.load(`${fontFaceWeight} ${canvasFontSize}px "${fontFamily}"`);
          await document.fonts.load(`bold ${canvasFontSize}px "${fontFamily}"`);
          await document.fonts.load(`900 ${canvasFontSize}px "${fontFamily}"`);
          await document.fonts.ready;
        } catch {
          /* fallback gracioso para fontes do sistema */
        }

        ctx.font = `${fontFaceWeight} ${canvasFontSize}px "${fontFamily}", Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const effectiveXPercent = textConfig.xPercent ?? 50;
        const effectiveYPercent =
          textConfig.yPercent ??
          (textConfig.position === 'top'
            ? 22
            : textConfig.position === 'bottom'
              ? 75
              : 50);

        const targetX = 1080 * (effectiveXPercent / 100);
        const targetY = 1920 * (effectiveYPercent / 100);

        // Linhas definidas pelo usuário (mantendo quebras manuais de linha via Enter)
        const rawLines = overlayText.split('\n').map((l) => l.trim());
        const lines = rawLines.length > 0 ? rawLines : [overlayText];

        const lineHeight = canvasFontSize * 1.18;
        const totalHeight = lines.length * lineHeight;
        let startY = targetY - totalHeight / 2 + lineHeight / 2;

        const strokeWidth = Math.round((textConfig.strokeWidth ?? 12) * scaleFactor);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = textConfig.strokeColor || '#000000';
        ctx.lineWidth = strokeWidth;
        ctx.fillStyle = textConfig.textColor || '#EF4444';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;

        for (const line of lines) {
          if (line.length > 0) {
            if (strokeWidth > 0) {
              ctx.strokeText(line, targetX, startY);
            }
            ctx.fillText(line, targetX, startY);
          }
          startY += lineHeight;
        }
      }

      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Falha ao gerar arquivo da thumbnail.');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `thumbnail-${videoId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Falha ao exportar thumbnail: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-[#202024]/60 p-4 shadow-xl backdrop-blur relative overflow-hidden mb-4 hover:border-amber-500/50 transition-all">
      {/* ─── CABEÇALHO DO CARD (CLIQUE PARA RECOLHER/EXPANDIR) ─── */}
      <div
        onClick={toggleCardCollapse}
        className="flex cursor-pointer items-center justify-between gap-2 select-none"
      >
        <div className="flex items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 hover:text-amber-400 transition">
                Cena #0 - Capa
              </h3>
              
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Crie uma capa atrativa com visual dramático e impactante.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveNotice && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg animate-fadeIn">
              {saveNotice}
            </span>
          )}
          <span className="text-xs text-slate-400 transition-transform">
            {isCardCollapsed ? '⌄' : '⌃'}
          </span>
        </div>
      </div>

      {/* ─── CORPO DO CARD (EM COLUNA VERTICAL) ─── */}
      {!isCardCollapsed && (
        <div className="mt-4 space-y-4 pt-3 border-t border-white/[0.06]">
          {/* 1. SEÇÃO PROMPT VISUAL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Prompt visual
              </label>
              <button
                type="button"
                disabled={isGenerating || !currentPrompt.trim()}
                onClick={handleGenerateThumbnailImages}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 disabled:opacity-40 transition"
              >
                {isGenerating ? (
                  <>
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amber-300 border-t-transparent" />
                    <span>Gerando IA...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Gerar com IA</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={currentPrompt}
              onChange={(e) => updateConfig({ prompt: e.target.value })}
              placeholder="Descreva a composição da capa: Billy em 2D stickman com expressão dramática em ambiente histórico 3D..."
              className="w-full rounded-lg border border-[#2c2c32]/80 bg-[#121214] px-3 py-2 text-xs text-slate-300 leading-relaxed focus:border-amber-500 focus:outline-none transition"
            />
          </div>

          {/* 2. SEÇÃO IMAGENS (SLOTS APENAS QUANDO EXISTIREM IMAGENS) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">Imagens</label>
              {currentCandidateImages.length > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentCandidateImages.length} disponível(is) • Clique para selecionar a capa
                </span>
              )}
            </div>

            {/* Grid dinâmico: Renderiza SOMENTE quando houver imagens adicionadas/geradas */}
            {currentCandidateImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                {currentCandidateImages.map((imgUrl, optIdx) => {
                  const isSelected = currentSelectedImage === imgUrl;
                  return (
                    <div
                      key={`thumb-opt-${optIdx}-${imgUrl}`}
                      onClick={() => updateConfig({ selectedImage: imgUrl })}
                      className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-emerald-400 ring-2 ring-emerald-400/25 shadow-lg shadow-emerald-500/10 scale-[1.01]'
                          : 'border-[#2c2c32]/80 opacity-80 hover:border-white/25 hover:opacity-100'
                      }`}
                    >
                      <div className="aspect-[9/16] max-h-48 w-full bg-[#121214]">
                        <img
                          src={resolveAssetSrc(imgUrl)}
                          alt={`Capa Opção ${optIdx + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>

                      {/* Badge de Selecionado */}
                      {isSelected && (
                        <span className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-950 shadow">
                          <span>✓</span>
                          <span>Capa Ativa</span>
                        </span>
                      )}

                      {/* Botão Superior Direito: Ampliar / Zoom */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewModalUrl(resolveAssetSrc(imgUrl));
                        }}
                        title="Ampliar thumbnail"
                        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/75 text-slate-100 opacity-0 shadow-md backdrop-blur-xs transition-all duration-150 group-hover:opacity-100 hover:scale-105 hover:border-amber-400/60 hover:bg-black/90 hover:text-amber-300"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4h-4"
                          />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botões de Ação de Imagem: Adicionar Manual (Esquerda) e Gerar IA (Direita) */}
            <div className="grid grid-cols-2 gap-2.5">
              <label
                htmlFor={`upload-thumbnail-input-${videoId}`}
                className={`flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#222228] py-2.5 px-3 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-[#2c2c34] active:scale-[0.99] cursor-pointer ${
                  isUploading ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>📁</span>
                    <span>Adicionar Imagem</span>
                  </>
                )}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                id={`upload-thumbnail-input-${videoId}`}
                accept="image/*"
                disabled={isUploading}
                className="hidden"
                onChange={handleUploadImage}
              />

              <button
                type="button"
                onClick={handleGenerateThumbnailImages}
                disabled={isGenerating || !currentPrompt.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 hover:border-amber-500/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    <span>Gerando IA...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Gerar IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3. SEÇÃO TEXTO & TIPOGRAFIA DA CAPA (CARD EXPANSÍVEL NO PADRÃO DO PROJETO) */}
          <div className="rounded-xl border border-white/[0.06] bg-[#141418] p-3.5 transition">
            {/* Cabeçalho da Seção de Texto (Clique em qualquer parte para recolher/expandir) */}
            <div
              onClick={toggleTextCollapse}
              className="flex cursor-pointer items-center justify-between gap-2 select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  Texto & Tipografia
                </span>
              </div>
              <span className="text-xs text-slate-400 transition-transform">
                {isTextCollapsed ? '⌄' : '⌃'}
              </span>
            </div>

            {/* Conteúdo Expansível da Tipografia */}
            {!isTextCollapsed && (
              <div className="mt-3.5 space-y-3.5 pt-3 border-t border-white/[0.06]">
                {/* Campo de Texto da Capa (Hook) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-400">
                      Texto de Impacto
                    </label>
                    <span className="text-[10px] text-amber-400/80 font-medium">
                      Pressione Enter para quebrar linhas manualmente ↵
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={textConfig.text || ''}
                    onChange={(e) => updateTextConfig({ text: e.target.value })}
                    placeholder="Ex: 24 HORAS&#10;NO NAVIO PIRATA! 🏴‍☠️"
                    className="w-full rounded-lg border border-[#2c2c32] bg-[#101012] px-3 py-2 text-xs text-white uppercase focus:border-amber-500 focus:outline-none transition resize-y font-semibold leading-relaxed"
                  />
                </div>

                {/* Grid: Fonte & Posição Vertical */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                      Fonte
                    </label>
                    <select
                      value={textConfig.fontFamily}
                      onChange={(e) => updateTextConfig({ fontFamily: e.target.value })}
                      className="w-full rounded-lg border border-[#2c2c32] bg-[#101012] px-2.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      {AVAILABLE_FONTS.map((f) => (
                        <option
                          key={f.id}
                          value={f.id}
                          style={{ fontFamily: f.family }}
                        >
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold">Posição do Texto</span>
                      <span className="text-[10px] text-amber-400/90 font-mono">
                        {textConfig.position === 'custom'
                          ? `Livre (${textConfig.xPercent}%, ${textConfig.yPercent}%)`
                          : textConfig.position === 'top'
                            ? 'Topo (22%)'
                            : textConfig.position === 'bottom'
                              ? 'Base (75%)'
                              : 'Centro (50%)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 bg-[#101012] p-1 rounded-lg border border-[#2c2c32]">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => {
                            const yMap = { top: 22, center: 50, bottom: 75 };
                            updateTextConfig({
                              position: pos,
                              xPercent: 50,
                              yPercent: yMap[pos],
                            });
                          }}
                          className={`rounded py-1 text-[11px] font-bold transition ${
                            textConfig.position === pos
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {pos === 'top' ? 'Topo' : pos === 'center' ? 'Centro' : 'Base'}
                        </button>
                      ))}
                      <div
                        className={`rounded py-1 text-[10px] font-semibold text-center flex items-center justify-center transition select-none ${
                          textConfig.position === 'custom'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : 'text-slate-500'
                        }`}
                        title="Arraste a frase diretamente sobre o preview abaixo para reposicionar livremente"
                      >
                        {textConfig.position === 'custom' ? 'Livre ✥' : 'Arrastar ✥'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slider de Tamanho da Fonte */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-semibold">Tamanho da Fonte</span>
                    <span className="font-mono text-amber-400">{textConfig.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={28}
                    max={96}
                    step={2}
                    value={textConfig.fontSize}
                    onChange={(e) => updateTextConfig({ fontSize: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#2c2c32] rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Paleta de Cores do Texto & Contorno */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold">Cor do Texto</span>
                      <span className="font-mono text-xs" style={{ color: textConfig.textColor }}>
                        {textConfig.textColor}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {QUICK_COLORS.map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => updateTextConfig({ textColor: c.color })}
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                          className={`h-5 w-5 rounded-full border border-black/40 transition-transform ${
                            textConfig.textColor === c.color ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                          }`}
                        />
                      ))}
                      <input
                        type="color"
                        value={textConfig.textColor}
                        onChange={(e) => updateTextConfig({ textColor: e.target.value })}
                        className="h-6 w-6 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold">Espessura do Contorno</span>
                      <span className="font-mono text-amber-400">{textConfig.strokeWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={textConfig.strokeWidth}
                      onChange={(e) => updateTextConfig({ strokeWidth: Number(e.target.value) })}
                      className="w-full h-1.5 bg-[#2c2c32] rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>

                {/* Preview Miniatura em Tempo Real com Texto Sobreposto Arrastável */}
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <span className="font-semibold">Preview da Capa (Interativo)</span>
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <span>✥</span>
                      <span>Clique e arraste a frase para mover</span>
                    </span>
                  </div>

                  <div
                    ref={previewContainerRef}
                    className="relative aspect-[9/16] w-full max-w-[340px] sm:max-w-[380px] mx-auto overflow-hidden rounded-xl border border-[#2c2c32] bg-[#101012] shadow-2xl flex items-center justify-center select-none"
                    style={{ containerType: 'inline-size' }}
                  >
                    {currentSelectedImage ? (
                      <>
                        <img
                          src={resolveAssetSrc(currentSelectedImage)}
                          alt="Capa Selecionada"
                          draggable={false}
                          className="h-full w-full object-cover pointer-events-none select-none"
                        />
                        {textConfig.text && (
                          <div
                            onPointerDown={handleTextPointerDown}
                            onPointerMove={handleTextPointerMove}
                            onPointerUp={handleTextPointerUp}
                            onPointerCancel={handleTextPointerUp}
                            className={`absolute z-20 px-2 py-1 rounded-lg transition-shadow duration-75 text-center select-none ${
                              isDraggingText
                                ? 'cursor-grabbing ring-2 ring-amber-400 bg-black/50 shadow-2xl scale-[1.02]'
                                : 'cursor-grab hover:ring-1 hover:ring-amber-400/80 hover:bg-black/30'
                            }`}
                            style={{
                              left: `${textConfig.xPercent ?? 50}%`,
                              top: `${
                                textConfig.yPercent ??
                                (textConfig.position === 'top'
                                  ? 22
                                  : textConfig.position === 'bottom'
                                    ? 75
                                    : 50)
                              }%`,
                              transform: 'translate(-50%, -50%)',
                              width: 'max-content',
                              maxWidth: 'none',
                              touchAction: 'none',
                            }}
                            title="Clique e arraste para posicionar a frase livremente na capa"
                          >
                            <p
                              style={{
                                fontFamily:
                                  AVAILABLE_FONTS.find((f) => f.id === textConfig.fontFamily)?.family ||
                                  `"${textConfig.fontFamily}", Impact, sans-serif`,
                                fontSize: `calc(${textConfig.fontSize || 64} / 360 * 100cqw)`,
                                color: textConfig.textColor,
                                WebkitTextStroke: `calc(${textConfig.strokeWidth ?? 12} / 360 * 100cqw) ${textConfig.strokeColor}`,
                                paintOrder: 'stroke fill',
                                textShadow: '0 calc(4 / 360 * 100cqw) calc(14 / 360 * 100cqw) rgba(0,0,0,0.95)',
                                lineHeight: 1.18,
                                fontWeight: 900,
                                textTransform: 'uppercase',
                                textAlign: 'center',
                                pointerEvents: 'none',
                              }}
                            >
                              {(textConfig.text || '').split('\n').map((line, idx) => (
                                <span key={idx} style={{ display: 'block', whiteSpace: 'nowrap' }}>
                                  {line}
                                </span>
                              ))}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Nenhuma imagem selecionada
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. BARRA DE AÇÃO INFERIOR: SALVAR CAPA E BAIXAR 1080x1920 */}
          <div className="pt-2 border-t border-white/[0.06] flex items-center gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveConfig}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <span>💾</span>
                  <span>Salvar Capa</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isDownloading || !currentSelectedImage}
              onClick={handleDownloadThumbnail}
              className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 px-3 text-xs font-bold text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isDownloading ? (
                <span>Gerando PNG...</span>
              ) : (
                <>
                  <span>📥</span>
                  <span>Baixar (1080x1920)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal de Zoom da Thumbnail */}
      {previewModalUrl && (
        <div
          onClick={() => setPreviewModalUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
          >
            <img
              src={previewModalUrl}
              alt="Ampliação da Thumbnail"
              className="h-auto max-h-[82vh] w-auto rounded-xl object-contain mx-auto"
            />
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-white hover:bg-rose-600 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
