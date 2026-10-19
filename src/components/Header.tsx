import React from 'react';
import {
  Home,
  PieChart,
  Activity,
  Flame,
  SlidersHorizontal,
  Loader2,
  Upload,
  Settings,
  Minimize,
  Maximize,
  LogOut,
} from 'lucide-react';

export const BrandLogo: React.FC<{ size?: 'normal' | 'large' }> = ({ size = 'normal' }) => {
  const isLarge = size === 'large';
  return (
    <div className="inline-flex items-center select-none">
      <span
        className={`font-extrabold tracking-tight text-slate-100 ${
          isLarge ? 'text-4xl sm:text-5xl' : 'text-xl sm:text-2xl'
        }`}
      >
        Flash<span className="text-indigo-400">Cards</span>
      </span>
    </div>
  );
};

interface MobileBottomNavProps {
  mainTab: string;
  onSelectTab: (tabId: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ mainTab, onSelectTab }) => {
  const tabs = [
    { id: 'home', label: 'Início', Icon: Home },
    { id: 'stats', label: 'Estatísticas', Icon: PieChart },
    { id: 'reports', label: 'Relatórios', Icon: Activity },
  ];

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 flex justify-around items-center px-3 py-2.5 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
      {tabs.map((tab) => {
        const IconComp = tab.Icon;
        const active = mainTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center w-full py-1 rounded-xl gap-1 transition-all ${
              active ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <IconComp className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wide">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

interface HeaderProps {
  currentView: string;
  mainTab: string;
  onSelectTab: (tabId: string) => void;
  onLogoClick: () => void;
  streakCount: number;
  hasDoneToday: boolean;
  onOpenCustomStudy: () => void;
  isImporting: boolean;
  importProgress: string;
  onTriggerFileImport: () => void;
  onOpenSettings: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogout: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  backupInputRef: React.RefObject<HTMLInputElement | null>;
  onUniversalImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRestoreBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  mainTab,
  onSelectTab,
  onLogoClick,
  streakCount,
  hasDoneToday,
  onOpenCustomStudy,
  isImporting,
  importProgress,
  onTriggerFileImport,
  onOpenSettings,
  isFullscreen,
  onToggleFullscreen,
  onLogout,
  fileInputRef,
  backupInputRef,
  onUniversalImport,
  onRestoreBackup,
}) => {
  const displayStreak = Math.max(streakCount, 0);

  const tabs = [
    { id: 'home', label: 'Início', Icon: Home },
    { id: 'stats', label: 'Estatísticas', Icon: PieChart },
    { id: 'reports', label: 'Relatórios', Icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* LOGO TIPOGRAFIA LIMPA */}
        <button
          type="button"
          onClick={onLogoClick}
          className="focus:outline-none hover:opacity-85 transition-opacity"
        >
          <BrandLogo size="normal" />
        </button>

        {/* NAVEGAÇÃO CENTRAL */}
        {currentView === 'dashboard' && (
          <nav className="hidden sm:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            {tabs.map((tab) => {
              const IconComp = tab.Icon;
              const active = mainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-800 text-indigo-400 border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* DOCK DE AÇÕES À DIREITA */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/70 p-1.5 rounded-2xl border border-slate-800/90">
          <input
            type="file"
            accept=".txt,.csv,.colpkg,.apkg,.zip"
            ref={fileInputRef}
            onChange={onUniversalImport}
            className="hidden"
          />
          <input
            type="file"
            accept=".json"
            ref={backupInputRef}
            onChange={onRestoreBackup}
            className="hidden"
          />

          <div
            className={`flex px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold items-center gap-1.5 border transition-all ${
              hasDoneToday
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.15)]'
                : 'bg-slate-950/60 text-slate-500 border-slate-800'
            }`}
            title={
              hasDoneToday ? 'Ofensiva Ativa!' : 'Faça revisões hoje para manter a ofensiva!'
            }
          >
            <Flame
              className={`w-4 h-4 ${
                hasDoneToday ? 'fill-current text-orange-400' : 'opacity-60'
              }`}
            />
            <span>{displayStreak}</span>
          </div>

          <button
            onClick={onOpenCustomStudy}
            className="w-9 h-9 flex items-center justify-center bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-colors border border-indigo-500/20"
            title="Estudo Personalizado / Simulado"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {isImporting ? (
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
              title={importProgress || 'Importando...'}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <button
              onClick={onTriggerFileImport}
              className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors"
              title="Importar Anki (.apkg) ou Texto (.csv/.txt)"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}

          <div className="w-px h-5 bg-slate-800 mx-0.5"></div>

          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="Configurações e Backup"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleFullscreen}
            className="hidden sm:flex w-9 h-9 items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
            title="Tela Cheia"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <button
            onClick={onLogout}
            className="w-9 h-9 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-colors"
            title="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};