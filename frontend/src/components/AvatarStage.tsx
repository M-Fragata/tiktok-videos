import React, { useMemo } from 'react';
import type { AvatarConfig, AvatarAngle } from '../remotion/types.ts';

export interface AvatarStageProps {
  config: AvatarConfig;
  onChange: (newConfig: AvatarConfig) => void;
}

const ANGLES_ORDER: AvatarAngle[] = ['front', 'right', 'back', 'left'];

const ANGLE_Y_ROTATION: Record<AvatarAngle, number> = {
  front: 0,
  right: 18,
  back: 180,
  left: -18,
};

export const AvatarStage: React.FC<AvatarStageProps> = ({
  config,
  onChange,
}) => {
  const currentAngle = config.angle || 'front';
  const stroke = config.strokeColor || '#111827';
  const hairStyle = config.hairStyle || 'spiky';
  const hairColor = config.hairColor || '#EA580C';
  const accessory = config.accessory || 'round_glasses';

  const currentIndex = useMemo(() => {
    const idx = ANGLES_ORDER.indexOf(currentAngle);
    return idx >= 0 ? idx : 0;
  }, [currentAngle]);

  const handleRotate = (direction: 'prev' | 'next') => {
    const total = ANGLES_ORDER.length;
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % total
        : (currentIndex - 1 + total) % total;
    onChange({
      ...config,
      angle: ANGLES_ORDER[nextIndex],
    });
  };

  // Deslocamento sutil das feições e acessórios dependendo do ângulo de visão
  const faceOffsetX =
    currentAngle === 'right' ? 8 : currentAngle === 'left' ? -8 : 0;

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101013] px-6 py-6 shadow-2xl">
      {/* ====================================================================
          FASE 2: ILUMINAÇÃO DE ESTÚDIO (Holofote Cônico Volumétrico do Topo ao Chão)
         ==================================================================== */}
      {/* Lâmpada / Emissor do holofote no topo central */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-0 flex flex-col items-center">
        <div className="h-1.5 w-14 rounded-b-md bg-white/40 blur-[0.5px]" />
        <div className="h-1 w-8 rounded-b-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
      </div>

      {/* Feixe Cônico Volumétrico Projetado do Topo até a Elipse do Chão */}
      <div className="pointer-events-none absolute inset-0 z-0 flex justify-center overflow-hidden">
        <svg
          viewBox="0 0 260 220"
          preserveAspectRatio="none"
          className="h-full w-[260px] opacity-90 transition-opacity"
        >
          <defs>
            {/* Gradiente vertical volumétrico do feixe cônico externo */}
            <linearGradient id="theatricalCone" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
              <stop offset="25%" stopColor="#ffffff" stopOpacity="0.16" />
              <stop offset="65%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="90%" stopColor="#ffffff" stopOpacity="0.015" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>

            {/* Núcleo central de luz mais concentrado */}
            <linearGradient id="theatricalCore" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="30%" stopColor="#ffffff" stopOpacity="0.20" />
              <stop offset="75%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>

            {/* Brilho suave difuso de piso onde o feixe atinge */}
            <radialGradient id="floorGlow" cx="50%" cy="100%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Cone Amplo (Feixe de Luz Volumétrico) */}
          <polygon
            points="114,0 146,0 234,204 26,204"
            fill="url(#theatricalCone)"
          />

          {/* Cone Central Mais Brilhante */}
          <polygon
            points="121,0 139,0 206,204 54,204"
            fill="url(#theatricalCore)"
          />

          {/* Arestas luminosas do feixe de luz (feixe cônico visível) */}
          <line
            x1="114"
            y1="0"
            x2="26"
            y2="204"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="1.2"
          />
          <line
            x1="146"
            y1="0"
            x2="234"
            y2="204"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="1.2"
          />

          {/* Brilho de Contato no Chão do Cone */}
          <ellipse cx="130" cy="204" rx="100" ry="12" fill="url(#floorGlow)" />
        </svg>
      </div>

      {/* Brilho âmbar ultra-sutil de ambientação de estúdio */}
      <div
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-36 w-64 rounded-full bg-amber-500/[0.04] blur-3xl"
      />

      {/* ====================================================================
          FASE 3: UI DE ROTAÇÃO LIMPA (Setas < e > Circulares Flanqueando)
         ==================================================================== */}
      <div className="relative flex w-full max-w-[280px] items-center justify-between z-10">
        {/* Botão Seta Esquerda (<) */}
        <button
          type="button"
          onClick={() => handleRotate('prev')}
          title="Girar para o ângulo anterior"
          aria-label="Girar personagem para a esquerda"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#18181d]/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-300 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.4}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Centro: O Palco 3D + Stickman SVG Dinâmico */}
        <div className="relative flex flex-col items-center justify-center py-1">
          {/* Container com perspectiva 3D para rotação suave */}
          <div
            className="relative z-10 -mb-4 transition-transform duration-300 ease-out"
            style={{
              transform: `perspective(800px) rotateY(${ANGLE_Y_ROTATION[currentAngle]}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* ==============================================================
                FASE 1: SVG DINÂMICO INLINE (Stickman Base Puro - Sem Roupas)
               ============================================================== */}
            <svg
              viewBox="0 0 180 210"
              className="h-44 w-36 drop-shadow-[0_12px_20px_rgba(0,0,0,0.85)] transition-all duration-200"
            >
              {/* Sombra de Contato Suave nos Pés */}
              <ellipse
                cx="90"
                cy="186"
                rx="34"
                ry="5"
                fill="rgba(0, 0, 0, 0.45)"
              />

              {/* ------------------------------------------------------------
                  1. CORPO DE PALITO PURO (Linhas Stickman Base)
                 ------------------------------------------------------------ */}
              {/* Pernas de Palito */}
              {currentAngle === 'right' ? (
                <>
                  <path
                    d="M 90 136 L 82 176 L 90 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 90 136 L 100 176 L 109 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : currentAngle === 'left' ? (
                <>
                  <path
                    d="M 90 136 L 80 176 L 71 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 90 136 L 98 176 L 90 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <>
                  <path
                    d="M 90 136 L 74 176 L 66 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 90 136 L 106 176 L 114 178"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Tronco de Palito Puro (Sem colete ou roupa - 100% Stickman Base) */}
              <line
                x1="90"
                y1="82"
                x2="90"
                y2="136"
                stroke={stroke}
                strokeWidth="4.2"
                strokeLinecap="round"
              />

              {/* Braços de Palito */}
              {currentAngle === 'right' ? (
                <>
                  <path
                    d="M 90 92 Q 110 104 116 118"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 90 92 Q 78 102 82 114"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </>
              ) : currentAngle === 'left' ? (
                <>
                  <path
                    d="M 90 92 Q 70 104 64 118"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 90 92 Q 102 102 98 114"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </>
              ) : (
                <>
                  {/* Braço Esquerdo */}
                  <path
                    d="M 90 90 Q 68 104 64 122"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                  {/* Braço Direito */}
                  <path
                    d="M 90 90 Q 112 104 116 122"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                </>
              )}

              {/* ------------------------------------------------------------
                  2. CABEÇA REDONDA BRANCA (Doodle Head)
                 ------------------------------------------------------------ */}
              <circle
                cx="90"
                cy="56"
                r="26"
                fill="#ffffff"
                stroke={stroke}
                strokeWidth="3.6"
              />

              {/* ------------------------------------------------------------
                  3. FEIÇÕES EXPRESSIVAS (Frente, Perfil ou Costas Limpas)
                 ------------------------------------------------------------ */}
              {currentAngle !== 'back' ? (
                <g transform={`translate(${faceOffsetX}, 0)`}>
                  {currentAngle === 'front' ? (
                    <>
                      {/* Olhos Redondos com Brilho */}
                      <circle cx="81" cy="54" r="2.8" fill={stroke} />
                      <circle cx="99" cy="54" r="2.8" fill={stroke} />
                      {/* Sobrancelhas Expressivas */}
                      <path
                        d="M 76 46 Q 81 43 86 46"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 94 46 Q 99 43 104 46"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {/* Sorriso Curvo */}
                      <path
                        d="M 83 65 Q 90 70 97 65"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </>
                  ) : currentAngle === 'right' ? (
                    <>
                      <circle cx="88" cy="54" r="2.6" fill={stroke} />
                      <circle cx="101" cy="54" r="2.8" fill={stroke} />
                      <path
                        d="M 85 46 Q 90 44 93 46 M 97 46 Q 102 44 105 47"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 90 65 Q 98 69 103 64"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      <circle cx="79" cy="54" r="2.8" fill={stroke} />
                      <circle cx="92" cy="54" r="2.6" fill={stroke} />
                      <path
                        d="M 75 47 Q 78 44 83 46 M 87 46 Q 90 44 95 46"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 77 64 Q 82 69 90 65"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </g>
              ) : (
                /* Vista de Costas: Linha sutil de nuca limpa */
                <path
                  d="M 84 69 Q 90 72 96 69"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}

              {/* ------------------------------------------------------------
                  4. CABELO DINÂMICO (hairStyle + hairColor + stroke)
                 ------------------------------------------------------------ */}
              {hairStyle === 'spiky' && (
                <path
                  d="M 66 45 L 61 31 L 74 36 L 79 21 L 89 32 L 97 19 L 104 33 L 115 24 L 113 39 L 121 37 L 114 48 Q 90 33 66 45 Z"
                  fill={hairColor}
                  stroke={stroke}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              )}

              {hairStyle === 'curly' && (
                <g fill={hairColor} stroke={stroke} strokeWidth="1.6">
                  <circle cx="69" cy="39" r="7.5" />
                  <circle cx="78" cy="31" r="8.5" />
                  <circle cx="90" cy="28" r="9.5" />
                  <circle cx="102" cy="31" r="8.5" />
                  <circle cx="111" cy="39" r="7.5" />
                  {currentAngle === 'back' && (
                    <>
                      <circle cx="77" cy="46" r="8.5" />
                      <circle cx="90" cy="44" r="9.5" />
                      <circle cx="103" cy="46" r="8.5" />
                    </>
                  )}
                </g>
              )}

              {hairStyle === 'mohawk' && (
                <path
                  d={
                    currentAngle === 'right' || currentAngle === 'left'
                      ? 'M 78 33 L 74 13 L 86 21 L 92 9 L 100 21 L 108 13 L 105 35 Z'
                      : 'M 84 33 L 80 11 L 90 19 L 95 9 L 100 33 Z'
                  }
                  fill={hairColor}
                  stroke={stroke}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              )}

              {hairStyle === 'pompadour' && (
                <path
                  d={`M 67 41 C 63 21, ${currentAngle === 'left' ? '73 15' : '113 15'}, 115 33 C 117 40, 107 43, 89 39 Z`}
                  fill={hairColor}
                  stroke={stroke}
                  strokeWidth="2"
                />
              )}

              {/* ------------------------------------------------------------
                  5. ACESSÓRIOS DINÂMICOS (accessory)
                 ------------------------------------------------------------ */}
              {accessory === 'round_glasses' && (
                <g transform={`translate(${faceOffsetX}, 0)`}>
                  {currentAngle === 'back' ? (
                    /* Haste traseira dos óculos ao olhar de costas */
                    <line
                      x1="64"
                      y1="52"
                      x2="108"
                      y2="52"
                      stroke={stroke}
                      strokeWidth="2.4"
                    />
                  ) : (
                    <>
                      {/* Aro Esquerdo */}
                      <circle
                        cx="81"
                        cy="54"
                        r="7.5"
                        fill="rgba(56, 189, 248, 0.12)"
                        stroke={stroke}
                        strokeWidth="2.3"
                      />
                      {/* Aro Direito */}
                      <circle
                        cx="99"
                        cy="54"
                        r="7.5"
                        fill="rgba(56, 189, 248, 0.12)"
                        stroke={stroke}
                        strokeWidth="2.3"
                      />
                      {/* Ponte Central */}
                      <line
                        x1="88.5"
                        y1="54"
                        x2="91.5"
                        y2="54"
                        stroke={stroke}
                        strokeWidth="2.3"
                      />
                    </>
                  )}
                </g>
              )}

              {accessory === 'explorer_hat' && (
                <g>
                  {/* Aba do Chapéu Safari */}
                  <ellipse
                    cx="90"
                    cy="34"
                    rx="35"
                    ry="6.5"
                    fill="#a16207"
                    stroke={stroke}
                    strokeWidth="2.2"
                  />
                  {/* Copa do Chapéu */}
                  <path
                    d="M 69 33 C 71 14, 109 14, 111 33 Z"
                    fill="#ca8a04"
                    stroke={stroke}
                    strokeWidth="2.2"
                  />
                  {/* Faixa Marrom do Chapéu */}
                  <path
                    d="M 70 30 L 110 30"
                    stroke="#78350f"
                    strokeWidth="3"
                  />
                </g>
              )}

              {accessory === 'knight_helmet' && (
                <g>
                  <path
                    d="M 64 52 C 62 22, 118 22, 116 52 L 112 66 L 68 66 Z"
                    fill="#94a3b8"
                    stroke={stroke}
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                  />
                  {currentAngle !== 'back' && (
                    <g transform={`translate(${faceOffsetX * 0.5}, 0)`}>
                      <rect
                        x="74"
                        y="46"
                        width="32"
                        height="10"
                        rx="2.5"
                        fill="#1e293b"
                        stroke={stroke}
                        strokeWidth="1.8"
                      />
                      <line
                        x1="82"
                        y1="51"
                        x2="98"
                        y2="51"
                        stroke="#38bdf8"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                  {/* Pluma Vermelha no Topo */}
                  <path
                    d="M 90 25 C 96 11, 114 13, 108 26 Z"
                    fill="#ef4444"
                    stroke={stroke}
                    strokeWidth="1.8"
                  />
                </g>
              )}

              {accessory === 'crown' && (
                <polygon
                  points="68,36 72,17 83,28 90,13 97,28 108,17 112,36"
                  fill="#fbbf24"
                  stroke={stroke}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              )}

              {accessory === 'bandana' && (
                <g>
                  <path
                    d="M 65 42 Q 90 35 115 42 L 114 49 Q 90 42 66 49 Z"
                    fill="#ef4444"
                    stroke={stroke}
                    strokeWidth="1.8"
                  />
                  {/* Laço da bandana atrás se estiver de costas */}
                  {currentAngle === 'back' && (
                    <path
                      d="M 90 48 L 94 62 M 90 48 L 86 60"
                      stroke="#dc2626"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>

          {/* ================================================================
              FASE 2: ELIPSE 3D DO PALCO NO CHÃO (Iluminada pelo Holofote)
             ================================================================ */}
          <div className="relative h-7 w-44 rounded-[100%] border border-white/[0.16] bg-gradient-to-b from-white/[0.10] via-white/[0.03] to-black/70 shadow-[0_12px_28px_rgba(0,0,0,0.95)]">
            <div className="absolute inset-0 rounded-[100%] bg-white/[0.06] blur-[2px]" />
            <div className="absolute inset-1 rounded-[100%] border border-dashed border-white/[0.12]" />
          </div>
        </div>

        {/* Botão Seta Direita (>) */}
        <button
          type="button"
          onClick={() => handleRotate('next')}
          title="Girar para o próximo ângulo"
          aria-label="Girar personagem para a direita"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#18181d]/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-300 active:scale-95"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.4}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

