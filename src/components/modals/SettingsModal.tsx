import React from 'react';
import { Settings, Download, Upload } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyGoal: number | string;
  setDailyGoal: (val: any) => void;
  dailyNewLimit: number | string;
  setDailyNewLimit: (val: any) => void;
  learningStepsInput: string;
  setLearningStepsInput: (val: string) => void;
  desiredRetention: number;
  setDesiredRetention: (val: number) => void;
  onSave: (e: React.FormEvent) => void;
  onExportJSON: () => void;
  onTriggerRestoreBackup: () => void;
  onExportCSV: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dailyGoal,
  setDailyGoal,
  dailyNewLimit,
  setDailyNewLimit,
  learningStepsInput,
  setLearningStepsInput,
  desiredRetention,
  setDesiredRetention,
  onSave,
  onExportJSON,
  onTriggerRestoreBackup,
  onExportCSV,
}) => {
  if (!isOpen) return null;

  const numericNewLimit = Number(dailyNewLimit) || 0;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-400" /> Configurações
        </h3>
        <form onSubmit={onSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              Meta Diária (cartões)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              required
              value={dailyGoal}
              onChange={(e) =>
                setDailyGoal(e.target.value === '' ? '' : parseInt(e.target.value))
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Limite de Cartões Novos / Dia
              </label>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/20">
                {numericNewLimit <= 0 ? 'Ilimitado' : `${numericNewLimit}/dia`}
              </span>
            </div>
            <div className="flex gap-1.5 mb-2">
              {[10, 20, 30, 50, 0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDailyNewLimit(preset)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    numericNewLimit === preset
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {preset === 0 ? 'Ilimitado' : preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0"
              max="1000"
              value={dailyNewLimit}
              onChange={(e) =>
                setDailyNewLimit(
                  e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value))
                )
              }
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Use 0 para liberar todos os cartões novos disponíveis ou defina um teto diário para evitar acúmulo após importações.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Passos de Aprendizagem (min)
              </label>
            </div>
            <div className="flex gap-1.5 mb-2">
              {[
                { label: '1m, 10m', val: '1, 10' },
                { label: '1m, 15m, 1h', val: '1, 15, 60' },
                { label: '5m, 30m', val: '5, 30' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setLearningStepsInput(p.val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    learningStepsInput.trim() === p.val
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={learningStepsInput}
              onChange={(e) => setLearningStepsInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Intervalos em minutos separados por vírgula antes de o cartão graduar para revisão diária.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-slate-300">
                Retenção Desejada FSRS
              </label>
              <span className="text-sm font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                {Math.round(desiredRetention * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="0.97"
              step="0.01"
              value={desiredRetention}
              onChange={(e) => setDesiredRetention(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Valores maiores agendam revisões mais frequentes; valores menores espaçam mais os cartões. Padrão: 90%.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Backup e Exportação de Dados
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={onExportJSON}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-indigo-400 border border-slate-800 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                <Download className="w-4 h-4" /> Exportar Backup Completo (.json)
              </button>
              <button
                type="button"
                onClick={onTriggerRestoreBackup}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                <Upload className="w-4 h-4" /> Restaurar Backup (.json)
              </button>
              <button
                type="button"
                onClick={onExportCSV}
                className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
              >
                <Download className="w-4 h-4" /> Exportar Planilha de Cartões (.csv)
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};