import React from 'react';
import { Palette, Folder, BookOpen, Volume2, Check } from 'lucide-react';
import {
  FOLDER_THEMES,
  DECK_THEMES,
  VOICE_LANGUAGES,
} from '../../constants/themes';

interface FolderDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalMode: 'create' | 'edit';
  modalType: 'folder' | 'deck';
  newItemName: string;
  setNewItemName: (val: string) => void;
  newItemDesc: string;
  setNewItemDesc: (val: string) => void;
  newItemColor: string;
  setNewItemColor: (val: string) => void;
  newItemVoiceLang?: string;
  setNewItemVoiceLang?: (val: string) => void;
  newItemAutoPlay?: boolean;
  setNewItemAutoPlay?: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const FolderDeckModal: React.FC<FolderDeckModalProps> = ({
  isOpen,
  onClose,
  modalMode,
  modalType,
  newItemName,
  setNewItemName,
  newItemDesc,
  setNewItemDesc,
  newItemColor,
  setNewItemColor,
  newItemVoiceLang = 'pt-BR',
  setNewItemVoiceLang,
  newItemAutoPlay = false,
  setNewItemAutoPlay,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold text-slate-100 mb-6">
          {modalMode === 'edit' ? 'Editar ' : 'Criar nov'}
          {modalType === 'folder' ? 'a Pasta' : 'o Baralho'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Nome
            </label>
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
          {modalType === 'deck' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Descrição
                </label>
                <textarea
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20 custom-scrollbar transition-colors"
                />
              </div>

              {setNewItemVoiceLang && (
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-indigo-400" /> Idioma de
                      Voz (Pronúncia)
                    </label>
                    <select
                      value={newItemVoiceLang}
                      onChange={(e) => setNewItemVoiceLang(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      {VOICE_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {setNewItemAutoPlay && (
                    <button
                      type="button"
                      onClick={() => setNewItemAutoPlay(!newItemAutoPlay)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                        newItemAutoPlay
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-medium">
                        Reproduzir áudio automaticamente na frente
                      </span>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                          newItemAutoPlay
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4" /> Estilo Visual
            </label>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {modalType === 'folder' &&
                FOLDER_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setNewItemColor(theme.color)}
                    className={`relative shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      theme.color
                    } ${
                      newItemColor === theme.color
                        ? 'ring-2 ring-white ring-offset-2 ring-slate-900 scale-110 z-10 shadow-lg shadow-black/50'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={theme.label}
                  >
                    <Folder className="w-6 h-6 fill-current opacity-20 absolute" />
                    <Folder className="w-6 h-6 relative z-10" />
                  </button>
                ))}
              {modalType !== 'folder' &&
                DECK_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setNewItemColor(theme.color)}
                    className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                      theme.color
                    } ${
                      newItemColor === theme.color
                        ? 'ring-2 ring-white ring-offset-2 ring-slate-900 scale-110 z-10'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={theme.label}
                  >
                    <BookOpen className="w-6 h-6" />
                  </button>
                ))}
            </div>
          </div>
          <div className="flex gap-3 mt-8 pt-2">
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
              {modalMode === 'edit' ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};