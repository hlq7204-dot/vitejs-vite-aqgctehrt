import React from 'react';
import {
  SlidersHorizontal,
  X,
  Sparkles,
  Layers,
  CalendarDays,
  Plus,
  AlertTriangle,
  CheckSquare,
  Play,
} from 'lucide-react';
import type { CustomStudyConfig } from '../../types';

interface CustomStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CustomStudyConfig;
  setConfig: React.Dispatch<React.SetStateAction<CustomStudyConfig>>;
  onStart: (e: React.FormEvent) => void;
  availableTags: string[];
  matchedCardsCount: number;
}

export const CustomStudyModal: React.FC<CustomStudyModalProps> = ({
  isOpen,
  onClose,
  config,
  setConfig,
  onStart,
  availableTags,
  matchedCardsCount,
}) => {
  if (!isOpen) return null;

  const presets: {
    id: CustomStudyConfig['preset'];
    label: string;
    Icon: React.ElementType;
  }[] = [
    { id: 'cram', label: 'Simulado Geral (Sorteio)', Icon: Sparkles },
    { id: 'unlearned', label: 'Apenas Não Aprendidos', Icon: Layers },
    { id: 'due_only', label: 'Apenas Pendentes Hoje', Icon: CalendarDays },
    { id: 'new_only', label: 'Apenas Cartões Novos', Icon: Plus },
    { id: 'leeches', label: 'Apenas Sanguessugas', Icon: AlertTriangle },
    { id: 'interactive', label: 'Apenas Interativos', Icon: CheckSquare },
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[85] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Estudo Personalizado</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onStart} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Modo de Filtro
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((p) => {
                const PresetIcon = p.Icon;
                const isSelected = config.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, preset: p.id }))}
                    className={`p-3.5 rounded-xl text-left border transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                        : 'bg-slate-950/80 text-slate-300 border-slate-800/90 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <PresetIcon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-indigo-400' : 'text-slate-500'
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-semibold truncate">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tipo de Cartão
              </label>
              <select
                value={config.cardType}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, cardType: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm font-medium rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="all">Todos os Tipos</option>
                <option value="standard">Padrão</option>
                <option value="choice_tf">Múltipla Escolha + V/F</option>
                <option value="choice">Apenas Múltipla Escolha</option>
                <option value="tf">Apenas V/F</option>
                <option value="typing">Apenas Digitação</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Etiqueta (#tag)
              </label>
              <select
                value={config.tag}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, tag: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm font-medium rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="all">Todas as #tags</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Limite de Cartões na Sessão
              </label>
              <span className="text-xs font-bold text-indigo-400">
                {config.limit === 0 ? 'Todos os encontrados' : `${config.limit} cartões`}
              </span>
            </div>
            <div className="flex gap-2">
              {[5, 10, 20, 30, 50, 0].map((lim) => (
                <button
                  key={lim}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, limit: lim }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    config.limit === lim
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {lim === 0 ? 'Todos' : lim}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl px-4 py-3.5 flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-slate-400">
              Cartões encontrados com esses filtros:
            </span>
            <span className="text-lg font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-xl">
              {matchedCardsCount}
            </span>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-2xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Iniciar Treino
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};