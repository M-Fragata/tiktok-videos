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
  const accessory = config.accessory || 'forehead_goggles';
  const neckAccessory = config.neckAccessory || 'red_bandana';

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

              {/* Tronco Cartum Branco com Borda (Stickman com Corpo Preenchido) */}
              {currentAngle === 'right' || currentAngle === 'left' ? (
                <path
                  d="M 86 88 L 84 138 L 96 138 L 94 88 Z"
                  fill="#ffffff"
                  stroke={stroke}
                  strokeWidth="3.6"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M 82 88 L 79 138 L 101 138 L 98 88 Z"
                  fill="#ffffff"
                  stroke={stroke}
                  strokeWidth="3.6"
                  strokeLinejoin="round"
                />
              )}

              {/* Linha do Pescoço */}
              <line
                x1="90"
                y1="80"
                x2="90"
                y2="89"
                stroke={stroke}
                strokeWidth="3.6"
                strokeLinecap="round"
              />

              {/* Braços com Mãos na Cintura (Pose Confiante - Cotovelos para Fora) */}
              {currentAngle === 'right' ? (
                <>
                  {/* Braço de trás */}
                  <path
                    d="M 86 94 L 72 116 L 83 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.75"
                  />
                  {/* Braço da frente */}
                  <path
                    d="M 94 94 L 116 116 L 98 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : currentAngle === 'left' ? (
                <>
                  {/* Braço de trás */}
                  <path
                    d="M 94 94 L 108 116 L 97 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.75"
                  />
                  {/* Braço da frente */}
                  <path
                    d="M 86 94 L 64 116 L 82 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <>
                  {/* Braço Esquerdo (Mão na Cintura) */}
                  <path
                    d="M 82 94 L 58 118 L 77 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Braço Direito (Mão na Cintura) */}
                  <path
                    d="M 98 94 L 122 118 L 103 134"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                      {/* Sobrancelha Direita (do observador esquerda: curvada e determinada) */}
                      <path
                        d="M 73 49 Q 80 45 87 48"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      {/* Olho Direito Aberto com Brilho Pupilar */}
                      <ellipse cx="80" cy="57" rx="3.4" ry="4.5" fill={stroke} />
                      <ellipse
                        cx="81.2"
                        cy="55.5"
                        rx="1.2"
                        ry="1.4"
                        fill="#ffffff"
                      />

                      {/* Sobrancelha Esquerda (do observador direita: levantada e confiante) */}
                      <path
                        d="M 93 46 Q 100 41 107 45"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      {/* Olho Esquerdo Piscando (Wink Estiloso) */}
                      <path
                        d="M 95 56 Q 101 52 107 56"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 97 59 Q 101 60 105 59"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />

                      {/* Sorriso Confiante / Smirk de Lado com Dentes Brancos */}
                      <path
                        d="M 78 66 Q 91 72 104 61 Q 93 78 78 66 Z"
                        fill="#ffffff"
                        stroke={stroke}
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 77 66 Q 91 72 105 61"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      {/* Covinha do Smirk */}
                      <path
                        d="M 104 61 Q 107 58 106 56"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      {/* Divisão suave dos dentes */}
                      <path
                        d="M 82 67.5 Q 92 72.5 101 63.5"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        fill="none"
                      />
                    </>
                  ) : currentAngle === 'right' ? (
                    <>
                      {/* Sobrancelha interna */}
                      <path
                        d="M 84 48 Q 88 45 92 48"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      <ellipse cx="89" cy="57" rx="2.8" ry="4.2" fill={stroke} />
                      <ellipse cx="90" cy="55.5" rx="1" ry="1.2" fill="#ffffff" />
                      {/* Sobrancelha externa arqueada */}
                      <path
                        d="M 96 46 Q 102 42 107 46"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      {/* Piscadela */}
                      <path
                        d="M 97 56 Q 102 52 106 56"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      {/* Smirk lateral */}
                      <path
                        d="M 88 66 Q 97 71 106 63"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 105 63 Q 108 60 107 58"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      {/* Sobrancelha externa */}
                      <path
                        d="M 73 48 Q 78 44 83 48"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      <ellipse cx="78" cy="57" rx="2.8" ry="4.2" fill={stroke} />
                      <ellipse cx="79" cy="55.5" rx="1" ry="1.2" fill="#ffffff" />
                      {/* Sobrancelha interna arqueada */}
                      <path
                        d="M 88 46 Q 93 42 97 46"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      {/* Piscadela */}
                      <path
                        d="M 89 56 Q 93 52 97 56"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      {/* Smirk lateral */}
                      <path
                        d="M 75 64 Q 84 71 93 66"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 92 66 Q 95 64 94 62"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="2"
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
                  d={
                    currentAngle === 'right'
                      ? 'M 64 48 L 54 30 L 69 33 L 78 14 L 88 23 L 98 9 L 104 23 L 118 14 L 121 32 L 136 29 L 126 49 Q 95 35 64 48 Z'
                      : currentAngle === 'left'
                      ? 'M 54 49 L 44 29 L 59 32 L 62 14 L 76 23 L 82 9 L 92 23 L 102 14 L 111 33 L 126 30 L 116 48 Q 85 35 54 49 Z'
                      : currentAngle === 'back'
                      ? 'M 58 48 L 48 28 L 63 31 L 69 12 L 82 22 L 90 7 L 98 22 L 111 12 L 117 31 L 132 28 L 122 48 Q 124 60 90 62 Q 56 60 58 48 Z'
                      : 'M 58 48 L 48 28 L 63 31 L 69 12 L 82 22 L 90 7 L 98 22 L 111 12 L 117 31 L 132 28 L 122 48 Q 90 34 58 48 Z'
                  }
                  fill={hairColor}
                  stroke={stroke}
                  strokeWidth="3"
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

              {accessory === 'forehead_goggles' && (
                <g>
                  {currentAngle === 'back' ? (
                    /* Vista de costas: Tira de couro com costura e fivela metálica de ajuste */
                    <g>
                      <path
                        d="M 64 45 Q 90 48 116 45"
                        fill="none"
                        stroke="#4a2e18"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 65 43 Q 90 46 115 43"
                        fill="none"
                        stroke="#271406"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <path
                        d="M 65 47 Q 90 50 115 47"
                        fill="none"
                        stroke="#271406"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      {/* Fivela de Latão */}
                      <rect
                        x="86.5"
                        y="42"
                        width="7"
                        height="8"
                        rx="1.5"
                        fill="#ca8a04"
                        stroke="#78350f"
                        strokeWidth="1.2"
                      />
                      <rect
                        x="88.5"
                        y="44"
                        width="3"
                        height="4"
                        rx="0.5"
                        fill="#4a2e18"
                      />
                      <line
                        x1="90"
                        y1="42"
                        x2="90"
                        y2="50"
                        stroke="#78350f"
                        strokeWidth="1"
                      />
                    </g>
                  ) : currentAngle === 'right' ? (
                    /* Vista Perfil Direito */
                    <g>
                      {/* Tira de couro */}
                      <path
                        d="M 64 48 Q 88 44 116 46"
                        stroke="#4a2e18"
                        strokeWidth="5.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* Lente esquerda (perspectiva recuada) */}
                      <rect
                        x="71"
                        y="35"
                        width="16"
                        height="16"
                        rx="5"
                        ry="5"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.2"
                      />
                      <rect
                        x="73"
                        y="37"
                        width="12"
                        height="12"
                        rx="3.5"
                        ry="3.5"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1"
                      />
                      <line
                        x1="75"
                        y1="45"
                        x2="80"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      {/* Ponte */}
                      <path
                        d="M 86 43 Q 90 41 94 43"
                        stroke="#4a2e18"
                        strokeWidth="4"
                        fill="none"
                      />
                      {/* Lente direita (em destaque) */}
                      <rect
                        x="94"
                        y="35"
                        width="22"
                        height="16"
                        rx="6"
                        ry="6"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.4"
                      />
                      <rect
                        x="96"
                        y="37"
                        width="18"
                        height="12"
                        rx="4"
                        ry="4"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1.2"
                      />
                      <line
                        x1="99"
                        y1="46"
                        x2="106"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <line
                        x1="106"
                        y1="46"
                        x2="110"
                        y2="41"
                        stroke="#ffffff"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    </g>
                  ) : currentAngle === 'left' ? (
                    /* Vista Perfil Esquerdo */
                    <g>
                      {/* Tira de couro */}
                      <path
                        d="M 64 46 Q 92 44 116 48"
                        stroke="#4a2e18"
                        strokeWidth="5.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* Lente esquerda (em destaque) */}
                      <rect
                        x="64"
                        y="35"
                        width="22"
                        height="16"
                        rx="6"
                        ry="6"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.4"
                      />
                      <rect
                        x="66"
                        y="37"
                        width="18"
                        height="12"
                        rx="4"
                        ry="4"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1.2"
                      />
                      <line
                        x1="70"
                        y1="46"
                        x2="77"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <line
                        x1="77"
                        y1="46"
                        x2="81"
                        y2="41"
                        stroke="#ffffff"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      {/* Ponte */}
                      <path
                        d="M 86 43 Q 90 41 94 43"
                        stroke="#4a2e18"
                        strokeWidth="4"
                        fill="none"
                      />
                      {/* Lente direita (perspectiva recuada) */}
                      <rect
                        x="93"
                        y="35"
                        width="16"
                        height="16"
                        rx="5"
                        ry="5"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.2"
                      />
                      <rect
                        x="95"
                        y="37"
                        width="12"
                        height="12"
                        rx="3.5"
                        ry="3.5"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1"
                      />
                      <line
                        x1="98"
                        y1="45"
                        x2="103"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    </g>
                  ) : (
                    /* Vista Frontal: Óculos Aviador Retro com Lentes Ciano Espelhadas na Testa */
                    <g>
                      {/* Tira de couro ajustável na testa */}
                      <path
                        d="M 64 46 Q 90 44 116 46"
                        stroke="#4a2e18"
                        strokeWidth="5.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* Moldura Esquerda de Couro/Bronze */}
                      <rect
                        x="66"
                        y="35"
                        width="21"
                        height="16"
                        rx="6"
                        ry="6"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.4"
                      />
                      {/* Vidro Ciano Espelhado Esquerdo */}
                      <rect
                        x="68"
                        y="37"
                        width="17"
                        height="12"
                        rx="4"
                        ry="4"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1.2"
                      />
                      {/* Brilho Reflexivo Esquerdo */}
                      <line
                        x1="71"
                        y1="46"
                        x2="77"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <line
                        x1="77"
                        y1="46"
                        x2="81"
                        y2="41.5"
                        stroke="#ffffff"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        opacity="0.9"
                      />

                      {/* Ponte Central de Conexão */}
                      <path
                        d="M 86 43 Q 90 41 94 43"
                        stroke="#4a2e18"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <path
                        d="M 87 41.5 Q 90 40 93 41.5"
                        stroke="#271406"
                        strokeWidth="1.2"
                        fill="none"
                      />

                      {/* Moldura Direita de Couro/Bronze */}
                      <rect
                        x="93"
                        y="35"
                        width="21"
                        height="16"
                        rx="6"
                        ry="6"
                        fill="#4a2e18"
                        stroke="#271406"
                        strokeWidth="2.4"
                      />
                      {/* Vidro Ciano Espelhado Direito */}
                      <rect
                        x="95"
                        y="37"
                        width="17"
                        height="12"
                        rx="4"
                        ry="4"
                        fill="#38bdf8"
                        stroke="#0284c7"
                        strokeWidth="1.2"
                      />
                      {/* Brilho Reflexivo Direito */}
                      <line
                        x1="98"
                        y1="46"
                        x2="104"
                        y2="39"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                      <line
                        x1="104"
                        y1="46"
                        x2="108"
                        y2="41.5"
                        stroke="#ffffff"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    </g>
                  )}
                </g>
              )}

              {/* ------------------------------------------------------------
                  6. ACESSÓRIO DE PESCOÇO (neckAccessory - Bandana Vermelha)
                 ------------------------------------------------------------ */}
              {neckAccessory === 'red_bandana' && (
                <g>
                  {currentAngle === 'back' ? (
                    /* Vista de costas: Fita da bandana atrás do pescoço */
                    <g>
                      <path
                        d="M 73 80 Q 90 78 107 80 Q 108 90 90 92 Q 72 90 73 80 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 76 83 Q 90 81 104 83"
                        fill="none"
                        stroke="#991b1b"
                        strokeWidth="1.2"
                      />
                      {/* Pontas escapando sutilmente na lateral esquerda */}
                      <path
                        d="M 73 84 C 62 86, 52 82, 48 83 C 54 88, 64 91, 72 91 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.4"
                      />
                    </g>
                  ) : currentAngle === 'right' ? (
                    /* Vista lateral direita */
                    <g>
                      <path
                        d="M 78 81 Q 90 85 103 82 Q 104 92 90 94 Q 78 92 78 81 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      {/* Nó na lateral */}
                      <circle
                        cx="80"
                        cy="88"
                        r="4"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                      />
                      {/* Pontas esvoaçantes */}
                      <path
                        d="M 80 88 Q 68 93 62 97 C 70 96, 78 93, 82 92 Z"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                      />
                    </g>
                  ) : currentAngle === 'left' ? (
                    /* Vista lateral esquerda com nó proeminente */
                    <g>
                      <path
                        d="M 77 82 Q 90 85 102 81 Q 102 92 90 94 Q 76 92 77 82 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      {/* Nó principal */}
                      <circle
                        cx="74"
                        cy="87"
                        r="4.2"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                      />
                      {/* Pontas esvoaçantes para a esquerda */}
                      <path
                        d="M 73 87 C 60 88, 50 83, 46 82 C 52 89, 62 92, 71 93 Z"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 73 89 C 61 97, 52 103, 48 107 C 60 105, 70 99, 74 94 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </g>
                  ) : (
                    /* Vista Frontal: Bandana Vermelha Dobrada no Pescoço com Nó e Pontas Esvoaçantes */
                    <g>
                      {/* Envoltório da gola */}
                      <path
                        d="M 73 80 Q 90 85 107 80 Q 108 91 90 94 Q 72 91 73 80 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      {/* Caimento triangular do lenço */}
                      <path
                        d="M 80 87 Q 90 102 97 90 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                      />
                      {/* Nó lateral */}
                      <circle
                        cx="75"
                        cy="87"
                        r="4.2"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M 73 85 Q 75 88 77 86"
                        fill="none"
                        stroke="#fca5a5"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                      {/* Pontas esvoaçantes para o lado */}
                      <path
                        d="M 74 87 C 62 88, 52 84, 48 83 C 54 89, 64 92, 72 93 Z"
                        fill="#ef4444"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M 74 89 C 62 96, 54 102, 50 106 C 62 104, 72 99, 75 94 Z"
                        fill="#dc2626"
                        stroke="#991b1b"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </g>
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

