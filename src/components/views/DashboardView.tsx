import React from 'react';
import {
  Layers,
  Timer,
  SlidersHorizontal,
  Target,
  Home,
  ChevronRight,
  Folder as FolderIcon,
  Play,
  FastForward,
  MoreVertical,
  Pencil,
  CornerUpRight,
  Trash2,
  FolderPlus,
  BookOpen,
  EyeOff,
  Eye,
  Plus,
} from 'lucide-react';
import type {
  ActivityMap,
  CardStats,
  CustomStudyConfig,
  Deck,
  Folder,
  ItemToDelete,
  ItemToMove,
} from '../../types';
import { FOLDER_THEMES, DECK_THEMES } from '../../constants/themes';
import { isCardUnlearned } from '../../utils/fsrs';
import {
  getCardStats,
  calculateTotalDue,
  getGreeting,
  getTodayStr,
} from '../../utils/helpers';
import { MobileBottomNav } from '../Header';
import { StatsView } from '../stats/StatsWidgets';
import { ReportsView } from './ReportsView';

interface DashboardViewProps {
  mainTab: string;
  setMainTab: (tab: string) => void;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  folders: Folder[];
  validDecks: Deck[];
  globalStats: CardStats;
  dailyGoal: number;
  getDailyCount: (dateStr: string) => number;
  getDailyCountFiltered: (dateStr: string, deckId: string) => number;
  getDecksInFolder: (folderId: string | null) => Deck[];
  getFolderStats: (folderId: string | null) => CardStats;
  breadcrumbs: Folder[];
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  openCustomStudyModal: (
    sourceType?: 'all' | 'folder' | 'deck',
    sourceId?: string | null
  ) => void;
  setCustomStudyConfig: React.Dispatch<React.SetStateAction<CustomStudyConfig>>;
  setIsCustomStudyModalOpen: (open: boolean) => void;
  startReview: (
    deckId: string | null,
    forceAll?: boolean,
    folderId?: string | null
  ) => void;
  openEditModal: (
    type: 'folder' | 'deck',
    item: Folder | Deck,
    e: React.MouseEvent
  ) => void;
  setItemToMove: (item: ItemToMove | null) => void;
  setMoveTargetFolderId: (id: string | null) => void;
  setIsMoveModalOpen: (open: boolean) => void;
  setItemToDelete: (item: ItemToDelete | null) => void;
  setModalMode: (mode: 'create' | 'edit') => void;
  setModalType: (type: 'folder' | 'deck') => void;
  setNewItemColor: (color: string) => void;
  setIsModalOpen: (open: boolean) => void;
  onOpenDeckDetail: (deckId: string) => void;
  toggleIgnoreDeck: (deck: Deck, e: React.MouseEvent) => void;
  // Props para StatsView e ReportsView
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  streakRecoveries: string[];
  setStreakRecoveryDate: (dateStr: string | null) => void;
  forecastPeriod: string;
  setForecastPeriod: (period: string) => void;
  calculateStreak: () => number;
  calculateLongestStreak: () => number;
  activityMap: ActivityMap;
  reportPeriod: string;
  setReportPeriod: (period: string) => void;
  reportDeckId: string;
  setReportDeckId: (deckId: string) => void;
  desiredRetention: number;
  calendarEvents?: Record<string, any[]>;
  onUpdateCalendarEvents?: (newEvents: Record<string, any[]>) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  mainTab,
  setMainTab,
  currentFolderId,
  setCurrentFolderId,
  folders,
  validDecks,
  globalStats,
  dailyGoal,
  getDailyCount,
  getDailyCountFiltered,
  getDecksInFolder,
  getFolderStats,
  breadcrumbs,
  activeMenuId,
  setActiveMenuId,
  openCustomStudyModal,
  setCustomStudyConfig,
  setIsCustomStudyModalOpen,
  startReview,
  openEditModal,
  setItemToMove,
  setMoveTargetFolderId,
  setIsMoveModalOpen,
  setItemToDelete,
  setModalMode,
  setModalType,
  setNewItemColor,
  setIsModalOpen,
  onOpenDeckDetail,
  toggleIgnoreDeck,
  calendarMonth,
  setCalendarMonth,
  streakRecoveries,
  setStreakRecoveryDate,
  forecastPeriod,
  setForecastPeriod,
  calculateStreak,
  calculateLongestStreak,
  activityMap,
  reportPeriod,
  setReportPeriod,
  reportDeckId,
  setReportDeckId,
  desiredRetention,
  calendarEvents = {},
  onUpdateCalendarEvents,
}) => {
  const renderStatBadges = (stats: CardStats) => {
    if (calculateTotalDue(stats) === 0) return null;
    return (
      <div
        className="flex flex-wrap gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {stats.new > 0 && (
          <span
            className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.15)]"
            title="Novos"
          >
            {stats.new}
          </span>
        )}
        {stats.learning > 0 && (
          <span
            className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(244,63,94,0.15)]"
            title="Aprender"
          >
            {stats.learning}
          </span>
        )}
        {stats.review > 0 && (
          <span
            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.15)]"
            title="Revisar"
          >
            {stats.review}
          </span>
        )}
      </div>
    );
  };

  const currentFolders = folders.filter((f) => f.parentId === currentFolderId);
  const currentDecks = validDecks.filter((d) => d.parentId === currentFolderId);
  const totalGlobalDue = calculateTotalDue(globalStats);
  const totalUnlearnedGlobal = validDecks
    .filter((d) => !d.isIgnored)
    .flatMap((d) => d.cards || [])
    .filter((c) => isCardUnlearned(c)).length;
  const todayDone = getDailyCount(getTodayStr());
  const goalPct = Math.min(
    Math.round((todayDone / (dailyGoal || 1)) * 100),
    100
  );

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-16 sm:pb-0 animate-in fade-in duration-300">
      {/* NAVEGAÇÃO MOBILE FIXA NO RODAPÉ */}
      <MobileBottomNav
        mainTab={mainTab}
        onSelectTab={(tabId) => {
          setMainTab(tabId);
          setCurrentFolderId(null);
        }}
      />

      {mainTab === 'home' && (
        <div className="animate-in fade-in duration-300 pb-10 space-y-8">
          {currentFolderId === null && (
            <div className="rounded-2xl p-5 sm:p-6 border border-slate-800/80 bg-slate-900/50 shadow-lg">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex flex-col items-start text-left space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight text-left">
                      {getGreeting()}
                    </h2>
                    <span className="text-xs font-medium text-slate-500 bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg">
                      Resumo de hoje
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/90 px-3 py-1.5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                      <span>
                        <strong className="text-white font-bold">
                          {totalGlobalDue}
                        </strong>{' '}
                        pendentes
                      </span>
                    </div>

                    {totalUnlearnedGlobal > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStudyConfig({
                            sourceType: 'all',
                            sourceId: null,
                            preset: 'unlearned',
                            cardType: 'all',
                            tag: 'all',
                            limit: 20,
                          });
                          setIsCustomStudyModalOpen(true);
                        }}
                        className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800/90 text-slate-300 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5 text-rose-400" />
                        <span>
                          <strong className="font-bold text-rose-400">
                            {totalUnlearnedGlobal}
                          </strong>{' '}
                          não aprendidos
                        </span>
                      </button>
                    )}

                    {totalGlobalDue > 0 && (
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/90 text-slate-300 px-3 py-1.5 rounded-xl">
                        <Timer className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          ~
                          <strong>
                            {Math.max(1, Math.ceil(totalGlobalDue * 0.33))} min
                          </strong>
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => openCustomStudyModal('all', null)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Estudo
                      Personalizado
                    </button>
                  </div>
                </div>

                <div className="w-full lg:w-80 xl:w-96 bg-slate-950/70 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center gap-2.5 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs sm:text-sm font-semibold text-slate-200">
                        Meta Diária
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base sm:text-lg font-bold text-white">
                        {todayDone}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        / {dailyGoal}
                      </span>
                      <span className="text-[11px] font-semibold text-indigo-400 ml-1.5">
                        ({goalPct}%)
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-700"
                      style={{ width: `${goalPct}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentFolderId !== null && (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400 bg-slate-900/60 px-4 py-3 rounded-2xl border border-slate-800/90 w-full overflow-x-auto custom-scrollbar">
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-2 transition-colors whitespace-nowrap hover:text-white font-semibold"
              >
                <Home className="w-4 h-4 text-indigo-400" /> Início
              </button>
              {breadcrumbs.map((crumb) => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`transition-colors whitespace-nowrap font-semibold ${
                      currentFolderId === crumb.id
                        ? 'text-indigo-400'
                        : 'hover:text-white'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {currentFolderId !== null && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/70 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                  <FolderIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {folders.find((f) => f.id === currentFolderId)?.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    <strong className="text-indigo-400">
                      {calculateTotalDue(getFolderStats(currentFolderId))}
                    </strong>{' '}
                    pendentes
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 w-full sm:w-auto flex-wrap">
                <button
                  onClick={() => startReview(null, false, currentFolderId)}
                  disabled={
                    calculateTotalDue(getFolderStats(currentFolderId)) === 0
                  }
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    calculateTotalDue(getFolderStats(currentFolderId)) > 0
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" fill="currentColor" /> Estudar Tudo
                </button>
                <button
                  onClick={() => startReview(null, true, currentFolderId)}
                  disabled={
                    calculateTotalDue(getFolderStats(currentFolderId)) === 0 &&
                    getFolderStats(currentFolderId).learned === 0
                  }
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <FastForward className="w-4 h-4" fill="currentColor" /> Modo
                  Livre
                </button>
                <button
                  onClick={() => openCustomStudyModal('folder', currentFolderId)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Personalizar
                </button>
              </div>
            </div>
          )}

          {/* SEÇÃO DE COLEÇÕES */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-slate-200">Coleções</h2>
                <span className="text-xs font-semibold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                  {currentFolders.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {currentFolders.map((folder, index) => {
                const isMenuOpen = activeMenuId === folder.id;
                const colorClass = folder.color || FOLDER_THEMES[0].color;
                const folderDecksCount = getDecksInFolder(folder.id).length;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="bg-slate-900/60 rounded-2xl p-5 border border-slate-800/90 hover:border-slate-700 cursor-pointer flex flex-col justify-between min-h-[136px] group animate-pop hover:-translate-y-0.5 transition-all duration-200"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3 w-full">
                      <div className={`p-2.5 rounded-xl shrink-0 ${colorClass}`}>
                        <FolderIcon className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {renderStatBadges(getFolderStats(folder.id))}
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(isMenuOpen ? null : folder.id);
                            }}
                            className={`p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-all border border-transparent ${
                              isMenuOpen
                                ? 'opacity-100 bg-slate-800 border-slate-700 text-slate-200'
                                : 'opacity-0 group-hover:opacity-100 hover:bg-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                              <button
                                onClick={(e) => {
                                  openEditModal('folder', folder, e);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Pencil className="w-4 h-4 text-indigo-400" />{' '}
                                Editar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToMove({
                                    id: folder.id,
                                    type: 'folder',
                                    name: folder.name,
                                    parentId: folder.parentId,
                                  });
                                  setMoveTargetFolderId(folder.parentId);
                                  setIsMoveModalOpen(true);
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <CornerUpRight className="w-4 h-4 text-slate-400" />{' '}
                                Mover
                              </button>
                              <div className="h-px bg-slate-800 w-full"></div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({
                                    id: folder.id,
                                    type: 'folder',
                                    name: folder.name,
                                  });
                                  setActiveMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full text-left mt-auto">
                      <h3
                        className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors text-base truncate w-full"
                        title={folder.name}
                      >
                        {folder.name}
                      </h3>
                      <span className="text-xs text-slate-500 font-medium block mt-0.5">
                        {folderDecksCount}{' '}
                        {folderDecksCount === 1 ? 'baralho' : 'baralhos'}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div
                onClick={() => {
                  setModalMode('create');
                  setModalType('folder');
                  setNewItemColor(FOLDER_THEMES[0].color);
                  setIsModalOpen(true);
                }}
                className="bg-slate-900/20 rounded-2xl p-5 border border-dashed border-slate-800 hover:border-slate-700 cursor-pointer flex flex-col items-center justify-center min-h-[136px] gap-2 text-slate-500 hover:text-slate-300 animate-pop transition-colors"
              >
                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <span className="font-semibold text-sm">Nova Coleção</span>
              </div>
            </div>
          </div>

          {/* SEÇÃO DE BARALHOS (APENAS DENTRO DE UMA COLEÇÃO) */}
          {currentFolderId !== null && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-base font-bold text-slate-200">
                    Baralhos
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                    {currentDecks.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                {currentDecks.map((deck, index) => {
                  const stats = getCardStats(deck.cards);
                  const due = calculateTotalDue(stats);
                  const isMenuOpen = activeMenuId === deck.id;
                  const colorClass = deck.color || DECK_THEMES[0].color;
                  const playDisabled = due === 0 || deck.isIgnored;
                  const totalDeckCards = deck.cards?.length || 0;
                  const masteryPct =
                    totalDeckCards > 0
                      ? Math.round((stats.learned / totalDeckCards) * 100)
                      : 0;

                  return (
                    <div
                      key={deck.id}
                      onClick={() => onOpenDeckDetail(deck.id)}
                      className={`bg-slate-900/60 rounded-2xl p-5 border border-slate-800/90 hover:border-slate-700 cursor-pointer flex flex-col h-full group relative animate-pop hover:-translate-y-0.5 transition-all duration-200 ${
                        deck.isIgnored ? 'opacity-60 grayscale-[0.3]' : ''
                      }`}
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="flex items-start justify-between mb-4 w-full">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}
                        >
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {deck.isIgnored ? (
                            <span className="bg-slate-800 text-slate-400 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1">
                              <EyeOff className="w-3 h-3" /> Ignorado
                            </span>
                          ) : (
                            renderStatBadges(stats)
                          )}
                          <div
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : deck.id);
                              }}
                              className={`p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-all border border-transparent ${
                                isMenuOpen
                                  ? 'opacity-100 bg-slate-800 border-slate-700 text-slate-200'
                                  : 'opacity-0 group-hover:opacity-100 hover:bg-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                                <button
                                  onClick={(e) => {
                                    toggleIgnoreDeck(deck, e);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  {deck.isIgnored ? (
                                    <Eye className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <EyeOff className="w-4 h-4 text-slate-400" />
                                  )}
                                  {deck.isIgnored
                                    ? 'Ativar Baralho'
                                    : 'Ignorar Baralho'}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCustomStudyModal('deck', deck.id);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />{' '}
                                  Estudo Personalizado
                                </button>
                                <div className="h-px bg-slate-800 w-full"></div>
                                <button
                                  onClick={(e) => {
                                    openEditModal('deck', deck, e);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <Pencil className="w-4 h-4 text-indigo-400" />{' '}
                                  Editar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToMove({
                                      id: deck.id,
                                      type: 'deck',
                                      name: deck.name,
                                      parentId: deck.parentId,
                                    });
                                    setMoveTargetFolderId(deck.parentId);
                                    setIsMoveModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <CornerUpRight className="w-4 h-4 text-slate-400" />{' '}
                                  Mover
                                </button>
                                <div className="h-px bg-slate-800 w-full"></div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete({
                                      id: deck.id,
                                      type: 'deck',
                                      name: deck.name,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" /> Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <h3
                        className="text-base font-bold text-slate-100 mb-1.5 group-hover:text-indigo-300 transition-colors line-clamp-2 break-words w-full"
                        title={deck.name}
                      >
                        {deck.name}
                      </h3>
                      {deck.description ? (
                        <p
                          className="text-slate-400 text-xs flex-grow line-clamp-2 w-full mb-4"
                          title={deck.description}
                        >
                          {deck.description}
                        </p>
                      ) : (
                        <div className="flex-grow mb-2" />
                      )}

                      {totalDeckCards > 0 && (
                        <div className="w-full mb-3">
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
                            <span>Domínio</span>
                            <span className="text-slate-400">{masteryPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                            <div
                              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                              style={{ width: `${masteryPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-800/60 flex justify-between items-center text-xs font-semibold text-slate-400 w-full mt-auto">
                        <span>
                          {totalDeckCards}{' '}
                          {totalDeckCards === 1 ? 'cartão' : 'cartões'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startReview(deck.id);
                          }}
                          disabled={playDisabled}
                          className={`px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all ${
                            !playDisabled
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              : 'bg-slate-800/60 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" fill="currentColor" />{' '}
                          Estudar
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div
                  onClick={() => {
                    setModalMode('create');
                    setModalType('deck');
                    setNewItemColor(DECK_THEMES[0].color);
                    setIsModalOpen(true);
                  }}
                  className="bg-slate-900/20 rounded-2xl p-6 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-colors cursor-pointer min-h-[190px] animate-pop"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-2.5">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm">Novo Baralho</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

{mainTab === 'stats' && (
        <StatsView calculateLongestStreak="{calculateLongestStreak}" calculateStreak="{calculateStreak}" calendarEvents="{calendarEvents}" calendarMonth="{calendarMonth}" forecastPeriod="{forecastPeriod}" getDailyCount="{getDailyCount}" onUpdateCalendarEvents="{onUpdateCalendarEvents}" setCalendarMonth="{setCalendarMonth}" setForecastPeriod="{setForecastPeriod}" setStreakRecoveryDate="{setStreakRecoveryDate}" streakRecoveries="{streakRecoveries}" validDecks="{validDecks}"/>
      )}

      {mainTab === 'reports' && (
        <ReportsView
          validDecks={validDecks}
          activityMap={activityMap}
          reportPeriod={reportPeriod}
          setReportPeriod={setReportPeriod}
          reportDeckId={reportDeckId}
          setReportDeckId={setReportDeckId}
          desiredRetention={desiredRetention}
          getDailyCountFiltered={getDailyCountFiltered}
        />
      )}
    </div>
  );
};