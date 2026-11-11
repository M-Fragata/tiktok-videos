import React, { useMemo, useState } from 'react';
import { AvatarStage } from './AvatarStage.tsx';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarAccessory,
  AvatarConfig,
  AvatarHairStyle,
  AvatarNeckAccessory,
  BGM_VIBE_OPTIONS,
  BgmVibe,
  BRIEFING_BGM_OPTIONS,
  BriefingBgmOption,
  buildClientAvatarPromptDescriptor,
  DurationPreset,
  IdeationOption,
  injectAvatarConfigIntoPrompt,
  SFX_OPTIONS,
  SpeakerType,
  StoryboardScene,
} from '../remotion/types';

export interface SelectedFinalSceneItem {
  uid: string;
  sourceOptionId: string;
  sourceOptionBadge: string;
  sourceSceneIndex: number;
  scene: StoryboardScene;
}

interface IdeationDressingRoomTabProps {
  videoId?: string;
  theme: string;
  setTheme: (value: string) => void;
  suggestedThemes: string[];
  durationPreset: DurationPreset;
  setDurationPreset: (value: DurationPreset) => void;
  durationOptions: Array<{ value: DurationPreset; label: string }>;
  bgmVibe: BriefingBgmOption;
  setBgmVibe: (value: BriefingBgmOption) => void;
  avatarConfig: AvatarConfig;
  setAvatarConfig: React.Dispatch<React.SetStateAction<AvatarConfig>>;
  ideationOptions: IdeationOption[];
  isGeneratingIdeas: boolean;
  onGenerateIdeas: (e: React.FormEvent) => void;
  finalMixScenes: SelectedFinalSceneItem[];
  setFinalMixScenes: React.Dispatch<
    React.SetStateAction<SelectedFinalSceneItem[]>
  >;
  isApprovingScript: boolean;
  onApproveFinalScript: (approvedTitle?: string) => void;
}

const HAIR_STYLE_OPTIONS: Array<{ value: AvatarHairStyle; label: string }> = [
  { value: 'spiky', label: 'Espetado' },
  { value: 'bald', label: 'Careca' },
  { value: 'curly', label: 'Cacheado' },
  { value: 'mohawk', label: 'Moicano' },
  { value: 'pompadour', label: 'Topete' },
];

const ACCESSORY_OPTIONS: Array<{ value: AvatarAccessory; label: string }> = [
  { value: 'forehead_goggles', label: '🥽 Goggles na Testa' },
  { value: 'round_glasses', label: '👓 Óculos Redondos' },
  { value: 'explorer_hat', label: '🤠 Chapéu Explorador' },
  { value: 'knight_helmet', label: '🛡️ Elmo Medieval' },
  { value: 'crown', label: '👑 Coroa Real' },
  { value: 'bandana', label: '🎗️ Bandana na Testa' },
  { value: 'none', label: 'Sem Acessório' },
];

const NECK_ACCESSORY_OPTIONS: Array<{
  value: AvatarNeckAccessory;
  label: string;
}> = [
  { value: 'red_bandana', label: '🧣 Bandana Vermelha' },
  { value: 'none', label: 'Sem Bandana' },
];

const STROKE_SWATCHES = [
  { color: '#111827', label: 'Nanquim Clássico' },
  { color: '#f59e0b', label: 'Âmbar Solar' },
  { color: '#14b8a6', label: 'Teal Temporal' },
  { color: '#38bdf8', label: 'Ciano Neon' },
  { color: '#a855f7', label: 'Púrpura Épico' },
  { color: '#f43f5e', label: 'Rubi Intenso' },
];

const SPEAKER_SHORT_LABELS: Record<SpeakerType, string> = {
  protagonist: '🧑 Protagonista',
  character: '🎭 Personagem',
  narrator: '🎙️ Narrador',
};

export const IdeationDressingRoomTab: React.FC<
  IdeationDressingRoomTabProps
> = ({
  videoId,
  theme,
  setTheme,
  suggestedThemes: _suggestedThemes,
  durationPreset,
  setDurationPreset,
  durationOptions,
  bgmVibe,
  setBgmVibe,
  avatarConfig,
  setAvatarConfig,
  ideationOptions,
  isGeneratingIdeas,
  onGenerateIdeas,
  finalMixScenes,
  setFinalMixScenes,
  isApprovingScript,
  onApproveFinalScript,
}) => {
  // Controlo de abertura dos 4 Accordions de Ideação + 5º Accordion do Roteiro Final
  const [isAvatarOpen, setIsAvatarOpen] = useState<boolean>(true);
  const [openOptionIds, setOpenOptionIds] = useState<Record<string, boolean>>({
    humor: true,
    action: false,
    dark: false,
    chaotic: false,
  });
  const [isFinalScriptOpen, setIsFinalScriptOpen] = useState<boolean>(true);
  const [finalScriptTitle, setFinalScriptTitle] = useState<string>('');
  const [draggedFinalIndex, setDraggedFinalIndex] = useState<number | null>(
    null
  );
  const [generatingSfxIndex, setGeneratingSfxIndex] = useState<number | null>(
    null
  );

  // Estatísticas de ritmo e duração estimada do Roteiro Final (ElevenLabs ~2.4 palavras/segundo)
  const finalTotalWords = useMemo(() => {
    return finalMixScenes.reduce((acc, item) => {
      const words = item.scene.text.trim().split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);
  }, [finalMixScenes]);

  const finalEstDuration = Math.round(finalTotalWords / 2.4);

  const playAudioPreview = (src: string) => {
    try {
      const audio = new Audio(src);
      audio.volume = 0.85;
      void audio.play();
    } catch (e) {
      console.warn('Erro ao reproduzir preview de áudio:', e);
    }
  };

  const handleGenerateCustomSfx = async (index: number) => {
    if (!videoId) return;
    const sceneItem = finalMixScenes[index];
    const prompt = sceneItem.scene.sfx_prompt?.trim();
    if (!prompt) return;

    setGeneratingSfxIndex(index);
    try {
      const res = await fetch(`/api/videos/${videoId}/generate-scene-sfx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIndex: index,
          sfxPrompt: prompt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Falha ao sintetizar efeito sonoro na ElevenLabs'
        );
      }

      if (data.audioUrl) {
        handleUpdateFinalSceneField(index, 'custom_sfx_url', data.audioUrl);
        playAudioPreview(data.audioUrl);
      }
    } catch (err) {
      console.error('[ElevenLabs SFX Error]', err);
      alert(
        err instanceof Error
          ? err.message
          : 'Erro ao gerar efeito sonoro com IA.'
      );
    } finally {
      setGeneratingSfxIndex(null);
    }
  };

  const toggleOptionAccordion = (optionId: string) => {
    setOpenOptionIds((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  // Identificador único de uma cena de origem para saber se já foi selecionada
  const makeSceneUid = (optionId: string, sceneIdx: number) =>
    `${optionId}__scene_${sceneIdx}`;

  // Clique rápido num cartão de cena do Módulo 2 -> Clona para o Roteiro Final (ou remove se já selecionado)
  const handleToggleSelectScene = (
    option: IdeationOption,
    scene: StoryboardScene,
    sceneIdx: number
  ) => {
    const uid = makeSceneUid(option.id, sceneIdx);
    const exists = finalMixScenes.some((item) => item.uid === uid);

    if (exists) {
      setFinalMixScenes((prev) => prev.filter((item) => item.uid !== uid));
    } else {
      if (!finalScriptTitle && option.title) {
        setFinalScriptTitle(option.title);
      }
      if (option.bgmVibe && (finalMixScenes.length === 0 || bgmVibe === 'auto')) {
        setBgmVibe(option.bgmVibe);
      }
      const clonedScene: StoryboardScene = {
        ...scene,
        imagePrompt: injectAvatarConfigIntoPrompt(
          scene.imagePrompt,
          avatarConfig
        ),
        candidateImages: [...(scene.candidateImages || [])],
        selectedImage: scene.selectedImage || null,
      };

      setFinalMixScenes((prev) => [
        ...prev,
        {
          uid,
          sourceOptionId: option.id,
          sourceOptionBadge: option.badge || option.title,
          sourceSceneIndex: sceneIdx,
          scene: clonedScene,
        },
      ]);
      setIsFinalScriptOpen(true);
    }
  };

  // Selecionar todas as cenas de uma opção de uma só vez
  const handleSelectEntireOption = (option: IdeationOption) => {
    if (option.title) {
      setFinalScriptTitle(option.title);
    }
    if (option.bgmVibe) {
      setBgmVibe(option.bgmVibe);
    }
    const mapped: SelectedFinalSceneItem[] = option.scenes.map(
      (scene, idx) => ({
        uid: makeSceneUid(option.id, idx),
        sourceOptionId: option.id,
        sourceOptionBadge: option.badge || option.title,
        sourceSceneIndex: idx,
        scene: {
          ...scene,
          imagePrompt: injectAvatarConfigIntoPrompt(
            scene.imagePrompt,
            avatarConfig
          ),
          candidateImages: [...(scene.candidateImages || [])],
          selectedImage: scene.selectedImage || null,
        },
      })
    );
    setFinalMixScenes(mapped);
    setIsFinalScriptOpen(true);
  };

  // Reordenação por botões Cima / Baixo no Módulo 3
  const handleMoveFinalScene = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= finalMixScenes.length) return;

    setFinalMixScenes((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  // Reordenação por Drag & Drop no Módulo 3
  const handleDragStart = (index: number) => {
    setDraggedFinalIndex(index);
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    overIndex: number
  ) => {
    e.preventDefault();
    if (draggedFinalIndex === null || draggedFinalIndex === overIndex) return;

    setFinalMixScenes((prev) => {
      const copy = [...prev];
      const [draggedItem] = copy.splice(draggedFinalIndex, 1);
      copy.splice(overIndex, 0, draggedItem);
      return copy;
    });
    setDraggedFinalIndex(overIndex);
  };

  const handleDragEnd = () => {
    setDraggedFinalIndex(null);
  };

  // Edição rápida de texto ou locutor dentro do Roteiro Final
  const handleUpdateFinalSceneField = <K extends keyof StoryboardScene>(
    index: number,
    field: K,
    value: StoryboardScene[K]
  ) => {
    setFinalMixScenes((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              scene: {
                ...item.scene,
                [field]: value,
              },
            }
          : item
      )
    );
  };

  const handleRemoveFinalScene = (index: number) => {
    setFinalMixScenes((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddCustomScene = () => {
    const customUid = `custom__${Date.now()}`;
    const descriptor = buildClientAvatarPromptDescriptor(avatarConfig);
    const newScene: StoryboardScene = {
      speaker: 'protagonist',
      text: 'Nova fala personalizada na linha do tempo...',
      avatarSprite: AVAILABLE_AVATAR_SPRITES[0],
      visual_description: 'Descrição visual do cenário...',
      imagePrompt: `Mixed media 2D/3D illustration, a ${descriptor}, integrated seamlessly into a realistic 3D cinematic historical environment, illuminated by warm volumetric rim lighting, casting realistic 3D shadows, 9:16 vertical composition.`,
      sfx_suggestion: 'whoosh',
      sfx_prompt: 'Dynamic cinematic transition whoosh sound effect',
      candidateImages: [],
      selectedImage: null,
    };

    setFinalMixScenes((prev) => [
      ...prev,
      {
        uid: customUid,
        sourceOptionId: 'custom',
        sourceOptionBadge: '✍️ Autoral',
        sourceSceneIndex: prev.length,
        scene: newScene,
      },
    ]);
    setIsFinalScriptOpen(true);
  };

  return (
    <div className="space-y-5 pb-4">
      {/* ====================================================================
          MÓDULO 1: O PALCO DO AVATAR (CAMARIM 360º RECOLHÍVEL)
         ==================================================================== */}
      <section className="rounded-2xl border border-[#2c2c32] bg-[#18181c] overflow-hidden shadow-xl transition-all">
        {/* Cabeçalho do Camarim (Acordeão) */}
        <div
          onClick={() => setIsAvatarOpen((prev) => !prev)}
          className={`flex cursor-pointer items-center justify-between bg-[#141417] px-4 py-3 transition-colors hover:bg-[#1a1a1f] select-none ${
            isAvatarOpen ? 'border-b border-[#2c2c32]/70' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-xs text-amber-400 border border-amber-500/30">
              🎭
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Avatar
              </h2>
              <p className="text-[10px] text-slate-400">
                Personalize seu viajante.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                isAvatarOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {isAvatarOpen && (
          <>
            {/* Palco do Avatar Refatorado (SVG Dinâmico, Holofote Suave, UI Limpa) */}
            <AvatarStage
              config={avatarConfig}
              onChange={(newConfig) => setAvatarConfig(newConfig)}
            />

            {/* Painel de Customização (Cabelo, Cor do Traço, Acessórios) */}
            <div className="p-4 space-y-3.5 bg-[#18181c]">
              {/* 1. Estilo de Cabelo (Estilo + Cor Padrão #EA580C + Custom) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    1. Estilo de Cabelo
                  </label>
                  <span className="font-mono text-[10px] text-slate-400 uppercase">
                    {avatarConfig.hairStyle === 'bald'
                      ? '(Careca)'
                      : avatarConfig.hairColor || '#EA580C'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Dropdown do Estilo de Cabelo */}
                  <select
                    value={avatarConfig.hairStyle}
                    onChange={(e) =>
                      setAvatarConfig((prev) => ({
                        ...prev,
                        hairStyle: e.target.value as AvatarHairStyle,
                      }))
                    }
                    className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition h-[38px]"
                  >
                    {HAIR_STYLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Cor do Cabelo: Apenas 1 círculo de cor padrão (#EA580C) + Botão Custom lateral */}
                  <div
                    className={`flex items-center justify-between rounded-lg border border-[#2c2c32] bg-[#121214] px-3 h-[38px] transition ${
                      avatarConfig.hairStyle === 'bald'
                        ? 'opacity-40 pointer-events-none'
                        : ''
                    }`}
                  >
                    {/* Círculo de cor padrão #EA580C */}
                    <button
                      type="button"
                      title="Padrão Ruivo (#EA580C)"
                      onClick={() =>
                        setAvatarConfig((prev) => ({
                          ...prev,
                          hairColor: '#EA580C',
                        }))
                      }
                      style={{ backgroundColor: '#EA580C' }}
                      className={`h-5 w-5 shrink-0 rounded-full border transition-transform ${
                        (avatarConfig.hairColor || '#EA580C').toLowerCase() ===
                        '#ea580c'
                          ? 'scale-110 border-amber-400 ring-2 ring-amber-500/40'
                          : 'border-white/25 hover:scale-105'
                      }`}
                    />

                    {/* Botão Custom lateral */}
                    <label
                      title="Escolher cor personalizada para o cabelo"
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#2c2c32] bg-[#1c1c22] px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-amber-500/50 transition-colors"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-sm border border-white/20 shrink-0"
                        style={{
                          backgroundColor: avatarConfig.hairColor || '#EA580C',
                        }}
                      />
                      <input
                        type="color"
                        value={avatarConfig.hairColor || '#EA580C'}
                        onChange={(e) =>
                          setAvatarConfig((prev) => ({
                            ...prev,
                            hairColor: e.target.value,
                          }))
                        }
                        className="sr-only"
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* 2. Acessórios (Cabeça + Pescoço em Flex Row lado a lado) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  2. Acessórios
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={avatarConfig.accessory || 'forehead_goggles'}
                    onChange={(e) =>
                      setAvatarConfig((prev) => ({
                        ...prev,
                        accessory: e.target.value as AvatarAccessory,
                      }))
                    }
                    className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition h-[38px]"
                  >
                    {ACCESSORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={avatarConfig.neckAccessory || 'red_bandana'}
                    onChange={(e) =>
                      setAvatarConfig((prev) => ({
                        ...prev,
                        neckAccessory: e.target.value as AvatarNeckAccessory,
                      }))
                    }
                    className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition h-[38px]"
                  >
                    {NECK_ACCESSORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Cor do Traço */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    3. Cor do Traço
                  </label>
                  <span className="font-mono text-[10px] text-slate-400 uppercase">
                    {avatarConfig.strokeColor}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2c2c32] bg-[#121214] px-3 py-1.5 min-h-[38px]">
                  <div className="flex items-center gap-2 py-0.5">
                    {STROKE_SWATCHES.map((swatch) => {
                      const isSelected =
                        avatarConfig.strokeColor.toLowerCase() ===
                        swatch.color.toLowerCase();
                      return (
                        <button
                          key={swatch.color}
                          type="button"
                          title={swatch.label}
                          onClick={() =>
                            setAvatarConfig((prev) => ({
                              ...prev,
                              strokeColor: swatch.color,
                            }))
                          }
                          style={{ backgroundColor: swatch.color }}
                          className={`h-5 w-5 shrink-0 rounded-full border transition-transform ${
                            isSelected
                              ? 'scale-110 border-amber-400 ring-2 ring-amber-500/50'
                              : 'border-white/25 hover:scale-105'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <label
                    title="Escolher cor personalizada para o traço"
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#2c2c32] bg-[#1c1c22] px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-amber-500/50 transition-colors"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-sm border border-white/20 shrink-0"
                      style={{ backgroundColor: avatarConfig.strokeColor }}
                    />
                    <input
                      type="color"
                      value={avatarConfig.strokeColor}
                      onChange={(e) =>
                        setAvatarConfig((prev) => ({
                          ...prev,
                          strokeColor: e.target.value,
                        }))
                      }
                      className="sr-only"
                    />
                    <span>Custom</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ====================================================================
          MÓDULO 2: O MOTOR DE IDEAÇÃO (BRAINSTORMING EM ACCORDIONS)
         ==================================================================== */}
      <section className="rounded-2xl border border-[#2c2c32] bg-[#18181c] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b border-[#2c2c32]/70 bg-[#141417] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/15 text-xs text-teal-400 border border-teal-500/30">
              💡
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Geração de roteiros
              </h2>
              <p className="text-[10px] text-slate-400">
                Gere histórias e selecione suas cenas favoritas
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Formulário Briefing + Duração + Botão "💡 Gerar Ideias" */}
          <form onSubmit={onGenerateIdeas} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Briefing & Fatos da Viagem
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Tema, mitos e direção das cenas
                </span>
              </div>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
                disabled={isGeneratingIdeas}
                rows={5}
                placeholder={`Exemplo de Briefing:
• Tema: O mistério do Nariz da Esfinge de Gizé
• Fatos: Desmistificar a lenda de que Napoleão Bonaparte destruiu o nariz com tiros de canhão (desenhos de 1737 de Frederic Norden já mostravam a Esfinge sem nariz antes de Napoleão nascer!).
• Direção das cenas (opcional):
Cena 1: O viajante do tempo chega em Gizé e se assusta com a Esfinge sem nariz.
Cena 2: Mostre o mito das tropas de Napoleão atirando com canhões.
Cena 3: A prova histórica revelando o verdadeiro culpado.
Cena 4: Conclusão instigante convidando a comentar.`}
                className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-amber-500 focus:outline-none transition resize-y leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Duração Alvo
                </label>
                <select
                  value={durationPreset}
                  onChange={(e) =>
                    setDurationPreset(e.target.value as DurationPreset)
                  }
                  disabled={isGeneratingIdeas}
                  className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
                >
                  {durationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Trilha de Fundo (BGM)
                </label>
                <select
                  value={bgmVibe}
                  onChange={(e) =>
                    setBgmVibe(e.target.value as BriefingBgmOption)
                  }
                  disabled={isGeneratingIdeas}
                  className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
                >
                  {BRIEFING_BGM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGeneratingIdeas || !theme.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGeneratingIdeas ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  <span>Gerando 4 Ângulos...</span>
                </>
              ) : (
                <>
                  <span>💡</span>
                  <span>Gerar Ideias</span>
                </>
              )}
            </button>
          </form>

          {/* Lista dos 4 Accordions de Ideação */}
          {ideationOptions.length > 0 ? (
            <div className="space-y-2.5 pt-2 border-t border-[#2c2c32]/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Opções de Roteiro Geradas ({ideationOptions.length})
                </span>
                <span className="text-[10px] text-amber-400">
                  Clique numa cena para enviar ao Roteiro Final
                </span>
              </div>

              {ideationOptions.map((option, optIdx) => {
                const isOpen = Boolean(openOptionIds[option.id]);
                const selectedFromThisOptionCount = option.scenes.filter(
                  (_, sIdx) =>
                    finalMixScenes.some(
                      (item) => item.uid === makeSceneUid(option.id, sIdx)
                    )
                ).length;

                return (
                  <div
                    key={option.id || optIdx}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      selectedFromThisOptionCount > 0
                        ? 'border-amber-500/40 bg-[#141418]'
                        : 'border-[#2c2c32] bg-[#121214]'
                    }`}
                  >
                    {/* Header do Accordion da Opção */}
                    <div
                      onClick={() => toggleOptionAccordion(option.id)}
                      className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-md bg-[#202026] px-2 py-0.5 text-[11px] font-bold text-amber-400 border border-[#2c2c32]">
                          {option.badge || `Opção ${optIdx + 1}`}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold text-slate-100">
                            {option.title}
                          </h3>
                          {option.description && (
                            <p className="truncate text-[10px] text-slate-400">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {option.bgmVibe && (
                          <span
                            title={`Trilha sonora sugerida pela IA para ${option.badge || option.title}`}
                            className="hidden sm:inline-flex items-center gap-1 rounded-md bg-[#1d1d24] border border-[#353540] px-2 py-0.5 text-[10px] font-semibold text-teal-300"
                          >
                            <span>🎵</span>
                            <span>
                              {BGM_VIBE_OPTIONS.find((b) => b.value === option.bgmVibe)?.label.split('(')[0]?.trim() || option.bgmVibe}
                            </span>
                          </span>
                        )}
                        {selectedFromThisOptionCount > 0 && (
                          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            {selectedFromThisOptionCount} escolhida(s)
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {option.scenes.length} cenas
                        </span>
                        <svg
                          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-amber-400' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Corpo do Accordion com os Cartões de Cena */}
                    {isOpen && (
                      <div className="border-t border-[#2c2c32]/70 bg-[#151519] p-3 space-y-2 transition-all">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[10px] text-slate-400">
                            Clique em qualquer cartão para adicionar/remover do
                            Roteiro Final:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectEntireOption(option)}
                            className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-300 transition hover:bg-teal-500/20"
                          >
                            Usar Opção Inteira
                          </button>
                        </div>

                        {option.scenes.map((scene, sIdx) => {
                          const uid = makeSceneUid(option.id, sIdx);
                          const finalOrderIdx = finalMixScenes.findIndex(
                            (item) => item.uid === uid
                          );
                          const isSelected = finalOrderIdx !== -1;

                          return (
                            <div
                              key={uid}
                              onClick={() =>
                                handleToggleSelectScene(option, scene, sIdx)
                              }
                              className={`group relative cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
                                isSelected
                                  ? 'border-amber-500 bg-amber-500/[0.08] shadow-[0_0_15px_rgba(245,158,11,0.14)]'
                                  : 'border-[#2c2c32] bg-[#1b1b20] hover:border-amber-500/40 hover:bg-[#202026]'
                              }`}
                            >
                              {/* Topo do Card: Número da Cena e Ação de Selecionar */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="rounded bg-[#121214] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300 border border-[#2c2c32]">
                                  Cena #{sIdx + 1}
                                </span>

                                <div
                                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950'
                                      : 'border border-[#2c2c32] bg-[#121214] text-slate-400 group-hover:border-amber-500/50 group-hover:text-amber-300'
                                  }`}
                                >
                                  {isSelected ? (
                                    <span>
                                      ✓ #{finalOrderIdx + 1} no Roteiro Final
                                    </span>
                                  ) : (
                                    <span>+ Selecionar</span>
                                  )}
                                </div>
                              </div>

                              {/* 1. Descrição do Cenário (Visual) */}
                              {scene.visual_description && (
                                <div className="mb-2 text-[11px] text-slate-300 leading-snug">
                                  <span className="font-semibold text-amber-400 mr-1.5">
                                    🖼️ Cenário:
                                  </span>
                                  <span className="italic">
                                    {scene.visual_description}
                                  </span>
                                </div>
                              )}

                              {/* 2. Locutor à esquerda + Fala / Legenda */}
                              <div className="rounded-lg bg-[#141418] border border-[#272730] p-2.5 flex items-start gap-2 mb-2">
                                <span className="shrink-0 rounded bg-[#202028] px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-[#30303c]">
                                  {SPEAKER_SHORT_LABELS[scene.speaker]}
                                </span>
                                <p className="text-xs text-slate-100 font-medium leading-relaxed">
                                  “{scene.text}”
                                </p>
                              </div>

                              {/* 3. Design de Som: Som Escolhido + Prompt ElevenLabs */}
                              <div className="pt-0.5 space-y-1.5">
                                {scene.sfx_suggestion &&
                                  scene.sfx_suggestion !== 'none' && (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <span className="font-semibold text-teal-400 flex items-center gap-1">
                                        <span>🔊 Som Escolhido:</span>
                                      </span>
                                      <span
                                        title={`Efeito da biblioteca: ${scene.sfx_suggestion}`}
                                        className="rounded bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 font-mono text-teal-300"
                                      >
                                        {scene.sfx_suggestion}
                                      </span>
                                    </div>
                                  )}

                                {scene.sfx_prompt && (
                                  <div className="flex items-start gap-1.5 rounded-lg border border-[#262630] bg-[#121216] px-2.5 py-1.5 text-[10px] text-slate-400">
                                    <span className="text-teal-400 shrink-0">🎧</span>
                                    <span className="italic leading-snug">
                                      <strong className="text-slate-300 not-italic mr-1">
                                        Prompt IA:
                                      </strong>
                                      “{scene.sfx_prompt}”
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2c2c32] bg-[#121214]/70 p-4 text-center">
              <p className="text-xs font-medium text-slate-300">
                Nenhuma história gerada ainda.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          MÓDULO 3: 🎬 ROTEIRO FINAL (5º ACCORDION COM REORDENAÇÃO E APROVAÇÃO)
         ==================================================================== */}
      <section className="rounded-2xl border-2 border-amber-500/50 bg-[#18181c] overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.12)]">
        {/* Cabeçalho do 5º Accordion: Roteiro Final */}
        <div
          onClick={() => setIsFinalScriptOpen((prev) => !prev)}
          className="flex cursor-pointer items-center justify-between border-b border-[#2c2c32] bg-gradient-to-r from-amber-500/15 via-[#18181c] to-teal-500/10 px-4 py-3.5"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-sm text-slate-950 font-bold shadow-md shadow-amber-500/30">
              🎬
            </span>
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Roteiro Final
              </h2>
              <p className="text-[10px] text-slate-300">
                {finalMixScenes.length} cenas selecionadas • {finalTotalWords} palavras (~{finalEstDuration}s de fala)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 text-amber-400 transition-transform duration-200 ${
                isFinalScriptOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {isFinalScriptOpen && (
          <div className="p-4 space-y-3 bg-[#141417]">
            {finalMixScenes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2c2c32] bg-[#121214] p-5 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  O seu Roteiro Final está vazio
                </p>
                <button
                  type="button"
                  onClick={handleAddCustomScene}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#2c2c32] bg-[#1c1c22] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-amber-500/50 hover:text-amber-300"
                >
                  <span>+ Adicionar Cena Manual</span>
                </button>
              </div>
            ) : (
              <>
                {/* Título Viral + Trilha Sonora Final */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#2c2c32] bg-[#121214] p-3 shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        🏷️ Título do Vídeo (Gerado por IA)
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Editável
                      </span>
                    </div>
                    <input
                      type="text"
                      value={finalScriptTitle}
                      onChange={(e) => setFinalScriptTitle(e.target.value)}
                      placeholder="Ex: Napoleão NÃO Destruiu a Esfinge?! 😱"
                      className="w-full rounded-lg border border-[#2c2c32] bg-[#18181c] px-3 py-1.5 text-xs font-bold text-amber-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="rounded-xl border border-[#2c2c32] bg-[#121214] p-3 shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                        <span>🎵 Trilha Sonora (BGM)</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        Definida pela IA / Ajustável
                      </span>
                    </div>
                    <select
                      value={bgmVibe === 'auto' ? 'epic' : bgmVibe}
                      onChange={(e) => setBgmVibe(e.target.value as BgmVibe)}
                      className="w-full rounded-lg border border-[#2c2c32] bg-[#18181c] px-3 py-1.5 text-xs font-semibold text-slate-100 focus:border-teal-500 focus:outline-none transition"
                    >
                      {BGM_VIBE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>
                    Arraste ou use as setas (↑/↓) para reordenar as cenas:
                  </span>
                  <button
                    type="button"
                    onClick={() => setFinalMixScenes([])}
                    className="text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Limpar Tudo
                  </button>
                </div>

                {/* Lista de Cenas Reordenáveis */}
                <div className="space-y-2.5">
                  {finalMixScenes.map((item, idx) => (
                    <div
                      key={`${item.uid}_${idx}`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-xl border p-3 transition-all duration-200 ${
                        draggedFinalIndex === idx
                          ? 'border-amber-400 bg-amber-500/15 opacity-75 scale-[0.99]'
                          : 'border-[#2c2c32] bg-[#1b1b20] hover:border-amber-500/40'
                      }`}
                    >
                      {/* Topo do Card: Alça de Arrasto + Posição + Badge de Origem + Setas Cima/Baixo + Remover */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            title="Arraste para reordenar"
                            className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 px-1"
                          >
                            ⋮⋮
                          </span>
                          <span className="rounded-md bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-slate-950">
                            #{idx + 1}
                          </span>
                          <span className="truncate rounded border border-[#2c2c32] bg-[#121214] px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                            {item.sourceOptionBadge}
                          </span>
                        </div>

                        {/* Controles de Reordenação (Cima / Baixo) e Remoção */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveFinalScene(idx, 'up')}
                            title="Mover cena para cima"
                            className="flex h-6 w-6 items-center justify-center rounded border border-[#2c2c32] bg-[#121214] text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === finalMixScenes.length - 1}
                            onClick={() => handleMoveFinalScene(idx, 'down')}
                            title="Mover cena para baixo"
                            className="flex h-6 w-6 items-center justify-center rounded border border-[#2c2c32] bg-[#121214] text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFinalScene(idx)}
                            title="Remover cena do Roteiro Final"
                            className="ml-1 flex h-6 w-6 items-center justify-center rounded border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-300 transition hover:bg-rose-500/25"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* 1. Descrição do Cenário (Visual) */}
                      <div className="mb-2 text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5 mb-1 font-semibold text-amber-400">
                          <span>🖼️ Cenário:</span>
                        </div>
                        <input
                          type="text"
                          value={item.scene.visual_description || ''}
                          onChange={(e) =>
                            handleUpdateFinalSceneField(
                              idx,
                              'visual_description',
                              e.target.value
                            )
                          }
                          placeholder="Descrição visual do cenário histórico..."
                          className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none transition italic"
                        />
                      </div>

                      {/* 2. Locutor à esquerda + Fala / Legenda */}
                      <div className="rounded-lg bg-[#141418] border border-[#272730] p-2 flex items-start gap-2 mb-2">
                        <div className="shrink-0 w-36">
                          <select
                            value={item.scene.speaker}
                            onChange={(e) =>
                              handleUpdateFinalSceneField(
                                idx,
                                'speaker',
                                e.target.value as SpeakerType
                              )
                            }
                            className="w-full rounded-md border border-[#30303c] bg-[#202028] px-2 py-1.5 text-[11px] font-bold text-amber-300 focus:border-amber-500 focus:outline-none"
                          >
                            <option value="protagonist">🧑 Protagonista</option>
                            <option value="character">🎭 Personagem</option>
                            <option value="narrator">🎙️ Narrador</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          value={item.scene.text}
                          onChange={(e) =>
                            handleUpdateFinalSceneField(
                              idx,
                              'text',
                              e.target.value
                            )
                          }
                          placeholder="Fala / Legenda da cena..."
                          className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] p-2 text-xs text-slate-100 font-medium leading-relaxed focus:border-amber-500 focus:outline-none transition resize-none"
                        />
                      </div>

                      {/* 3. Design de Som Integrado (Som Escolhido + Prompt ElevenLabs) */}
                      <div className="rounded-lg border border-[#262630] bg-[#121216] p-2.5 space-y-2">
                        {/* Linha do Som Escolhido (Biblioteca Local) */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="font-semibold text-teal-400 flex items-center gap-1">
                              <span>🔊 Som Escolhido:</span>
                            </span>
                            <select
                              value={item.scene.sfx_suggestion || 'whoosh'}
                              onChange={(e) =>
                                handleUpdateFinalSceneField(
                                  idx,
                                  'sfx_suggestion',
                                  e.target.value
                                )
                              }
                              className="rounded-md border border-[#2c2c32] bg-[#18181f] px-2 py-1 text-[11px] font-mono text-teal-300 focus:border-teal-500 focus:outline-none max-w-[220px]"
                            >
                              {SFX_OPTIONS.map((sfx) => (
                                <option key={sfx.value} value={sfx.value}>
                                  {sfx.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {item.scene.custom_sfx_url && (
                            <div className="flex items-center gap-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              <span>✨ Áudio IA Ativo</span>
                              <button
                                type="button"
                                title="Ouvir áudio gerado pela ElevenLabs"
                                onClick={() =>
                                  playAudioPreview(item.scene.custom_sfx_url!)
                                }
                                className="hover:scale-110 transition"
                              >
                                ▶️
                              </button>
                              <button
                                type="button"
                                title="Remover áudio customizado e voltar ao som da biblioteca"
                                onClick={() =>
                                  handleUpdateFinalSceneField(
                                    idx,
                                    'custom_sfx_url',
                                    null
                                  )
                                }
                                className="text-slate-400 hover:text-rose-400 transition"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Linha do Prompt IA (ElevenLabs Text-to-SFX) */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 shrink-0 text-[11px] font-semibold text-slate-400">
                            <span>🎧 Prompt IA:</span>
                          </div>
                          <input
                            type="text"
                            value={item.scene.sfx_prompt || ''}
                            onChange={(e) =>
                              handleUpdateFinalSceneField(
                                idx,
                                'sfx_prompt',
                                e.target.value
                              )
                            }
                            placeholder="Prompt de som para ElevenLabs (ex: Loud stone cracking sound with desert echo)"
                            className="w-full rounded-md border border-[#2c2c32] bg-[#18181f] px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none transition italic"
                          />

                          <button
                            type="button"
                            disabled={
                              !item.scene.sfx_prompt?.trim() ||
                              generatingSfxIndex === idx ||
                              !videoId
                            }
                            onClick={() => void handleGenerateCustomSfx(idx)}
                            title="Gerar som exclusivo com ElevenLabs a partir deste prompt"
                            className="flex shrink-0 items-center gap-1 rounded-md border border-teal-500/40 bg-teal-500/15 px-2.5 py-1 text-[10px] font-bold text-teal-300 hover:bg-teal-500/25 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            {generatingSfxIndex === idx ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border border-teal-300 border-t-transparent" />
                                <span>Gerando...</span>
                              </>
                            ) : (
                              <>
                                <span>✨</span>
                                <span>Gerar SFX</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomScene}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2c2c32] bg-[#121214] py-2 text-[11px] font-semibold text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
                >
                  <span>+ Adicionar Cena Extra</span>
                </button>
              </>
            )}

            {/* Botão Grande e Brilhante: "Aprovar Roteiro" */}
            <div className="pt-2">
              <button
                type="button"
                disabled={finalMixScenes.length === 0 || isApprovingScript}
                onClick={() =>
                  onApproveFinalScript(finalScriptTitle.trim() || undefined)
                }
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-teal-400 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition-all hover:brightness-110 hover:shadow-[0_0_32px_rgba(245,158,11,0.55)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isApprovingScript ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Consolidando Roteiro & Avatar...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">✨</span>
                    <span>
                      Aprovar Roteiro
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

