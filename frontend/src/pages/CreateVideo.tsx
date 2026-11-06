import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SUGGESTED_THEMES = [
  'A Erupção do Vesúvio em Pompeia (79 d.C.)',
  'A Construção das Pirâmides de Gizé (2560 a.C.)',
  'A Queda da Bastilha na Revolução Francesa (1789)',
  'A Chegada do Homem à Lua com a Apollo 11 (1969)',
];

export const CreateVideo: React.FC = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTheme = theme.trim();
    if (!cleanTheme) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: cleanTheme }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao iniciar geração do vídeo');
      }

      // Redireciona instantaneamente para a Ilha de Edição (Studio) com o ID gerado
      const targetId = data.video?.id || crypto.randomUUID();
      navigate(`/video/${targetId}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao conectar à API do servidor'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-12 text-slate-100 selection:bg-amber-500/30">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 h-72 w-72 rounded-full bg-orange-600/10 blur-[100px]" />
      </div>

      {/* Botão de Retorno */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 backdrop-blur transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
        >
          <span>←</span>
          <span>Voltar ao Dashboard</span>
        </button>
      </div>

      {/* Caixa Central Minimalista */}
      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Badge Decorativo */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 backdrop-blur shadow-lg shadow-amber-500/10">
          <span>⏳ Máquina do Tempo</span>
          <span className="text-amber-500/40">•</span>
          <span>TikTok 9:16</span>
        </div>

        {/* Título Principal */}
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Que momento da História vamos explorar hoje?
        </h1>
        <p className="mt-3 text-sm text-slate-400 sm:text-base">
          O nosso motor de IA vai gerar o roteiro dinâmico, narração com timestamps sincronizados e cenários cinematográficos em segundos.
        </p>

        {/* Formulário Elegante */}
        <form onSubmit={handleSubmit} className="mt-10 space-y-4">
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-2 shadow-2xl backdrop-blur focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Ex: A Batalha das Termópilas e os 300 de Esparta (480 a.C.)"
              className="w-full rounded-xl bg-transparent px-5 py-4 text-base sm:text-lg text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* CTA Chamativo */}
          <button
            type="submit"
            disabled={isSubmitting || !theme.trim()}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 p-4 text-base font-black text-slate-950 shadow-xl shadow-amber-500/20 transition-all duration-200 hover:scale-[1.01] hover:shadow-amber-500/30 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 animate-spin text-slate-950"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>A disparar motores de IA...</span>
              </span>
            ) : (
              <>
                <span className="text-xl">✨</span>
                <span>Gerar Tudo com IA</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </>
            )}
          </button>
        </form>

        {/* Sugestões Rápidas de Temas */}
        <div className="mt-8 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sugestões Rápidas de Temas:
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SUGGESTED_THEMES.map((suggested) => (
              <button
                key={suggested}
                type="button"
                onClick={() => setTheme(suggested)}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500/40 hover:bg-slate-900 hover:text-amber-400 transition"
              >
                {suggested}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

