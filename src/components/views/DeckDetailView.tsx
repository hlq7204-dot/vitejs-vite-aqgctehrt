import React from 'react';
import {
  ArrowLeft,
  BookOpen,
  EyeOff,
  Play,
  FastForward,
  SlidersHorizontal,
  Pencil,
  Plus,
  Check,
  X,
  Tag,
  AlertTriangle,
  Search,
  PlayCircle,
  PauseCircle,
  Trash2,
  CornerUpRight,
} from 'lucide-react';
import type { Card, CardType, Deck } from '../../types';
import { DECK_THEMES, CARD_TYPES } from '../../constants/themes';
import {
  checkCardDue,
  getEffectiveLapses,
  isCardBuried,
  isCardLeech,
  isCardUnlearned,
} from '../../utils/fsrs';
import {
  getCardStats,
  calculateTotalDue,
  parseTagsString,
} from '../../utils/helpers';
import { RichTextEditor } from '../RichTextEditor';

interface DeckDetailViewProps {
  activeDeck: Deck | undefined;
  onBack: () => void;
  startReview: (
    deckId: string | null,
    forceAll?: boolean,
    folderId?: string | null
  ) => void;
  openCustomStudyModal: (
    sourceType?: 'all' | 'folder' | 'deck',
    sourceId?: string | null
  ) => void;
  editingCardId: string | null;
  onCancelEditCard: () => void;
  cardType: CardType | string;
  setCardType: (type: any) => void;
  newCardFront: string;
  setNewCardFront: (val: string) => void;
  newCardBack: string;
  setNewCardBack: (val: string) => void;
  choiceOptions: string[];
  updateChoiceOption: (idx: number, val: string) => void;
  addChoiceOption: () => void;
  removeChoiceOption: (idx: number) => void;
  correctOption: number;
  setCorrectOption: (idx: number) => void;
  tfCorrect: boolean;
  setTfCorrect: (val: boolean) => void;
  typeAnswer: string;
  setTypeAnswer: (val: string) => void;
  cardTagsInput: string;
  setCardTagsInput: (val: string) => void;
  handleSaveCard: (e: React.FormEvent) => void;
  deckSearchQuery: string;
  setDeckSearchQuery: (q: string) => void;
  deckStatusFilter: string;
  setDeckStatusFilter: (status: string) => void;
  deckTypeFilter: string;
  setDeckTypeFilter: (type: string) => void;
  deckTagFilter: string;
  setDeckTagFilter: (tag: string) => void;
  isSelectMode: boolean;
  setIsSelectMode: (val: boolean) => void;
  selectedCardIds: Set<string>;
  setSelectedCardIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleCardSelection: (id: string) => void;
  editCard: (card: Card) => void;
  toggleSuspendCard: (cardId: string) => void;
  deleteCard: (cardId: string) => void;
  onOpenMoveCardsModal: () => void;
}

export const DeckDetailView: React.FC<DeckDetailViewProps> = ({
  activeDeck,
  onBack,
  startReview,
  openCustomStudyModal,
  editingCardId,
  onCancelEditCard,
  cardType,
  setCardType,
  newCardFront,
  setNewCardFront,
  newCardBack,
  setNewCardBack,
  choiceOptions,
  updateChoiceOption,
  addChoiceOption,
  removeChoiceOption,
  correctOption,
  setCorrectOption,
  tfCorrect,
  setTfCorrect,
  typeAnswer,
  setTypeAnswer,
  cardTagsInput,
  setCardTagsInput,
  handleSaveCard,
  deckSearchQuery,
  setDeckSearchQuery,
  deckStatusFilter,
  setDeckStatusFilter,
  deckTypeFilter,
  setDeckTypeFilter,
  deckTagFilter,
  setDeckTagFilter,
  isSelectMode,
  setIsSelectMode,
  selectedCardIds,
  setSelectedCardIds,
  toggleCardSelection,
  editCard,
  toggleSuspendCard,
  deleteCard,
  onOpenMoveCardsModal,
}) => {
  if (!activeDeck) return null;
  const stats = getCardStats(activeDeck.cards);
  const due = calculateTotalDue(stats);

  const getCardStatusCategory = (card: Card) => {
    if (card.isSuspended) return 'suspended';
    const cardState =
      card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
    if (cardState === 0 || card.reviews === 0) return 'new';
    if (cardState === 1 || cardState === 3 || card.interval < 1)
      return 'learning';
    if (checkCardDue(card)) return 'review';
    return 'learned';
  };

  const allDeckCards = (activeDeck.cards || []).slice().reverse();
  const leechCount = allDeckCards.filter((c) => isCardLeech(c)).length;
  const unlearnedCount = allDeckCards.filter((c) => isCardUnlearned(c)).length;
  const deckTags = Array.from(
    new Set(allDeckCards.flatMap((c) => c.tags || []))
  ).sort();

  const filteredDeckCards = allDeckCards.filter((card) => {
    if (deckTypeFilter !== 'all' && (card.type || 'standard') !== deckTypeFilter)
      return false;
    if (deckTagFilter !== 'all' && !(card.tags || []).includes(deckTagFilter))
      return false;
    if (deckStatusFilter !== 'all') {
      if (deckStatusFilter === 'leech') {
        if (!isCardLeech(card)) return false;
      } else if (deckStatusFilter === 'unlearned') {
        if (!isCardUnlearned(card)) return false;
      } else if (getCardStatusCategory(card) !== deckStatusFilter) {
        return false;
      }
    }
    if (deckSearchQuery.trim() !== '') {
      const q = deckSearchQuery.toLowerCase().trim().replace(/^#/, '');
      const frontText = (card.front || '')
        .replace(/<[^>]*>/g, ' ')
        .toLowerCase();
      const backText = (card.back || '')
        .replace(/<[^>]*>/g, ' ')
        .toLowerCase();
      const typeAns = (card.typeAnswer || '').toLowerCase();
      const optsText = (card.options || []).join(' ').toLowerCase();
      const tagsText = (card.tags || []).join(' ').toLowerCase();
      if (
        !frontText.includes(q) &&
        !backText.includes(q) &&
        !typeAns.includes(q) &&
        !optsText.includes(q) &&
        !tagsText.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pt-2 pb-20 animate-in slide-in-from-right-4 fade-in duration-300">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-slate-900/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-slate-800 mb-8 flex flex-col gap-6 relative group">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                activeDeck.color || DECK_THEMES[0].color
              }`}
            >
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                {activeDeck.name}
                {activeDeck.isIgnored && (
                  <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-1 rounded border border-slate-700 flex items-center gap-1 uppercase tracking-wider">
                    <EyeOff className="w-3 h-3" /> Ignorado
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap">
            <button
              onClick={() => startReview(activeDeck.id)}
              disabled={due === 0 || activeDeck.isIgnored}
              className={`px-6 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
                due > 0 && !activeDeck.isIgnored
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Play className="w-4 h-4" fill="currentColor" /> Revisar{' '}
              <span className="bg-black/20 text-indigo-100 px-2 py-0.5 rounded-full text-xs ml-1">
                {activeDeck.isIgnored ? '0' : due}
              </span>
            </button>
            <button
              onClick={() => startReview(activeDeck.id, true)}
              disabled={!activeDeck.cards || activeDeck.cards.length === 0}
              className={`px-5 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
                activeDeck.cards?.length > 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'
              }`}
              title="Adiantar"
            >
              <FastForward className="w-4 h-4" fill="currentColor" /> Estudo
              Livre
            </button>
            <button
              onClick={() => openCustomStudyModal('deck', activeDeck.id)}
              disabled={!activeDeck.cards || activeDeck.cards.length === 0}
              className={`px-5 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
                activeDeck.cards?.length > 0
                  ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'
              }`}
              title="Estudo Personalizado / Simulado"
            >
              <SlidersHorizontal className="w-4 h-4" /> Personalizar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 pt-6 border-t border-slate-800/50">
          <div className="bg-slate-950/50 rounded-xl p-4 border border-blue-500/20 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-blue-400 mb-1">
              {stats.new}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Novos
            </span>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-4 border border-rose-500/20 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-rose-400 mb-1">
              {stats.learning}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aprender
            </span>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-4 border border-emerald-500/20 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-emerald-400 mb-1">
              {stats.review}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Revisar
            </span>
          </div>
          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 flex flex-col items-center justify-center opacity-80">
            <span className="text-3xl font-black text-slate-300 mb-1">
              {stats.learned}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Aprendidos
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 sticky top-6">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
              {editingCardId ? (
                <Pencil className="w-5 h-5 text-indigo-400" />
              ) : (
                <Plus className="w-5 h-5 text-indigo-400" />
              )}{' '}
              {editingCardId ? 'Editar Cartão' : 'Novo Cartão'}
            </h3>

            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded-xl mb-6 border border-slate-800">
              {CARD_TYPES.map((type) => {
                const IconComp = type.Icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setCardType(type.id)}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      cardType === type.id
                        ? 'bg-indigo-500/20 text-indigo-400 shadow-sm border border-indigo-500/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <IconComp className="w-4 h-4" /> {type.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              <RichTextEditor
                label="Frente"
                placeholder=""
                value={newCardFront}
                onChange={setNewCardFront}
              />

              {cardType === 'choice' && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-sm font-medium text-slate-400">
                    Opções
                  </label>
                  {choiceOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrectOption(idx)}
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          correctOption === idx
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-700 text-transparent hover:border-slate-500'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateChoiceOption(idx, e.target.value)}
                        className={`w-full bg-slate-950 border text-sm rounded-lg p-2 focus:outline-none transition-colors ${
                          correctOption === idx
                            ? 'border-emerald-500/50 text-emerald-100'
                            : 'border-slate-800 text-slate-300 focus:border-indigo-500'
                        }`}
                        placeholder=""
                      />
                      {choiceOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeChoiceOption(idx)}
                          className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {choiceOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={addChoiceOption}
                      className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 mt-2 p-1"
                    >
                      <Plus className="w-4 h-4" /> Adicionar opção
                    </button>
                  )}
                </div>
              )}

              {cardType === 'tf' && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Qual a certa?
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTfCorrect(true)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all ${
                        tfCorrect
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      Verdadeiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setTfCorrect(false)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all ${
                        !tfCorrect
                          ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      Falso
                    </button>
                  </div>
                </div>
              )}

              {cardType === 'typing' && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Gabarito
                  </label>
                  <input
                    type="text"
                    value={typeAnswer}
                    onChange={(e) => setTypeAnswer(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-indigo-300 font-mono rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder=""
                  />
                </div>
              )}

              <div className="pt-2 border-t border-slate-800">
                <RichTextEditor
                  label="Verso"
                  placeholder=""
                  value={newCardBack}
                  onChange={setNewCardBack}
                />
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" /> Etiquetas
                  (#tags)
                </label>
                <input
                  type="text"
                  value={cardTagsInput}
                  onChange={(e) => setCardTagsInput(e.target.value)}
                  placeholder="Ex: #importante #formula #edital"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {deckTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {deckTags.slice(0, 8).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const current = parseTagsString(cardTagsInput);
                          if (current.includes(t)) {
                            setCardTagsInput(
                              current
                                .filter((x) => x !== t)
                                .map((x) => `#${x}`)
                                .join(' ')
                            );
                          } else {
                            setCardTagsInput(
                              [...current, t].map((x) => `#${x}`).join(' ')
                            );
                          }
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                          parseTagsString(cardTagsInput).includes(t)
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                {editingCardId && (
                  <button
                    type="button"
                    onClick={onCancelEditCard}
                    className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className={`bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors border border-indigo-500/50 ${
                    editingCardId ? 'w-2/3' : 'w-full'
                  }`}
                >
                  {editingCardId ? 'Guardar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4 relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              Cartões
              <span className="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full text-xs">
                {filteredDeckCards.length !== allDeckCards.length
                  ? `${filteredDeckCards.length} de ${allDeckCards.length}`
                  : allDeckCards.length}
              </span>
              {leechCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDeckStatusFilter(
                      deckStatusFilter === 'leech' ? 'all' : 'leech'
                    )
                  }
                  className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border transition-all ${
                    deckStatusFilter === 'leech'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                  }`}
                  title="Filtrar cartões difíceis (Sanguessugas)"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> {leechCount}{' '}
                  {leechCount === 1 ? 'sanguessuga' : 'sanguessugas'}
                </button>
              )}
            </h3>
            {activeDeck.cards?.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isSelectMode && (
                  <button
                    onClick={() => {
                      const targetIds = filteredDeckCards.map((c) => c.id);
                      const allFilteredSelected =
                        targetIds.length > 0 &&
                        targetIds.every((id) => selectedCardIds.has(id));
                      if (allFilteredSelected) {
                        setSelectedCardIds(new Set());
                      } else {
                        setSelectedCardIds(new Set(targetIds));
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors flex-1 sm:flex-none"
                  >
                    {filteredDeckCards.length > 0 &&
                    filteredDeckCards.every((c) => selectedCardIds.has(c.id))
                      ? 'Desmarcar Visíveis'
                      : 'Selecionar Visíveis'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setSelectedCardIds(new Set());
                  }}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors flex-1 sm:flex-none ${
                    isSelectMode
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isSelectMode ? 'Concluir Seleção' : 'Selecionar Múltiplos'}
                </button>
              </div>
            )}
          </div>

          {allDeckCards.length > 0 && (
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/90 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-grow">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={deckSearchQuery}
                    onChange={(e) => setDeckSearchQuery(e.target.value)}
                    placeholder="Buscar texto na frente, verso ou gabarito..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl py-2.5 pl-10 pr-9 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {deckSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDeckSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <select
                  value={deckTypeFilter}
                  onChange={(e) => setDeckTypeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs sm:text-sm font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="all">Todos os Tipos</option>
                  <option value="standard">Padrão</option>
                  <option value="choice">Múltipla Escolha</option>
                  <option value="tf">Verdadeiro / Falso</option>
                  <option value="typing">Digitação</option>
                </select>
                {deckTags.length > 0 && (
                  <select
                    value={deckTagFilter}
                    onChange={(e) => setDeckTagFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-indigo-300 text-xs sm:text-sm font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="all">Todas as #tags</option>
                    {deckTags.map((t) => (
                      <option key={t} value={t}>
                        #{t}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'unlearned', label: `Não Aprendidos (${unlearnedCount})` },
                  { id: 'new', label: 'Novos' },
                  { id: 'learning', label: 'Aprender' },
                  { id: 'review', label: 'Revisar' },
                  { id: 'learned', label: 'Aprendidos' },
                  { id: 'leech', label: 'Sanguessugas' },
                  { id: 'suspended', label: 'Suspensos' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDeckStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                      deckStatusFilter === tab.id
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                        : 'bg-slate-950/70 text-slate-400 border-slate-800/80 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredDeckCards.map((card) => {
            const cardState =
              card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
            let statusLabel = '';
            let statusColor = '';
            if (card.isSuspended) {
              statusLabel = 'Suspenso';
              statusColor = 'text-slate-400 bg-slate-800/90 border-slate-600';
            } else if (isCardBuried(card)) {
              statusLabel = 'Enterrado até amanhã';
              statusColor =
                'text-indigo-300 bg-indigo-500/10 border-indigo-500/30';
            } else if (cardState === 0 || card.reviews === 0) {
              statusLabel = 'Novo';
              statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            } else if (cardState === 1 || cardState === 3 || card.interval < 1) {
              statusLabel = 'Aprender';
              statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            } else if (checkCardDue(card)) {
              statusLabel = 'Revisar';
              statusColor =
                'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            } else {
              statusLabel = 'Aprendido';
              statusColor = 'text-slate-400 bg-slate-800 border-slate-700';
            }

            const leech = isCardLeech(card);
            const typeObj =
              CARD_TYPES.find((t) => t.id === (card.type || 'standard')) ||
              CARD_TYPES[0];
            const TypeIconComp = typeObj.Icon;

            return (
              <div
                key={card.id}
                className={`bg-slate-900/80 p-5 rounded-2xl border flex items-start gap-3 sm:gap-4 group transition-all duration-300 anki-content ${
                  card.isSuspended ? 'opacity-60' : ''
                } ${
                  isSelectMode && selectedCardIds.has(card.id)
                    ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : leech
                    ? 'border-amber-500/40 hover:border-amber-500/60'
                    : editingCardId === card.id
                    ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : 'border-slate-800 hover:border-slate-700 hover:-translate-y-1'
                } ${isSelectMode ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isSelectMode) toggleCardSelection(card.id);
                }}
              >
                {isSelectMode && (
                  <div className="flex items-center h-full mr-4 pt-1 shrink-0">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                        selectedCardIds.has(card.id)
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-600 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow pr-2 sm:pr-4">
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        <TypeIconComp className="w-3 h-3" /> {typeObj.label}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                      {leech && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          title={`Cartão difícil (Dificuldade FSRS: ${
                            card.difficulty ? card.difficulty.toFixed(1) : '--'
                          } • Lapsos em revisão: ${getEffectiveLapses(
                            card
                          )}). Considere simplificar ou dividir este cartão.`}
                        >
                          <AlertTriangle className="w-3 h-3" /> Sanguessuga{' '}
                          {card.difficulty
                            ? `(D: ${card.difficulty.toFixed(1)})`
                            : ''}
                        </span>
                      )}
                      {(card.tags || []).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeckTagFilter(deckTagFilter === t ? 'all' : t);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                    <div
                      className="text-slate-200 font-medium text-sm sm:text-base break-words"
                      dangerouslySetInnerHTML={{ __html: card.front }}
                    />
                  </div>
                  <div className="pt-4 md:pt-8 border-t border-slate-800 md:border-0 max-h-64 overflow-y-auto custom-scrollbar">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      {card.type === 'standard'
                        ? 'Verso'
                        : card.type === 'typing'
                        ? `Gabarito: ${card.typeAnswer}`
                        : card.type === 'tf'
                        ? `Gabarito: ${card.isTrue ? 'V' : 'F'}`
                        : 'Detalhes'}
                    </span>
                    <div
                      className="text-slate-400 text-sm sm:text-base break-words"
                      dangerouslySetInnerHTML={{ __html: card.back || '' }}
                    />
                  </div>
                </div>
                {!isSelectMode && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editCard(card);
                      }}
                      className="text-slate-600 hover:text-indigo-400 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-indigo-500/10"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSuspendCard(card.id);
                      }}
                      className={`p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg ${
                        card.isSuspended
                          ? 'text-amber-400 hover:bg-amber-500/10 opacity-100'
                          : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'
                      }`}
                      title={
                        card.isSuspended
                          ? 'Reativar Cartão'
                          : 'Suspender Cartão'
                      }
                    >
                      {card.isSuspended ? (
                        <PlayCircle className="w-4 h-4" />
                      ) : (
                        <PauseCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCard(card.id);
                      }}
                      className="text-slate-600 hover:text-red-400 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {allDeckCards.length > 0 && filteredDeckCards.length === 0 && (
            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center gap-2">
              <span>Nenhum cartão corresponde aos filtros aplicados.</span>
              <button
                type="button"
                onClick={() => {
                  setDeckSearchQuery('');
                  setDeckStatusFilter('all');
                  setDeckTypeFilter('all');
                  setDeckTagFilter('all');
                }}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {(!activeDeck.cards || activeDeck.cards.length === 0) && (
            <div className="text-center py-10 text-slate-600 border border-dashed border-slate-800 rounded-2xl">
              Este baralho está vazio.
            </div>
          )}

          {selectedCardIds.size > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-slate-700 flex items-center gap-4 z-50 animate-pop">
              <span className="text-slate-200 font-bold whitespace-nowrap">
                <span className="text-indigo-400">{selectedCardIds.size}</span>{' '}
                selecionados
              </span>
              <div className="w-px h-6 bg-slate-700"></div>
              <button
                onClick={onOpenMoveCardsModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <CornerUpRight className="w-4 h-4" /> Mover
              </button>
              <button
                onClick={() => setSelectedCardIds(new Set())}
                className="text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl font-medium transition-colors hidden sm:block"
              >
                Desmarcar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};