import React, { useState, useEffect } from 'react';
import {
  Pencil,
  Check,
  X,
  Plus,
  Tag,
  Volume2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CARD_TYPES } from '../../constants/themes';
import { RichTextEditor } from '../RichTextEditor';
import type { CardType } from '../../types';

interface CardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardType: CardType | string;
  setCardType: (type: any) => void;
  newCardFront: string;
  setNewCardFront: (val: string) => void;
  newCardBack: string;
  setNewCardBack: (val: string) => void;
  newCardPhonetic?: string;
  setNewCardPhonetic?: (val: string) => void;
  newCardHint?: string;
  setNewCardHint?: (val: string) => void;
  newCardMnemonic?: string;
  setNewCardMnemonic?: (val: string) => void;
  newCardAudioOnly?: boolean;
  setNewCardAudioOnly?: (val: boolean) => void;
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
  onSave: (e: React.FormEvent) => void;
}

export const CardEditModal: React.FC<CardEditModalProps> = ({
  isOpen,
  onClose,
  cardType,
  setCardType,
  newCardFront,
  setNewCardFront,
  newCardBack,
  setNewCardBack,
  newCardPhonetic = '',
  setNewCardPhonetic,
  newCardHint = '',
  setNewCardHint,
  newCardMnemonic = '',
  setNewCardMnemonic,
  newCardAudioOnly = false,
  setNewCardAudioOnly,
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
  onSave,
}) => {
  const [showExtraFields, setShowExtraFields] = useState(false);

  useEffect(() => {
    if (isOpen && (newCardPhonetic || newCardHint || newCardMnemonic)) {
      setShowExtraFields(true);
    }
  }, [isOpen, newCardPhonetic, newCardHint, newCardMnemonic]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-slate-200 mb-6 flex items-center gap-2 shrink-0">
          <Pencil className="w-5 h-5 text-indigo-400" /> Editar Cartão
        </h3>

        <div className="overflow-y-auto custom-scrollbar pr-2 flex-grow">
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

          <form
            id="edit-card-form"
            onSubmit={(e) => {
              onSave(e);
              onClose();
            }}
            className="space-y-4"
          >
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

            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              {setNewCardAudioOnly && (
                <button
                  type="button"
                  onClick={() => setNewCardAudioOnly(!newCardAudioOnly)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                    newCardAudioOnly
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                    <Volume2
                      className={`w-4 h-4 shrink-0 ${
                        newCardAudioOnly ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    />
                    Modo Apenas Áudio (ocultar texto da frente)
                  </span>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                      newCardAudioOnly
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : 'bg-slate-900 border-slate-700 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </div>
                </button>
              )}

              {(setNewCardPhonetic || setNewCardHint || setNewCardMnemonic) && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowExtraFields((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>Campos extras (Fonética, Dica, Mnemônico)</span>
                    {showExtraFields ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showExtraFields && (
                    <div className="space-y-3 mt-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      {setNewCardPhonetic && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Transcrição Fonética (Pinyin / IPA)
                          </label>
                          <input
                            type="text"
                            value={newCardPhonetic}
                            onChange={(e) => setNewCardPhonetic(e.target.value)}
                            placeholder="Opcional..."
                            className="w-full bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {setNewCardHint && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Dica (exibida na frente sob demanda)
                          </label>
                          <input
                            type="text"
                            value={newCardHint}
                            onChange={(e) => setNewCardHint(e.target.value)}
                            placeholder="Opcional..."
                            className="w-full bg-slate-900 border border-slate-800 text-amber-200 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {setNewCardMnemonic && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Mnemônico / Observação (exibido no verso)
                          </label>
                          <textarea
                            value={newCardMnemonic}
                            onChange={(e) => setNewCardMnemonic(e.target.value)}
                            placeholder="Opcional..."
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 resize-none h-20 custom-scrollbar"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" /> Etiquetas (#tags)
              </label>
              <input
                type="text"
                value={cardTagsInput}
                onChange={(e) => setCardTagsInput(e.target.value)}
                placeholder="Digite as #tags separadas por espaço..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </form>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-card-form"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            Guardar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};