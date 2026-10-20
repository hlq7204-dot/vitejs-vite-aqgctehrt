import React from 'react';
import { History, CornerUpRight, Trash2 } from 'lucide-react';
import type { Deck, FolderPathOption, ItemToDelete, ItemToMove } from '../../types';

interface StreakRecoveryModalProps {
  streakRecoveryDate: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const StreakRecoveryModal: React.FC<StreakRecoveryModalProps> = ({
  streakRecoveryDate,
  onClose,
  onConfirm,
}) => {
  if (!streakRecoveryDate) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
          <History className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">
          Recuperar Ofensiva?
        </h3>
        <p className="text-slate-400 mb-6 text-sm">
          Usar recuperação para o dia{' '}
          {streakRecoveryDate.split('-').reverse().join('/')}. Isso manterá sua
          ofensiva viva.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            Recuperar
          </button>
        </div>
      </div>
    </div>
  );
};

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToMove: ItemToMove | null;
  moveTargetFolderId: string | null;
  setMoveTargetFolderId: (id: string | null) => void;
  folderPaths: FolderPathOption[];
  onConfirm: () => void;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  itemToMove,
  moveTargetFolderId,
  setMoveTargetFolderId,
  folderPaths,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <CornerUpRight className="w-6 h-6 text-indigo-400" /> Mover "
          {itemToMove?.name}"
        </h3>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-400">
            Selecionar Destino
          </label>
          <select
            value={moveTargetFolderId || ''}
            onChange={(e) =>
              setMoveTargetFolderId(
                e.target.value === '' ? null : e.target.value
              )
            }
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {folderPaths.map((path) => (
              <option key={path.id || 'root'} value={path.id || ''}>
                {path.path}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            Mover
          </button>
        </div>
      </div>
    </div>
  );
};

interface MoveCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  moveCardsTargetDeckId: string | null;
  setMoveCardsTargetDeckId: (id: string | null) => void;
  availableDecks: Deck[];
  onConfirm: () => void;
}

export const MoveCardsModal: React.FC<MoveCardsModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  moveCardsTargetDeckId,
  setMoveCardsTargetDeckId,
  availableDecks,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2">
          <CornerUpRight className="w-6 h-6 text-indigo-400" /> Mover{' '}
          {selectedCount} cartões
        </h3>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-400">
            Selecionar Baralho de Destino
          </label>
          <select
            value={moveCardsTargetDeckId || ''}
            onChange={(e) =>
              setMoveCardsTargetDeckId(
                e.target.value === '' ? null : e.target.value
              )
            }
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="" disabled>
              Escolha um baralho...
            </option>
            {availableDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800/50">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!moveCardsTargetDeckId}
            className={`flex-1 font-medium py-3 rounded-xl transition-all shadow-lg active:scale-95 ${
              moveCardsTargetDeckId
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  itemToDelete: ItemToDelete | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  itemToDelete,
  onClose,
  onConfirm,
}) => {
  if (!itemToDelete) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <Trash2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">
          Eliminar {itemToDelete.type === 'folder' ? 'Pasta' : 'Baralho'}?
        </h3>
        <p className="text-slate-400 mb-6 text-sm">Esta ação é irreversível.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-rose-500/25 active:scale-95"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};