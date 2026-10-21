import React from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Pencil,
  SkipForward,
  PauseCircle,
  Trash2,
  AlertTriangle,
  VolumeX,
  Volume2,
  MoreVertical,
  RefreshCcw,
  X,
  Send,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { Card, SessionStats } from '../../types';
import {
  calculateNextReview,
  formatInterval,
  isCardLeech,
} from '../../utils/fsrs';

interface FinishedViewProps {
  reviewedCount: number;
  onFinish: () => void;
}

export const FinishedView: React.FC<FinishedViewProps> = ({
  reviewedCount,
  onFinish,
}) => (
  <div className="max-w-md mx-auto p-6 min-h-[80vh] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
    <div className="w-24 h-24 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-pop">
      <Sparkles className="w-12 h-12" />
    </div>
    <h1 className="text-3xl font-bold text-slate-100 mb-2">
      Sessão Concluída!
    </h1>
    <p className="text-slate-400 mb-8">
      Reviu <span className="font-bold text-slate-200">{reviewedCount}</span>{' '}
      cartões.
    </p>
    <button
      onClick={onFinish}
      className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
    >
      <CheckCircle2 className="w-5 h-5" /> Concluir
    </button>
  </div>
);

interface ReviewViewProps {
  reviewQueue: Card[];
  currentCardIndex: number;
  desiredRetention: number;
  isFlipped: boolean;
  setIsFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  reviewInteraction: any;
  typedInput: string;
  setTypedInput: (val: string) => void;
  eliminatedOptions: Set<number>;
  toggleEliminateOption: (idx: number) => void;
  handleInteractiveSubmit: (val: any) => void;
  handleAnswer: (quality: number) => void;
  handleUndo: () => void;
  canUndo: boolean;
  onExit: () => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  onEditCurrentCard: (card: Card) => void;
  handleBuryReviewCard: () => void;
  handleSuspendReviewCard: () => void;
  handleDeleteReviewCard: () => void;
  isSpeaking: boolean;
  speakCardText: (htmlContent?: string, e?: React.MouseEvent) => void;
  sessionStats?: SessionStats;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  reviewQueue,
  currentCardIndex,
  desiredRetention,
  isFlipped,
  setIsFlipped,
  reviewInteraction,
  typedInput,
  setTypedInput,
  eliminatedOptions,
  toggleEliminateOption,
  handleInteractiveSubmit,
  handleAnswer,
  handleUndo,
  canUndo,
  onExit,
  activeMenuId,
  setActiveMenuId,
  onEditCurrentCard,
  handleBuryReviewCard,
  handleSuspendReviewCard,
  handleDeleteReviewCard,
  isSpeaking,
  speakCardText,
}) => {
  if (!reviewQueue.length) return null;
  const currentCard = reviewQueue[currentCardIndex];
  if (!currentCard) return null;

  const progress = (currentCardIndex / reviewQueue.length) * 100;
  const intervalLabels = [0, 1, 2, 3].map((q) =>
    formatInterval(calculateNextReview(currentCard, q, desiredRetention).interval)
  );
  const type = currentCard.type || 'standard';
  const leech = isCardLeech(currentCard);

  const normalizedUserTyped = String(reviewInteraction || '')
    .trim()
    .toLowerCase();
  const normalizedExpectedTyped = String(currentCard.typeAnswer || '')
    .trim()
    .toLowerCase();
  const isTypedCorrect = normalizedUserTyped === normalizedExpectedTyped;

  let interactiveSuggestedGrade: number | null = null;
  if (isFlipped && type !== 'standard' && reviewInteraction !== null) {
    if (type === 'choice') {
      interactiveSuggestedGrade =
        reviewInteraction === currentCard.correctOption ? 2 : 0;
    } else if (type === 'tf') {
      interactiveSuggestedGrade =
        reviewInteraction === (currentCard.isTrue !== false) ? 2 : 0;
    } else if (type === 'typing') {
      interactiveSuggestedGrade = isTypedCorrect ? 2 : 0;
    }
  }

  const renderReviewDropdownMenu = (menuKey: string) =>
    activeMenuId === menuKey && (
      <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
        <button
          onClick={() => {
            onEditCurrentCard(currentCard);
            setActiveMenuId(null);
          }}
          className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
        >
          <Pencil className="w-4 h-4" /> Editar Cartão
        </button>
        <button
          onClick={() => {
            handleBuryReviewCard();
            setActiveMenuId(null);
          }}
          className="w-full text-left px-4 py-3 text-sm text-indigo-300 hover:bg-slate-700 flex items-center gap-2"
        >
          <SkipForward className="w-4 h-4" /> Enterrar até amanhã
        </button>
        <button
          onClick={() => {
            handleSuspendReviewCard();
            setActiveMenuId(null);
          }}
          className="w-full text-left px-4 py-3 text-sm text-amber-300 hover:bg-slate-700 flex items-center gap-2"
        >
          <PauseCircle className="w-4 h-4" /> Suspender Cartão
        </button>
        <div className="h-px bg-slate-700 w-full"></div>
        <button
          onClick={() => {
            handleDeleteReviewCard();
            setActiveMenuId(null);
          }}
          className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Excluir Cartão
        </button>
      </div>
    );

  return (
    <div
      className="w-full px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col pb-24"
      onClick={() => setActiveMenuId(null)}
    >
      <div className="flex items-center justify-between mb-8 pt-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="text-slate-500 p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
              canUndo
                ? 'text-indigo-400 hover:bg-indigo-900/30 cursor-pointer'
                : 'text-slate-700 cursor-not-allowed'
            }`}
            title="Desfazer último cartão (Ctrl+Z)"
          >
            <RotateCcw className="w-5 h-5" />{' '}
            <span className="hidden sm:inline text-sm font-bold">Desfazer</span>
          </button>
        </div>
        <div className="flex-grow">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs font-bold text-slate-500 shrink-0">
          {currentCardIndex + 1} / {reviewQueue.length}
        </span>
      </div>

      <div
        className="flex-grow flex flex-col justify-center items-center w-full max-w-5xl mx-auto"
        style={{ perspective: '1000px' }}
      >
        {type === 'standard' && (
          <div key={currentCard.id} className="w-full animate-slide-right">
            <div
              className="relative w-full h-[65vh] min-h-[400px] max-h-[800px] cursor-pointer transition-transform duration-500"
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
              onClick={() => setIsFlipped((prev) => !prev)}
            >
              {/* FRENTE */}
              <div
                className="absolute inset-0 w-full h-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              >
                <div className="p-6 text-left border-b border-slate-800/50 flex justify-between items-center group">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-600 uppercase">
                      Pergunta
                    </span>
                    {leech && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" /> Sanguessuga
                      </span>
                    )}
                    {(currentCard.tags || []).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => speakCardText(currentCard.front, e)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSpeaking
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-800/60 text-slate-400 hover:text-indigo-300 border-slate-700/50'
                      }`}
                      title="Ouvir pronúncia / Ler em voz alta"
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveMenuId(
                            activeMenuId === 'review_menu' ? null : 'review_menu'
                          )
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-800/60 hover:bg-slate-700 hover:text-indigo-300 rounded-lg transition-colors border border-slate-700/50"
                        title="Opções do Cartão"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {renderReviewDropdownMenu('review_menu')}
                    </div>
                    <span className="text-xs text-slate-600 bg-slate-950 px-2 py-1 rounded hidden sm:block">
                      Clique (ou Espaço) para virar
                    </span>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                  <div className="min-h-full flex flex-col justify-center p-6 sm:p-8">
                    <div
                      className="w-full text-2xl sm:text-3xl text-slate-100 text-center anki-content break-words"
                      dangerouslySetInnerHTML={{ __html: currentCard.front }}
                    />
                  </div>
                </div>
              </div>

              {/* VERSO */}
              <div
                className="absolute inset-0 w-full h-full bg-indigo-950/40 rounded-3xl border border-indigo-500/20 flex flex-col shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="p-6 text-left border-b border-indigo-500/20 flex justify-between items-center group">
                  <span className="text-sm font-bold text-indigo-400/50 uppercase">
                    Resposta
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => speakCardText(currentCard.back, e)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSpeaking
                          ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50'
                          : 'bg-indigo-900/40 text-indigo-300/70 hover:text-indigo-200 border-indigo-500/30'
                      }`}
                      title="Ouvir resposta em voz alta"
                    >
                      {isSpeaking ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveMenuId(
                            activeMenuId === 'review_menu_verso'
                              ? null
                              : 'review_menu_verso'
                          )
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-400/70 bg-indigo-900/40 hover:bg-indigo-800 hover:text-indigo-200 rounded-lg transition-colors border border-indigo-500/30"
                        title="Opções do Cartão"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {renderReviewDropdownMenu('review_menu_verso')}
                    </div>
                    <button
                      className="p-2 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-400 rounded-full transition-colors border border-indigo-500/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(false);
                      }}
                      title="Virar Novamente"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                  <div className="min-h-full flex flex-col justify-center p-6 sm:p-8">
                    <div
                      className="w-full text-2xl sm:text-3xl text-indigo-100 text-center anki-content break-words"
                      dangerouslySetInnerHTML={{
                        __html: currentCard.back || '',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {type !== 'standard' && (
          <div
            key={currentCard.id}
            className="w-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl min-h-[400px] max-h-[80vh] animate-slide-right relative group overflow-hidden"
          >
            <div
              className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-slate-800/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {type === 'choice'
                    ? 'Múltipla Escolha'
                    : type === 'tf'
                    ? 'Verdadeiro ou Falso'
                    : 'Digitação'}
                </span>
                {leech && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" /> Sanguessuga
                  </span>
                )}
                {(currentCard.tags || []).map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                  >
                    #{t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) =>
                    speakCardText(
                      `${currentCard.front} ${(currentCard.options || []).join(
                        '. '
                      )}`,
                      e
                    )
                  }
                  className={`p-2 rounded-lg border transition-colors ${
                    isSpeaking
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-indigo-300 border-slate-700'
                  }`}
                  title="Ouvir pergunta em voz alta"
                >
                  {isSpeaking ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveMenuId(
                        activeMenuId === 'review_menu' ? null : 'review_menu'
                      )
                    }
                    className="p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 bg-slate-950 border border-slate-700 rounded-lg transition-colors shadow-md"
                    title="Opções do Cartão"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {renderReviewDropdownMenu('review_menu')}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-grow flex flex-col">
              <div className="p-6 sm:p-8 border-b border-slate-800/50 shrink-0">
                <div
                  className="text-xl sm:text-3xl font-medium text-slate-100 text-center anki-content break-words"
                  dangerouslySetInnerHTML={{ __html: currentCard.front }}
                />
              </div>
              <div className="flex-grow p-6 sm:px-10 bg-slate-950/50 flex flex-col justify-center gap-4">
                {type === 'choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                    {currentCard.options?.map((opt, idx) => {
                      const isEliminated = eliminatedOptions.has(idx);
                      let btnClass =
                        'bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500';

                      if (isFlipped) {
                        if (idx === currentCard.correctOption)
                          btnClass =
                            'bg-emerald-500/20 border-emerald-500 text-emerald-300';
                        else if (reviewInteraction === idx)
                          btnClass =
                            'bg-rose-500/20 border-rose-500 text-rose-300';
                        else btnClass = 'opacity-30';
                      } else if (isEliminated) {
                        btnClass =
                          'bg-slate-950 border-slate-800 text-slate-600 line-through opacity-40 grayscale';
                      }

                      const optsLen = currentCard.options?.length || 0;
                      const isOdd = optsLen % 2 !== 0;
                      const isLast = idx === optsLen - 1;
                      const spanClass = isOdd && isLast ? 'md:col-span-2' : '';

                      return (
                        <div key={idx} className={`relative flex ${spanClass}`}>
                          <button
                            disabled={isFlipped || isEliminated}
                            onClick={() => handleInteractiveSubmit(idx)}
                            className={`w-full p-4 pr-12 rounded-xl border-2 text-left font-medium transition-all flex justify-between items-center text-lg ${btnClass}`}
                          >
                            <span>{opt}</span>
                            <span className="text-xs opacity-30 font-mono hidden sm:block">
                              {idx + 1}
                            </span>
                          </button>
                          {!isFlipped && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEliminateOption(idx);
                              }}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                                isEliminated
                                  ? 'text-indigo-400 hover:text-indigo-300'
                                  : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                              }`}
                              title={
                                isEliminated
                                  ? 'Restaurar alternativa'
                                  : 'Riscar alternativa (Eliminar)'
                              }
                            >
                              {isEliminated ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {type === 'tf' && (
                  <div className="flex gap-4 h-32">
                    <button
                      disabled={isFlipped}
                      onClick={() => handleInteractiveSubmit(true)}
                      className={`flex-1 rounded-2xl border-2 font-bold text-2xl transition-all ${
                        isFlipped
                          ? currentCard.isTrue
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'opacity-30'
                          : 'bg-slate-900 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                      } relative`}
                    >
                      VERDADEIRO{' '}
                      <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">
                        1
                      </span>
                    </button>
                    <button
                      disabled={isFlipped}
                      onClick={() => handleInteractiveSubmit(false)}
                      className={`flex-1 rounded-2xl border-2 font-bold text-2xl transition-all ${
                        isFlipped
                          ? !currentCard.isTrue
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'opacity-30'
                          : 'bg-slate-900 border-rose-500/30 text-rose-500 hover:bg-rose-500/10'
                      } relative`}
                    >
                      FALSO{' '}
                      <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">
                        2
                      </span>
                    </button>
                  </div>
                )}

                {type === 'typing' && (
                  <div className="w-full flex flex-col items-center gap-4">
                    <div className="w-full max-w-lg flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        disabled={isFlipped}
                        value={isFlipped ? reviewInteraction : typedInput}
                        onChange={(e) => setTypedInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          typedInput.trim() &&
                          handleInteractiveSubmit(typedInput)
                        }
                        className={`flex-grow bg-transparent border-b-2 text-center text-2xl sm:text-3xl font-mono p-4 outline-none transition-colors ${
                          !isFlipped
                            ? 'border-indigo-500 text-indigo-300'
                            : isTypedCorrect
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-rose-500 text-rose-400 line-through'
                        }`}
                        placeholder="Digite sua resposta..."
                      />
                      {!isFlipped && (
                        <button
                          type="button"
                          onClick={() =>
                            typedInput.trim() &&
                            handleInteractiveSubmit(typedInput)
                          }
                          disabled={!typedInput.trim()}
                          className={`p-4 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 ${
                            typedInput.trim()
                              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95'
                              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                          title="Confirmar resposta"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    {isFlipped && !isTypedCorrect && (
                      <div className="text-emerald-400 font-mono text-2xl animate-pop text-center">
                        <span className="text-slate-500 text-sm block">
                          Correta:
                        </span>
                        {currentCard.typeAnswer}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isFlipped && currentCard.back && (
              <div className="p-6 bg-indigo-950/30 border-t border-indigo-500/20 text-indigo-100 shrink-0 animate-in fade-in duration-300">
                <div
                  className="anki-content break-words"
                  dangerouslySetInnerHTML={{ __html: currentCard.back }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-32 mt-8 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {!isFlipped && type === 'standard' ? (
          <button
            onClick={() => setIsFlipped(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl py-6 rounded-2xl shadow-lg transition-all active:scale-95"
          >
            Mostrar Resposta
          </button>
        ) : isFlipped ? (
          <div className="grid grid-cols-4 gap-2 sm:gap-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <button
              onClick={() => handleAnswer(0)}
              className={`p-4 sm:py-6 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border rounded-2xl font-bold relative transition-all active:scale-95 text-lg sm:text-xl ${
                interactiveSuggestedGrade === 0
                  ? 'border-rose-400 ring-2 ring-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                  : 'border-rose-500/20'
              }`}
            >
              Errei{' '}
              <span className="text-sm opacity-50 block">
                {intervalLabels[0]}
              </span>
              <span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">
                1
              </span>
            </button>
            <button
              onClick={() => handleAnswer(1)}
              className="p-4 sm:py-6 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl"
            >
              Difícil{' '}
              <span className="text-sm opacity-50 block">
                {intervalLabels[1]}
              </span>
              <span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">
                2
              </span>
            </button>
            <button
              onClick={() => handleAnswer(2)}
              className={`p-4 sm:py-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border rounded-2xl font-bold relative transition-all active:scale-95 text-lg sm:text-xl ${
                interactiveSuggestedGrade === 2
                  ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                  : 'border-emerald-500/20'
              }`}
            >
              Bom{' '}
              <span className="text-sm opacity-50 block">
                {intervalLabels[2]}
              </span>
              <span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">
                3
              </span>
            </button>
            <button
              onClick={() => handleAnswer(3)}
              className="p-4 sm:py-6 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl"
            >
              Fácil{' '}
              <span className="text-sm opacity-50 block">
                {intervalLabels[3]}
              </span>
              <span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">
                4
              </span>
            </button>
          </div>
        ) : (
          <div className="text-center text-slate-500">Responda para avançar</div>
        )}
      </div>
    </div>
  );
};