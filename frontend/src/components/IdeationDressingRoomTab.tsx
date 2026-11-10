import React, { useState } from 'react';
import {
  AVAILABLE_AVATAR_SPRITES,
  AvatarAccessory,
  AvatarAngle,
  AvatarConfig,
  AvatarHairStyle,
  BGM_VIBE_OPTIONS,
  BgmVibe,
  buildClientAvatarPromptDescriptor,
  DurationPreset,
  IdeationOption,
  injectAvatarConfigIntoPrompt,
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
  theme: string;
  setTheme: (value: string) => void;
  suggestedThemes: string[];
  durationPreset: DurationPreset;
  setDurationPreset: (value: DurationPreset) => void;
  durationOptions: Array<{ value: DurationPreset; label: string }>;
  bgmVibe: BgmVibe;
  setBgmVibe: (value: BgmVibe) => void;
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
  onApproveFinalScript: () => void;
}

const AVATAR_ANGLES: Array<{ id: AvatarAngle; label: string; degrees: string }> =
  [
    { id: 'front', label: 'Frente', degrees: '0°' },
    { id: 'right', label: 'Direita', degrees: '90°' },
    { id: 'back', label: 'Costa', degrees: '180°' },
    { id: 'left', label: 'Esquerda', degrees: '270°' },
  ];

const HAIR_STYLE_OPTIONS: Array<{ value: AvatarHairStyle; label: string }> = [
  { value: 'spiky', label: '⚡ Espetado (Viajante)' },
  { value: 'bald', label: '🥚 Careca (Clássico)' },
  { value: 'curly', label: '🌀 Cacheado (Cientista)' },
  { value: 'mohawk', label: '🎸 Moicano (Rebelde)' },
  { value: 'pompadour', label: '🕺 Topete (Retrô)' },
];

const ACCESSORY_OPTIONS: Array<{ value: AvatarAccessory; label: string }> = [
  { value: 'round_glasses', label: '👓 Óculos Redondos' },
  { value: 'none', label: '✨ Sem Acessório' },
  { value: 'explorer_hat', label: '🤠 Chapéu Explorador' },
  { value: 'knight_helmet', label: '⚔️ Elmo Medieval' },
  { value: 'crown', label: '👑 Coroa Real' },
  { value: 'bandana', label: '🥷 Bandana Aventureiro' },
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

/**
 * Renderiza o Boneco Stickman 2D em SVG reativo aos 4 ângulos (360º),
 * Cabelo, Cor do Traço e Acessórios sobre o palco 3D.
 */
const StickmanStagePreview: React.FC<{ config: AvatarConfig }> = ({
  config,
}) => {
  const { hairStyle, strokeColor, accessory, angle } = config;
  const stroke = strokeColor || '#111827';
  // Para garantir contraste das linhas do corpo sobre o palco escuro #121214
  // caso o traço escolhido seja muito escuro, adicionamos um leve halo claro ao redor dos membros
  const isVeryDarkStroke =
    stroke.toLowerCase() === '#111827' ||
    stroke.toLowerCase() === '#000000' ||
    stroke.toLowerCase() === '#0f172a';

  const faceOffsetX =
    angle === 'right' ? 9 : angle === 'left' ? -9 : 0;

  return (
    <svg
      viewBox="0 0 180 210"
      className="h-44 w-40 drop-shadow-[0_10px_18px_rgba(0,0,0,0.75)] transition-transform duration-300"
    >
      <defs>
        <radialGradient id="stageSpotlight" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="65%" stopColor="#14b8a6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <filter id="stickGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="1.8"
            floodColor={isVeryDarkStroke ? '#f8fafc' : stroke}
            floodOpacity={isVeryDarkStroke ? '0.65' : '0.45'}
          />
        </filter>
      </defs>

      {/* Halo de Iluminação Volumétrica de Fundo */}
      <circle cx="90" cy="88" r="68" fill="url(#stageSpotlight)" />

      {/* Grupo Principal do Personagem Stickman */}
      <g filter="url(#stickGlow)">
        {/* Pernas de Palito */}
        {angle === 'right' ? (
          <>
            <path
              d="M 90 138 L 82 178 L 90 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 90 138 L 100 178 L 109 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : angle === 'left' ? (
          <>
            <path
              d="M 90 138 L 80 178 L 71 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 90 138 L 98 178 L 90 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <path
              d="M 90 138 L 73 178 L 65 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 90 138 L 107 178 L 115 180"
              fill="none"
              stroke={stroke}
              strokeWidth="4.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Tronco + Colete de Viajante */}
        <line
          x1="90"
          y1="88"
          x2="90"
          y2="138"
          stroke={stroke}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d={
            angle === 'right'
              ? 'M 83 94 L 99 94 L 101 132 L 82 132 Z'
              : angle === 'left'
                ? 'M 79 94 L 97 94 L 98 132 L 81 132 Z'
                : 'M 77 94 L 103 94 L 105 133 L 75 133 Z'
          }
          fill="#3f4d36"
          stroke={stroke}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Detalhe frontal ou traseiro do colete */}
        {angle === 'front' && (
          <line
            x1="90"
            y1="94"
            x2="90"
            y2="133"
            stroke={stroke}
            strokeWidth="2.2"
          />
        )}
        {angle === 'back' && (
          <path
            d="M 81 104 L 99 104 M 84 118 L 96 118"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}

        {/* Braços de Palito */}
        {angle === 'right' ? (
          <path
            d="M 91 98 Q 112 108 118 96"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : angle === 'left' ? (
          <path
            d="M 89 98 Q 68 108 62 96"
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d="M 78 98 Q 58 110 56 124"
              fill="none"
              stroke={stroke}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M 102 98 Q 122 106 126 90"
              fill="none"
              stroke={stroke}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Cabeça Redonda Branca 2D (Doodle Head) */}
        <circle
          cx="90"
          cy="60"
          r="27"
          fill="#ffffff"
          stroke={stroke}
          strokeWidth="3.6"
        />

        {/* Sombreamento 3D subtil na borda da cabeça */}
        <path
          d="M 70 78 A 26 26 0 0 0 112 74"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Feições do Rosto (Apenas Frente, Direita e Esquerda; Costa mostra nuca limpa) */}
        {angle !== 'back' && (
          <g transform={`translate(${faceOffsetX}, 0)`}>
            {/* Olhos */}
            {angle === 'front' ? (
              <>
                <circle cx="81" cy="58" r="2.8" fill={stroke} />
                <circle cx="99" cy="58" r="2.8" fill={stroke} />
                {/* Sobrancelhas expressivas */}
                <path
                  d="M 76 50 Q 81 47 85 50"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M 95 50 Q 99 47 104 50"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Boca */}
                <path
                  d="M 83 69 Q 90 74 97 69"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </>
            ) : angle === 'right' ? (
              <>
                <circle cx="88" cy="58" r="2.6" fill={stroke} />
                <circle cx="101" cy="58" r="2.8" fill={stroke} />
                <path
                  d="M 85 50 Q 90 48 93 50 M 97 50 Q 102 48 105 51"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M 90 69 Q 98 73 103 68"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <circle cx="79" cy="58" r="2.8" fill={stroke} />
                <circle cx="92" cy="58" r="2.6" fill={stroke} />
                <path
                  d="M 75 51 Q 78 48 83 50 M 87 50 Q 90 48 95 50"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M 77 68 Q 82 73 90 69"
                  fill="none"
                  stroke={stroke}
                  strokeWidth="2.3"
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        )}

        {/* Se estiver de Costas, mostra linhas subtis de nuca / costura */}
        {angle === 'back' && (
          <path
            d="M 84 74 Q 90 76 96 74"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}

        {/* ============================================================
            CABELO CUSTOMIZÁVEL (hairStyle)
           ============================================================ */}
        {hairStyle === 'spiky' && (
          <path
            d="M 65 48 L 60 34 L 73 39 L 78 24 L 88 35 L 96 22 L 103 36 L 114 27 L 113 42 L 121 40 L 115 51 Q 90 36 65 48 Z"
            fill={stroke}
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        )}

        {hairStyle === 'curly' && (
          <g fill={stroke} stroke={stroke} strokeWidth="1.5">
            <circle cx="68" cy="42" r="8" />
            <circle cx="77" cy="34" r="9" />
            <circle cx="90" cy="31" r="10" />
            <circle cx="103" cy="34" r="9" />
            <circle cx="112" cy="42" r="8" />
            {angle === 'back' && (
              <>
                <circle cx="76" cy="50" r="9" />
                <circle cx="90" cy="48" r="10" />
                <circle cx="104" cy="50" r="9" />
              </>
            )}
          </g>
        )}

        {hairStyle === 'mohawk' && (
          <path
            d={
              angle === 'right' || angle === 'left'
                ? 'M 78 36 L 74 16 L 86 24 L 92 12 L 100 24 L 108 16 L 105 38 Z'
                : 'M 84 36 L 80 14 L 90 22 L 95 12 L 100 36 Z'
            }
            fill="#f59e0b"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        )}

        {hairStyle === 'pompadour' && (
          <path
            d={`M 66 44 C 62 24, ${angle === 'left' ? '72 18' : '112 18'}, 116 36 C 118 43, 108 46, 90 42 Z`}
            fill={stroke}
            stroke={stroke}
            strokeWidth="2"
          />
        )}

        {/* ============================================================
            ACESSÓRIOS CUSTOMIZÁVEIS (accessory)
           ============================================================ */}
        {accessory === 'round_glasses' && (
          <g transform={`translate(${faceOffsetX}, 0)`}>
            {angle === 'back' ? (
              /* Elástico/Haste traseira quando visto de costas */
              <line
                x1="63"
                y1="56"
                x2="108"
                y2="56"
                stroke={stroke}
                strokeWidth="2.5"
              />
            ) : (
              <>
                <circle
                  cx="80"
                  cy="58"
                  r="7.5"
                  fill="rgba(56, 189, 248, 0.14)"
                  stroke={stroke}
                  strokeWidth="2.4"
                />
                <circle
                  cx="100"
                  cy="58"
                  r="7.5"
                  fill="rgba(56, 189, 248, 0.14)"
                  stroke={stroke}
                  strokeWidth="2.4"
                />
                <line
                  x1="87.5"
                  y1="58"
                  x2="92.5"
                  y2="58"
                  stroke={stroke}
                  strokeWidth="2.4"
                />
              </>
            )}
          </g>
        )}

        {accessory === 'explorer_hat' && (
          <g>
            <ellipse
              cx="90"
              cy="37"
              rx="36"
              ry="7"
              fill="#a16207"
              stroke={stroke}
              strokeWidth="2.4"
            />
            <path
              d="M 68 36 C 70 17, 110 17, 112 36 Z"
              fill="#ca8a04"
              stroke={stroke}
              strokeWidth="2.4"
            />
            <path
              d="M 69 33 L 111 33"
              stroke="#78350f"
              strokeWidth="3.2"
            />
          </g>
        )}

        {accessory === 'knight_helmet' && (
          <g>
            <path
              d="M 62 56 C 60 25, 120 25, 118 56 L 114 70 L 66 70 Z"
              fill="#94a3b8"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {angle !== 'back' && (
              <g transform={`translate(${faceOffsetX * 0.5}, 0)`}>
                <rect
                  x="73"
                  y="49"
                  width="34"
                  height="11"
                  rx="3"
                  fill="#1e293b"
                  stroke={stroke}
                  strokeWidth="1.8"
                />
                <line
                  x1="82"
                  y1="54.5"
                  x2="98"
                  y2="54.5"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
              </g>
            )}
            {/* Pluma vermelha no topo do elmo */}
            <path
              d="M 90 28 C 96 14, 114 16, 108 29 Z"
              fill="#ef4444"
              stroke={stroke}
              strokeWidth="1.8"
            />
          </g>
        )}

        {accessory === 'crown' && (
          <polygon
            points="67,39 71,20 82,31 90,16 98,31 109,20 113,39"
            fill="#fbbf24"
            stroke={stroke}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
        )}

        {accessory === 'bandana' && (
          <g>
            <path
              d="M 64 44 Q 90 38 116 44 L 117 51 Q 90 46 63 51 Z"
              fill="#e11d48"
              stroke={stroke}
              strokeWidth="2"
            />
            {/* Nó da bandana visível na lateral ou nas costas */}
            {(angle === 'back' || angle === 'left' || angle === 'front') && (
              <path
                d="M 115 47 L 127 42 M 115 49 L 125 56"
                stroke="#e11d48"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            )}
          </g>
        )}
      </g>
    </svg>
  );
};

export const IdeationDressingRoomTab: React.FC<
  IdeationDressingRoomTabProps
> = ({
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
  const [openOptionIds, setOpenOptionIds] = useState<Record<string, boolean>>({
    humor: true,
    action: false,
    dark: false,
    chaotic: false,
  });
  const [isFinalScriptOpen, setIsFinalScriptOpen] = useState<boolean>(true);
  const [draggedFinalIndex, setDraggedFinalIndex] = useState<number | null>(
    null
  );

  // Rotação 360º do Palco do Avatar
  const currentAngleIndex = Math.max(
    0,
    AVATAR_ANGLES.findIndex((a) => a.id === avatarConfig.angle)
  );

  const handleRotateAvatar = (direction: 'prev' | 'next') => {
    const total = AVATAR_ANGLES.length;
    const nextIndex =
      direction === 'next'
        ? (currentAngleIndex + 1) % total
        : (currentAngleIndex - 1 + total) % total;
    setAvatarConfig((prev) => ({
      ...prev,
      angle: AVATAR_ANGLES[nextIndex].id,
    }));
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
      imagePrompt: `Mixed media 2D/3D illustration, a ${descriptor}, integrated seamlessly into a realistic 3D cinematic historical environment, illuminated by warm volumetric rim lighting, casting realistic 3D shadows, 9:16 vertical composition.`,
      sfx_suggestion: 'ambient historical soundscape',
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
          MÓDULO 1: O PALCO DO AVATAR (CAMARIM 360º)
         ==================================================================== */}
      <section className="rounded-2xl border border-[#2c2c32] bg-[#18181c] overflow-hidden shadow-xl">
        {/* Cabeçalho do Camarim */}
        <div className="flex items-center justify-between border-b border-[#2c2c32]/70 bg-[#141417] px-4 py-3">
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

        </div>

        {/* Palco 3D com Elipse Iluminada e Botões de Rotação (< e >) */}
        <div className="relative flex flex-col items-center justify-center bg-[#121214] px-4 pt-4 pb-5 border-b border-[#2c2c32]/60 overflow-hidden">
          {/* Luzes de Palco Superiores */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-32 w-56 rounded-full bg-amber-500/10 blur-2xl" />

          <div className="relative flex w-full items-center justify-between px-2 z-10">
            {/* Botão Rotação Esquerda (<) */}
            <button
              type="button"
              onClick={() => handleRotateAvatar('prev')}
              title="Girar para o ângulo anterior"
              aria-label="Girar para a esquerda"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2c2c32] bg-[#1c1c22]/90 text-slate-200 shadow-lg transition-all hover:scale-105 hover:border-amber-500/60 hover:bg-amber-500/15 hover:text-amber-300 active:scale-95"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Centro: Boneco Stickman + Elipse 3D no Chão */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="relative z-10 -mb-5">
                <StickmanStagePreview config={avatarConfig} />
              </div>

              {/* Elipse 3D do Palco no Chão */}
              <div className="relative h-9 w-48 rounded-[100%] border border-amber-500/35 bg-gradient-to-b from-amber-500/20 via-teal-500/10 to-[#0f0f11] shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                <div className="absolute inset-1.5 rounded-[100%] border border-dashed border-white/15" />
              </div>
            </div>

            {/* Botão Rotação Direita (>) */}
            <button
              type="button"
              onClick={() => handleRotateAvatar('next')}
              title="Girar para o próximo ângulo"
              aria-label="Girar para a direita"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2c2c32] bg-[#1c1c22]/90 text-slate-200 shadow-lg transition-all hover:scale-105 hover:border-amber-500/60 hover:bg-amber-500/15 hover:text-amber-300 active:scale-95"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Indicadores de Ângulo 360º */}
          <div className="mt-3 flex items-center gap-1.5 z-10">
            {AVATAR_ANGLES.map((ang) => {
              const isActive = avatarConfig.angle === ang.id;
              return (
                <button
                  key={ang.id}
                  type="button"
                  onClick={() =>
                    setAvatarConfig((prev) => ({ ...prev, angle: ang.id }))
                  }
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                      : 'bg-[#1c1c22] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ang.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel de Customização (Cabelo, Cor do Traço, Acessórios) */}
        <div className="p-4 space-y-3.5 bg-[#18181c]">
          <div className="grid grid-cols-2 gap-3">
            {/* 1. Cabelo */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                1. Estilo de Cabelo
              </label>
              <select
                value={avatarConfig.hairStyle}
                onChange={(e) =>
                  setAvatarConfig((prev) => ({
                    ...prev,
                    hairStyle: e.target.value as AvatarHairStyle,
                  }))
                }
                className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
              >
                {HAIR_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Acessórios */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                2. Acessórios
              </label>
              <select
                value={avatarConfig.accessory}
                onChange={(e) =>
                  setAvatarConfig((prev) => ({
                    ...prev,
                    accessory: e.target.value as AvatarAccessory,
                  }))
                }
                className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
              >
                {ACCESSORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Cor do Traço (Color Picker + Swatches) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                3. Cor do Traço (Ink Line)
              </label>
              <span className="font-mono text-[10px] text-slate-400 uppercase">
                {avatarConfig.strokeColor}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2c2c32] bg-[#121214] p-2">
              <div className="flex items-center gap-1.5">
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
                      className={`h-6 w-6 rounded-full border transition-transform ${
                        isSelected
                          ? 'scale-110 border-amber-400 ring-2 ring-amber-500/40'
                          : 'border-white/25 hover:scale-105'
                      }`}
                    />
                  );
                })}
              </div>

              <label
                title="Escolher cor personalizada"
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#2c2c32] bg-[#1c1c22] px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-amber-500/50"
              >
                <input
                  type="color"
                  value={avatarConfig.strokeColor}
                  onChange={(e) =>
                    setAvatarConfig((prev) => ({
                      ...prev,
                      strokeColor: e.target.value,
                    }))
                  }
                  className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>Custom</span>
              </label>
            </div>
          </div>
        </div>
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
          {/* Formulário Tema + Duração + Botão "💡 Gerar Ideias" */}
          <form onSubmit={onGenerateIdeas} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tema da Viagem
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                required
                disabled={isGeneratingIdeas}
                placeholder="Ex: A Construção das Pirâmides de Gizé (2560 a.C.)"
                className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none transition"
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
                  onChange={(e) => setBgmVibe(e.target.value as BgmVibe)}
                  className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] px-2.5 py-2.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none transition"
                >
                  {BGM_VIBE_OPTIONS.map((opt) => (
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
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="rounded bg-[#121214] px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                                    Cena #{sIdx + 1}
                                  </span>
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {SPEAKER_SHORT_LABELS[scene.speaker]}
                                  </span>
                                </div>

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

                              <p className="text-xs text-slate-100 leading-relaxed">
                                “{scene.text}”
                              </p>
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
                {finalMixScenes.length} cenas selecionadas
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

                      {/* Seletor rápido de Voz + Edição Rápida da Fala */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.scene.speaker}
                            onChange={(e) =>
                              handleUpdateFinalSceneField(
                                idx,
                                'speaker',
                                e.target.value as SpeakerType
                              )
                            }
                            className="rounded-md border border-[#2c2c32] bg-[#121214] px-2 py-1 text-[10px] font-semibold text-slate-200 focus:border-amber-500 focus:outline-none"
                          >
                            <option value="protagonist">
                              🧑 Protagonista (Viajante)
                            </option>
                            <option value="character">
                              🎭 Personagem Histórico
                            </option>
                            <option value="narrator">
                              🎙️ Narrador Épico
                            </option>
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
                          className="w-full rounded-lg border border-[#2c2c32] bg-[#121214] p-2 text-xs text-slate-100 leading-relaxed focus:border-amber-500 focus:outline-none transition resize-none"
                        />
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
                onClick={onApproveFinalScript}
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

