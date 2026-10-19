import { Layers, List, CheckSquare, Keyboard } from 'lucide-react';
import type { Folder, Deck, ThemeOption, CardTypeOption } from '../types';

export const initialFolders: Folder[] = [];
export const initialDecks: Deck[] = [];

export const FOLDER_THEMES: ThemeOption[] = [
  { id: 'indigo', label: 'Índigo', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
  { id: 'blue', label: 'Azul', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  { id: 'cyan', label: 'Ciano', color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
  { id: 'teal', label: 'Teal', color: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' },
  { id: 'emerald', label: 'Esmeralda', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
  { id: 'lime', label: 'Lima', color: 'bg-lime-500/10 text-lime-400 border border-lime-500/20' },
  { id: 'amber', label: 'Âmbar', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
  { id: 'orange', label: 'Laranja', color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  { id: 'rose', label: 'Rosa', color: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
  { id: 'fuchsia', label: 'Fúcsia', color: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' },
  { id: 'violet', label: 'Violeta', color: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
  { id: 'slate', label: 'Cinza', color: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' },
];

export const DECK_THEMES: ThemeOption[] = [
  { id: 'ocean', label: 'Oceano', color: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' },
  { id: 'forest', label: 'Floresta', color: 'bg-gradient-to-br from-emerald-400 to-green-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' },
  { id: 'fire', label: 'Fogo', color: 'bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' },
  { id: 'sunset', label: 'Pôr do Sol', color: 'bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-[0_0_15px_rgba(251,113,133,0.4)]' },
  { id: 'grape', label: 'Uva', color: 'bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' },
  { id: 'gold', label: 'Ouro', color: 'bg-gradient-to-br from-yellow-300 to-amber-600 text-slate-900 shadow-[0_0_15px_rgba(252,211,77,0.4)]' },
  { id: 'abyss', label: 'Abismo', color: 'bg-gradient-to-br from-slate-900 to-black border border-slate-800 text-indigo-400 shadow-inner' },
  { id: 'cyberpunk', label: 'Cyberpunk', color: 'bg-slate-950 border border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)] text-fuchsia-400' },
  { id: 'toxic', label: 'Tóxico', color: 'bg-slate-950 border border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.5)] text-lime-400' },
  { id: 'hologram', label: 'Holograma', color: 'bg-gradient-to-tr from-cyan-300 via-indigo-400 to-fuchsia-400 text-white shadow-[0_0_20px_rgba(129,140,248,0.5)]' },
  { id: 'blood', label: 'Sangue', color: 'bg-gradient-to-br from-red-700 to-slate-900 border border-red-500/50 text-red-100 shadow-[0_0_15px_rgba(220,38,38,0.4)]' },
];

export const CARD_TYPES: CardTypeOption[] = [
  { id: 'standard', label: 'Padrão', Icon: Layers },
  { id: 'choice', label: 'Escolha', Icon: List },
  { id: 'tf', label: 'V/F', Icon: CheckSquare },
  { id: 'typing', label: 'Digitação', Icon: Keyboard },
];

export const globalStyles = `
  body, html { margin: 0; padding: 0; width: 100%; min-height: 100vh; overflow-x: hidden; background-color: #020617; }
  #root { width: 100%; min-height: 100vh; }
  :fullscreen { width: 100vw; height: 100vh; background-color: #020617; }
  ::backdrop { background-color: #020617; }

  .anki-content img { max-width: 100%; max-height: 50vh; object-fit: contain; border-radius: 0.5rem; margin: 0.5rem auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
  .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
  
  @keyframes popIn {
    0% { opacity: 0; transform: scale(0.95) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .animate-pop { animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  
  @keyframes slideInRight {
    0% { opacity: 0; transform: translateX(40px); }
    100% { opacity: 1; transform: translateX(0); }
  }
  .animate-slide-right { animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-float { animation: float 4s ease-in-out infinite; }

  .delay-100 { animation-delay: 100ms; }
  .delay-200 { animation-delay: 200ms; }
  .delay-300 { animation-delay: 300ms; }
  .delay-400 { animation-delay: 400ms; }

  .chart-scroll-container {
    overflow-x: auto;
    overflow-y: visible;
    scroll-behavior: smooth;
  }
  
  .chart-scroll-container::-webkit-scrollbar {
    height: 4px;
  }
  .chart-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .chart-scroll-container::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 4px;
  }
`;