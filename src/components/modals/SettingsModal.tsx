import React from 'react';
import { Settings, Download, Upload } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyGoal: number | string;
  setDailyGoal: (val: any) => void;
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
  desiredRetention,
  setDesiredRetention,
  onSave,
  onExportJSON,
  onTriggerRestoreBackup,
  onExportCSV,
}) => {
  if (!isOpen) return null;

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
              Valores maiores (ex: 95%) agendam revisões mais frequentes; valores menores (ex: 85%) espaçam mais os cartões. Padrão: 90%.
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