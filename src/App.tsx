// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

// --- GARANTIA DE DESIGN E BLOQUEIO DE TRADUÇÃO ---
if (typeof document !== 'undefined') {
  document.documentElement.lang = 'pt-BR';
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  
  if (!document.querySelector('meta[name="google"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }
  
  if (!document.getElementById('tailwind-cdn')) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }
}

// --- ÍCONES ---
import { 
  BookOpen, Plus, Play, ArrowLeft, CheckCircle2, BrainCircuit, Trash2, 
  Sparkles, Folder, ChevronRight, ChevronLeft, FolderPlus, Upload, 
  Loader2, Info, RefreshCcw, Pencil, MoreVertical, Palette, Layers, List, 
  CheckSquare, Keyboard, Check, FastForward, CalendarDays, Target, 
  PieChart, Timer, Pause, RotateCcw, Settings, Home, Library, Flame, BarChart2, LogOut,
  Maximize, Minimize, Activity, TrendingUp, Filter, Award, CornerUpRight
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyBBSo5uUqvyMuQ_9cZ8KOgQ3VovKZjO2p8",
      authDomain: "flash-cards-539e8.firebaseapp.com",
      projectId: "flash-cards-539e8",
      storageBucket: "flash-cards-539e8.firebasestorage.app",
      messagingSenderId: "547789982172",
      appId: "1:547789982172:web:d9d9f38f3bc02d05382719",
      measurementId: "G-6G02K580GK"
    };

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
}

const appIdRaw = typeof __app_id !== 'undefined' ? String(__app_id) : 'flashcards-app';
const appId = appIdRaw.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '');

const initialFolders = [];
const initialDecks = [];

const FOLDER_THEMES = [
  { id: 'indigo', label: 'Índigo', color: 'text-indigo-400' },
  { id: 'blue', label: 'Azul', color: 'text-blue-400' },
  { id: 'emerald', label: 'Esmeralda', color: 'text-emerald-400' },
  { id: 'rose', label: 'Rosa', color: 'text-rose-400' },
  { id: 'amber', label: 'Âmbar', color: 'text-amber-400' },
];

const DECK_THEMES = [
  { id: 'classic-blue', label: 'Clássico', color: 'bg-blue-500 text-white' },
  { id: 'ocean', label: 'Oceano', color: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-blue-500/30' },
  { id: 'fire', label: 'Fogo', color: 'bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-lg shadow-orange-500/30' },
  { id: 'midnight', label: 'Noturno', color: 'bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-500 text-slate-300' },
  { id: 'cyberpunk', label: 'Cyberpunk', color: 'bg-slate-900 border border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)] text-fuchsia-400' }
];

const CARD_TYPES = [
  { id: 'standard', label: 'Padrão', Icon: Layers },
  { id: 'choice', label: 'Escolha', Icon: List },
  { id: 'tf', label: 'V/F', Icon: CheckSquare },
  { id: 'typing', label: 'Digitação', Icon: Keyboard }
];

// --- MOTOR DE ANIMAÇÕES E ESTILOS GLOBAIS ---
const globalStyles = `
  body, html { margin: 0; padding: 0; width: 100%; min-height: 100vh; overflow-x: hidden; background-color: #020617; }
  #root { width: 100%; min-height: 100vh; }
  :fullscreen { width: 100vw; height: 100vh; background-color: #020617; }
  ::backdrop { background-color: #020617; }

  .anki-content img { max-width: 100%; max-height: 250px; border-radius: 0.5rem; margin: 0.5rem auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
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
    overflow-y: hidden;
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

// ============================================================================
// ALGORITMO FSRS v6.1.1 (Free Spaced Repetition Scheduler) + Anki Native Steps
// ============================================================================

const w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const requestRetention = 0.9;
const maximumInterval = 36500;
const DECAY = -w[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const enable_fuzz = true;
const LEARNING_STEPS = [1, 10]; // Passos Nativos do Anki (em minutos)

const ratings = { "again": 1, "hard": 2, "good": 3, "easy": 4 };

function generate_fuzz_factor(card) {
  const seedStr = `${card.id}_${card.reviews || 0}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function constrain_difficulty(difficulty) { return Math.min(Math.max(+Number(difficulty).toFixed(2), 1), 10); }

function apply_fuzz(ivl, fuzz_factor) {
  if (!enable_fuzz || ivl < 2.5) return Math.round(ivl);
  ivl = Math.round(ivl);
  let min_ivl = Math.max(2, Math.round(ivl * 0.95 - 1));
  let max_ivl = Math.round(ivl * 1.05 + 1);
  return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
}

function forgetting_curve(elapsed_days, stability) { return Math.pow(1 + FACTOR * elapsed_days / stability, DECAY); }

function next_interval(stability, fuzz_factor) {
  const new_interval = apply_fuzz(stability / FACTOR * (Math.pow(requestRetention, 1 / DECAY) - 1), fuzz_factor);
  return Math.min(Math.max(Math.round(new_interval), 1), maximumInterval);
}

function linear_damping(delta_d, old_d) { return delta_d * (10 - old_d) / 9; }
function mean_reversion(init, current) { return w[7] * init + (1 - w[7]) * current; }

function next_difficulty(d, ratingStr) {
  let delta_d = -w[6] * (ratings[ratingStr] - 3);
  let next_d = d + linear_damping(delta_d, d);
  return constrain_difficulty(mean_reversion(init_difficulty("easy"), next_d));
}

function next_recall_stability(d, s, r, ratingStr) {
  let hardPenalty = ratingStr === "hard" ? w[15] : 1;
  let easyBonus = ratingStr === "easy" ? w[16] : 1;
  return +(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus)).toFixed(2);
}

function next_forget_stability(d, s, r) {
  let sMin = s / Math.exp(w[17] * w[18]);
  return +Math.min(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), sMin).toFixed(2);
}

function next_short_term_stability(s, ratingStr) {
  let sinc = Math.exp(w[17] * (ratings[ratingStr] - 3 + w[18])) * Math.pow(s, -w[19]);
  if (ratings[ratingStr] >= 3) sinc = Math.max(sinc, 1);
  return +(s * sinc).toFixed(2);
}

function init_difficulty(ratingStr) { return +constrain_difficulty(w[4] - Math.exp(w[5] * (ratings[ratingStr] - 1)) + 1).toFixed(2); }
function init_stability(ratingStr) { return +Math.max(w[ratings[ratingStr] - 1], 0.1).toFixed(2); }

const calculateNextReview = (card, qualityUI) => {
  const RATING_STRINGS = ["again", "hard", "good", "easy"];
  const ratingStr = RATING_STRINGS[qualityUI];
  const now = Date.now();

  const fuzz_factor = generate_fuzz_factor(card); 

  let state = card.state !== undefined ? card.state : (card.reviews > 0 ? 2 : 0);
  let stepIndex = card.stepIndex !== undefined ? card.stepIndex : 0;
  let difficulty = card.difficulty;
  let stability = card.stability;
  let last_review = card.last_review || now;
  
  const elapsed_days = Math.max((now - last_review) / 86400000, 0);
  let interval = 0; 
  let isMinutes = false;

  if (stability == null && state !== 0) {
    stability = init_stability("good");
    difficulty = init_difficulty("good");
  }

  if (state === 0) { 
    stability = init_stability(ratingStr);
    difficulty = init_difficulty(ratingStr);

    if (ratingStr === "again") {
      state = 1; stepIndex = 0; interval = LEARNING_STEPS[0]; isMinutes = true;
    } else if (ratingStr === "hard") {
      state = 1; stepIndex = 0; interval = (LEARNING_STEPS[0] + LEARNING_STEPS[1]) / 2; isMinutes = true;
    } else if (ratingStr === "good") {
      state = 1; stepIndex = 1; interval = LEARNING_STEPS[1]; isMinutes = true;
    } else if (ratingStr === "easy") {
      state = 2; 
      let good_ivl = next_interval(init_stability("good"), fuzz_factor);
      interval = Math.max(next_interval(init_stability("easy"), fuzz_factor), good_ivl + 1);
    }
  } 
  else if (state === 1 || state === 3) { 
    let last_s = stability;
    let last_d = difficulty;
    
    difficulty = next_difficulty(last_d, ratingStr);
    stability = next_short_term_stability(last_s, ratingStr);

    if (ratingStr === "again") {
      stepIndex = 0; interval = LEARNING_STEPS[0]; isMinutes = true;
    } else if (ratingStr === "hard") {
      interval = LEARNING_STEPS[stepIndex] || 5; isMinutes = true; 
    } else if (ratingStr === "good") {
      stepIndex++;
      if (stepIndex < LEARNING_STEPS.length) {
        interval = LEARNING_STEPS[stepIndex]; isMinutes = true;
      } else {
        state = 2; 
        interval = next_interval(stability, fuzz_factor);
      }
    } else if (ratingStr === "easy") {
      state = 2; 
      let good_ivl = next_interval(next_short_term_stability(last_s, "good"), fuzz_factor);
      interval = Math.max(next_interval(stability, fuzz_factor), good_ivl + 1);
    }
  } 
  else if (state === 2) { 
    const retrievability = forgetting_curve(elapsed_days, stability);
    let last_s = stability;
    let last_d = difficulty;
    
    if (ratingStr === "again") {
      difficulty = next_difficulty(last_d, "again");
      stability = next_forget_stability(last_d, last_s, retrievability);
      state = 3; stepIndex = 0; interval = LEARNING_STEPS[0]; isMinutes = true;
    } else {
      difficulty = next_difficulty(last_d, ratingStr);
      stability = next_recall_stability(last_d, last_s, retrievability, ratingStr);
      
      let hard_ivl = next_interval(next_recall_stability(last_d, last_s, retrievability, "hard"), fuzz_factor);
      let good_ivl = next_interval(next_recall_stability(last_d, last_s, retrievability, "good"), fuzz_factor);
      let easy_ivl = next_interval(next_recall_stability(last_d, last_s, retrievability, "easy"), fuzz_factor);
      
      hard_ivl = Math.min(hard_ivl, good_ivl);
      good_ivl = Math.max(good_ivl, hard_ivl + 1);
      easy_ivl = Math.max(easy_ivl, good_ivl + 1);

      if (ratingStr === "hard") interval = hard_ivl;
      else if (ratingStr === "good") interval = good_ivl;
      else if (ratingStr === "easy") interval = easy_ivl;
    }
  }

  const intervalInDays = isMinutes ? interval / 1440 : interval;
  const nextDue = isMinutes ? now + (interval * 60000) : now + (interval * 24 * 60 * 60 * 1000);

  return { 
    ...card, 
    state,
    difficulty,
    stability,
    stepIndex,
    interval: intervalInDays, 
    last_review: now,
    dueDate: nextDue, 
    reviews: (card.reviews || 0) + 1 
  };
};

const formatInterval = (days) => {
  if (!days) return "<1m";
  const minutes = Math.round(days * 1440);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`; 
  const hours = Math.round(days * 24);
  if (hours < 24) return `${hours}h`; 
  const d = Math.round(days);
  if (d < 30) return `${d}d`; 
  if (d < 365) return `${Math.round(d / 30)}mo`; 
  return `${Math.round(d / 365)}a`; 
};

// SINTETIZADOR DE ÁUDIO PARA O ALARME DO POMODORO
const playAlarmSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.4); // C5
    playTone(659.25, now + 0.15, 0.6); // E5
  } catch (e) {
    console.warn("Erro ao tocar alarme:", e);
  }
};

const loadScript = (src) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${src}"]`)) return resolve();
  const s = document.createElement('script');
  s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
});

const RichTextEditor = ({ value, onChange, placeholder, label }) => {
  const editorRef = useRef(null);
  
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);
  
  const handleInput = (e) => onChange(e.currentTarget.innerHTML);
  
  const handlePaste = (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const reader = new FileReader();
        reader.onload = (event) => {
          document.execCommand('insertImage', false, event.target.result);
          onChange(editorRef.current.innerHTML);
        };
        reader.readAsDataURL(items[i].getAsFile());
        e.preventDefault(); 
      }
    }
  };
  
  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>}
      <div 
        ref={editorRef} 
        contentEditable 
        onInput={handleInput} 
        onPaste={handlePaste} 
        className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto min-h-[5rem] max-h-[15rem] cursor-text relative empty:before:content-[attr(data-placeholder)] empty:before:text-slate-700 custom-scrollbar anki-content transition-colors" 
        data-placeholder={placeholder} 
      />
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const firstLoadRefFolders = useRef(true);
  const firstLoadRefDecks = useRef(true);

  const [decks, setDecks] = useState(() => {
    try { const saved = localStorage.getItem('lumina_decks'); if (saved) return JSON.parse(saved); } catch (e) {}
    return initialDecks;
  });
  const [folders, setFolders] = useState(() => {
    try { const saved = localStorage.getItem('lumina_folders'); if (saved) return JSON.parse(saved); } catch (e) {}
    return initialFolders;
  });
  const [activityMap, setActivityMap] = useState(() => {
    try { const saved = localStorage.getItem('lumina_activity'); if (saved) return JSON.parse(saved); } catch (e) {}
    return {};
  });

  const [pomoWorkDuration, setPomoWorkDuration] = useState(() => {
    try { const saved = localStorage.getItem('lumina_pomoWork'); if (saved) return parseInt(saved); } catch(e){} return 25;
  });
  const [pomoBreakDuration, setPomoBreakDuration] = useState(() => {
    try { const saved = localStorage.getItem('lumina_pomoBreak'); if (saved) return parseInt(saved); } catch(e){} return 5;
  });
  const [pomoTotalBlocks, setPomoTotalBlocks] = useState(() => {
    try { const saved = localStorage.getItem('lumina_pomoBlocks'); if (saved) return parseInt(saved); } catch(e){} return 4;
  });
  const [dailyGoal, setDailyGoal] = useState(() => {
    try { const saved = localStorage.getItem('lumina_dailyGoal'); if (saved) return parseInt(saved); } catch(e){} return 50;
  });

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [mainTab, setMainTab] = useState('home'); 
  const [reportPeriod, setReportPeriod] = useState('week'); 
  const [reportDeckId, setReportDeckId] = useState('all'); 
  
  const [activeDeckId, setActiveDeckId] = useState(null);

  // --- RESOLUÇÃO DO REFERENCE ERROR: CALCULOS MOVIDOS PARA ANTES DO SEU USO ---
  const reachableFolders = new Set([null]);
  let changed = true;
  let safetyLimit = 0; 
  while (changed && safetyLimit < 1000) {
    changed = false; safetyLimit++;
    for (const f of folders) {
      if (!reachableFolders.has(f.id) && reachableFolders.has(f.parentId)) { reachableFolders.add(f.id); changed = true; }
    }
  }
  const validDecks = decks.filter(d => reachableFolders.has(d.parentId));
  const validCardIds = new Set(validDecks.flatMap(d => (d.cards || []).map(c => c.id)));
  const activeDeck = validDecks.find(d => d.id === activeDeckId) || decks.find(d => d.id === activeDeckId);
  // -------------------------------------------------------------------------
  
  const [calendarMonth, setCalendarMonth] = useState(() => {
     const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  const [reviewQueue, setReviewQueue] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewInteraction, setReviewInteraction] = useState(null); 
  const [typedInput, setTypedInput] = useState(''); 
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });

  const [pomoActive, setPomoActive] = useState(false);
  const [pomoTime, setPomoTime] = useState(pomoWorkDuration * 60);
  const [pomoMode, setPomoMode] = useState('work'); 
  const [currentPomoBlock, setCurrentPomoBlock] = useState(1);
  const [isPomoSettingsOpen, setIsPomoSettingsOpen] = useState(false);
  const [isPomoExpanded, setIsPomoExpanded] = useState(true);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [cardType, setCardType] = useState('standard');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState(''); 
  const [choiceOptions, setChoiceOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [tfCorrect, setTfCorrect] = useState(true);
  const [typeAnswer, setTypeAnswer] = useState('');
  const [editingCardId, setEditingCardId] = useState(null); 
  
  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); 
  const [editingItemId, setEditingItemId] = useState(null); 
  const [modalType, setModalType] = useState('folder'); 
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemColor, setNewItemColor] = useState(FOLDER_THEMES[0].color);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [toast, setToast] = useState(null);

  const stateRef = useRef();

  useEffect(() => { localStorage.setItem('lumina_decks', JSON.stringify(decks)); }, [decks]);
  useEffect(() => { localStorage.setItem('lumina_folders', JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem('lumina_activity', JSON.stringify(activityMap)); }, [activityMap]);
  useEffect(() => { localStorage.setItem('lumina_pomoWork', pomoWorkDuration); }, [pomoWorkDuration]);
  useEffect(() => { localStorage.setItem('lumina_pomoBreak', pomoBreakDuration); }, [pomoBreakDuration]);
  useEffect(() => { localStorage.setItem('lumina_pomoBlocks', pomoTotalBlocks); }, [pomoTotalBlocks]);
  useEffect(() => { localStorage.setItem('lumina_dailyGoal', dailyGoal); }, [dailyGoal]);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth); 
        }
      } catch (err) { 
        console.error("Token de auth:", err); 
        try { await signInAnonymously(auth); } catch (e) { console.error("Falha no login anônimo", e); }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u); 
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(`Erro ecrã inteiro: ${err.message}`));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) return showToast("Firebase não inicializado corretamente.", "error");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      showToast("Erro ao fazer login.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      setDecks([]); setFolders([]); setActivityMap({});
      setCurrentView('dashboard'); setMainTab('home');
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  useEffect(() => {
    if (!user || !db) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activityMap) setActivityMap(data.activityMap);
        if (data.pomoWorkDuration) setPomoWorkDuration(data.pomoWorkDuration);
        if (data.pomoBreakDuration) setPomoBreakDuration(data.pomoBreakDuration);
        if (data.pomoTotalBlocks) setPomoTotalBlocks(data.pomoTotalBlocks);
        if (data.dailyGoal) setDailyGoal(data.dailyGoal);
      } else {
        const localActivity = localStorage.getItem('lumina_activity');
        const activityToSync = localActivity ? JSON.parse(localActivity) : {};
        setDoc(profileRef, { activityMap: activityToSync, pomoWorkDuration: 25, pomoBreakDuration: 5, dailyGoal: 50 }).catch(console.error);
      }
    }, console.error);

    const foldersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'folders');
    const unsubFolders = onSnapshot(foldersRef, (snap) => {
      const cloudData = [];
      snap.forEach(d => cloudData.push(d.data()));
      setFolders(currentLocal => {
        if (firstLoadRefFolders.current && cloudData.length === 0 && currentLocal.length > 0 && !snap.metadata.hasPendingWrites) {
          currentLocal.forEach(localF => setDoc(doc(foldersRef, localF.id), localF).catch(console.error));
          firstLoadRefFolders.current = false;
          return currentLocal;
        }
        firstLoadRefFolders.current = false;
        return cloudData;
      });
    }, console.error);

    const decksRef = collection(db, 'artifacts', appId, 'users', user.uid, 'decks');
    const unsubDecks = onSnapshot(decksRef, (snap) => {
      const cloudData = [];
      snap.forEach(dc => cloudData.push(dc.data()));
      setDecks(currentLocal => {
        if (firstLoadRefDecks.current && cloudData.length === 0 && currentLocal.length > 0 && !snap.metadata.hasPendingWrites) {
          currentLocal.forEach(localD => setDoc(doc(decksRef, localD.id), localD).catch(console.error));
          firstLoadRefDecks.current = false;
          return currentLocal;
        }
        firstLoadRefDecks.current = false;
        return cloudData;
      });
    }, console.error);

    return () => { unsubProfile(); unsubFolders(); unsubDecks(); };
  }, [user]);

  useEffect(() => { setReviewInteraction(null); setTypedInput(''); }, [currentCardIndex]);

  useEffect(() => {
    let interval;
    if (pomoActive) {
      interval = setInterval(() => {
        setPomoTime(prev => {
          if (prev <= 1) {
            playAlarmSound(); 
            if (pomoMode === 'work') {
              if (currentPomoBlock < pomoTotalBlocks) {
                showToast(`Foco concluído! Pausa.`, 'info');
                setPomoMode('break');
                return pomoBreakDuration * 60;
              } else {
                showToast(`Sessão Pomodoro completa! Excelente!`, 'success');
                setPomoMode('work');
                setPomoActive(false);
                setCurrentPomoBlock(1);
                return pomoWorkDuration * 60;
              }
            } else {
              showToast('Pausa terminada! De volta ao foco.', 'info');
              setPomoMode('work'); 
              setCurrentPomoBlock(b => b + 1);
              setPomoActive(false); 
              return pomoWorkDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pomoActive, pomoMode, pomoBreakDuration, pomoWorkDuration, currentPomoBlock, pomoTotalBlocks]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const s = stateRef.current;
      if (!s || s.currentView !== 'review') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped(prev => !prev); } 
      else if (s.isFlipped && s.cardType === 'standard') {
        if (e.key === '1') s.handleAnswer(0); if (e.key === '2') s.handleAnswer(1);
        if (e.key === '3') s.handleAnswer(2); if (e.key === '4') s.handleAnswer(3);
      } else if (!s.isFlipped) {
        if (s.cardType === 'choice' && ['1','2','3','4'].includes(e.key)) s.handleInteractiveSubmit(parseInt(e.key) - 1);
        else if (s.cardType === 'tf') { if (e.key === '1') s.handleInteractiveSubmit(true); if (e.key === '2') s.handleInteractiveSubmit(false); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatPomoTime = (secs) => `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };
  
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const removeDeletedCardsFromActivity = (idsToRemoveSet) => {
    if (idsToRemoveSet.size === 0) return;
    setActivityMap(prev => {
      let hasChanges = false;
      const newMap = { ...prev };
      for (const dateStr in newMap) {
        const data = newMap[dateStr];
        if (Array.isArray(data)) {
          const filtered = data.filter(id => !idsToRemoveSet.has(id));
          if (filtered.length !== data.length) { newMap[dateStr] = filtered; hasChanges = true; }
        }
      }
      if (hasChanges) syncActivityToCloud(newMap);
      return hasChanges ? newMap : prev;
    });
  };

  const getDailyCount = (dateStr) => {
    const data = activityMap[dateStr];
    if (!data) return 0;
    if (Array.isArray(data)) return data.filter(id => validCardIds.has(id)).length;
    return 0; 
  };

  const getDailyCountFiltered = (dateStr, deckId) => {
    const data = activityMap[dateStr];
    if (!data || !Array.isArray(data)) return 0;
    if (deckId === 'all') return data.filter(id => validCardIds.has(id)).length;
    const targetDeck = validDecks.find(d => d.id === deckId);
    if (!targetDeck) return 0;
    const deckCardIds = new Set((targetDeck.cards || []).map(c => c.id));
    return data.filter(id => deckCardIds.has(id)).length;
  };

  const calculateStreak = () => {
    let streak = 0; let d = new Date();
    let loopSafeguard = 0; 
    while (loopSafeguard < 3650) { 
      loopSafeguard++;
      const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dy = String(d.getDate()).padStart(2, '0');
      const str = `${y}-${m}-${dy}`;
      if (getDailyCount(str) > 0) { streak++; d.setDate(d.getDate() - 1); } 
      else if (streak === 0 && str === getTodayStr()) { d.setDate(d.getDate() - 1); } 
      else { break; }
    }
    return streak;
  };

  const getCardStats = (cards) => {
    const now = Date.now();
    return (cards || []).reduce((acc, card) => {
      const state = card.state !== undefined ? card.state : (card.reviews > 0 ? 2 : 0);
      const r = card.reviews || 0;
      if (state === 0 || r === 0) acc.new++;
      else if (state === 1 || state === 3 || card.interval < 1) acc.learning++;
      else if (card.dueDate <= now) acc.review++;
      else acc.learned++;
      return acc;
    }, { new: 0, learning: 0, review: 0, learned: 0 });
  };

  const calculateTotalDue = (stats) => stats.new + stats.learning + stats.review;

  const getDecksInFolder = (folderId, visited = new Set()) => {
    if (visited.has(folderId)) return [];
    visited.add(folderId);
    let result = [];
    result.push(...validDecks.filter(d => d.parentId === folderId));
    folders.filter(f => f.parentId === folderId).forEach(sf => { result.push(...getDecksInFolder(sf.id, visited)); });
    return result;
  };

  const getFolderStats = (folderId) => getCardStats(getDecksInFolder(folderId).flatMap(d => d.cards || []));
  const globalStats = getCardStats(validDecks.flatMap(d => d.cards || []));

  const getFolderPaths = (excludeFolderId = null) => {
    const paths = [];
    paths.push({ id: null, path: 'Raiz (Início)' });

    const traverse = (parentId, currentPath) => {
      folders.filter(f => f.parentId === parentId).forEach(f => {
        if (f.id === excludeFolderId) return; 
        const newPath = currentPath ? `${currentPath} > ${f.name}` : f.name;
        paths.push({ id: f.id, path: newPath });
        traverse(f.id, newPath);
      });
    };
    traverse(null, '');
    return paths;
  };

  const breadcrumbs = [];
  let currId = currentFolderId;
  const visitedCrumb = new Set();
  while (currId && !visitedCrumb.has(currId)) {
    visitedCrumb.add(currId);
    const f = folders.find(f => f.id === currId);
    if (f) { breadcrumbs.unshift(f); currId = f.parentId; } else break;
  }

  const updateDeckInCloud = (deckData) => {
    if (!user || !db) return;
    const cleanData = JSON.parse(JSON.stringify(deckData));
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', deckData.id), cleanData).catch(e => console.error("Firebase sync error", e));
  };

  const updateFolderInCloud = (folderData) => {
    if (!user || !db) return;
    const cleanData = JSON.parse(JSON.stringify(folderData));
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'folders', folderData.id), cleanData).catch(e => console.error("Firebase sync error", e));
  };

  const syncActivityToCloud = (newMap) => {
    if (!user || !db) return;
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { activityMap: newMap }, { merge: true }).catch(console.error);
  };

  const startReview = (deckId, forceAll = false, folderId = null) => {
    let dueCards = [];
    if (folderId) {
      const decksToStudy = getDecksInFolder(folderId);
      decksToStudy.forEach(deck => {
        let cards = (deck.cards || []).filter(c => c.dueDate <= Date.now() || !c.dueDate);
        if (forceAll) cards = deck.cards || [];
        cards = cards.map(c => ({ ...c, _deckId: deck.id }));
        dueCards.push(...cards);
      });
      setActiveDeckId(null);
    } else {
      const deck = validDecks.find(d => d.id === deckId);
      if (!deck) return;
      let cards = (deck.cards || []).filter(c => c.dueDate <= Date.now() || !c.dueDate);
      if (forceAll) cards = deck.cards || [];
      cards = cards.map(c => ({ ...c, _deckId: deck.id }));
      dueCards.push(...cards);
      setActiveDeckId(deckId);
    }

    if (dueCards.length === 0) {
      showToast("Sem cartões para estudar aqui.", "info");
      return;
    }

    setReviewQueue([...dueCards].sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0); setIsFlipped(false); setSessionStats({ reviewed: 0, correct: 0 });
    setCurrentView('review');
  };

  const handleAnswer = (quality) => {
    const currentCard = reviewQueue[currentCardIndex];
    const updatedCard = calculateNextReview(currentCard, quality);
    
    const targetDeckId = currentCard._deckId || activeDeckId;
    const targetDeck = validDecks.find(d => d.id === targetDeckId);

    if (targetDeck) {
      const cleanUpdatedCard = { ...updatedCard };
      delete cleanUpdatedCard._deckId; 
      
      const newDeckData = { ...targetDeck, cards: targetDeck.cards.map(c => c.id === updatedCard.id ? cleanUpdatedCard : c) };
      setDecks(prev => prev.map(d => d.id === targetDeckId ? newDeckData : d)); 
      updateDeckInCloud(newDeckData);
    }

    setSessionStats(prev => ({ reviewed: prev.reviewed + 1, correct: prev.correct + (quality > 0 ? 1 : 0) }));
    const todayStr = getTodayStr();
    const currentDayData = Array.isArray(activityMap[todayStr]) ? activityMap[todayStr] : [];
    const newActivityMap = { ...activityMap, [todayStr]: [...currentDayData, updatedCard.id] };
    
    setActivityMap(newActivityMap); syncActivityToCloud(newActivityMap);

    let newQueue = [...reviewQueue];
    if (updatedCard.interval === 0) {
      // mantém tracking no mesmo baralho durante os fails
      newQueue.push({ ...updatedCard, _deckId: currentCard._deckId });
    }
    if (currentCardIndex + 1 < newQueue.length) { setReviewQueue(newQueue); setIsFlipped(false); setCurrentCardIndex(prev => prev + 1); } 
    else { setCurrentView('finished'); }
  };

  const handleInteractiveSubmit = (val) => { setReviewInteraction(val); setIsFlipped(true); };

  stateRef.current = { currentView, isFlipped, reviewQueue, currentCardIndex, cardType: reviewQueue[currentCardIndex]?.type || 'standard', handleAnswer, handleInteractiveSubmit };

  const updateChoiceOption = (idx, value) => { const newOpts = [...choiceOptions]; newOpts[idx] = value; setChoiceOptions(newOpts); };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const finalWork = pomoWorkDuration || 25; const finalBreak = pomoBreakDuration || 5; const finalBlocks = pomoTotalBlocks || 4; const finalGoal = dailyGoal || 50;
    setPomoWorkDuration(finalWork); setPomoBreakDuration(finalBreak); setPomoTotalBlocks(finalBlocks); setDailyGoal(finalGoal); setIsPomoSettingsOpen(false);
    if (!pomoActive) setPomoTime(pomoMode === 'work' ? finalWork * 60 : finalBreak * 60);
    if (user && db) setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { pomoWorkDuration: finalWork, pomoBreakDuration: finalBreak, pomoTotalBlocks: finalBlocks, dailyGoal: finalGoal }, { merge: true }).catch(console.error);
    showToast("Configurações salvas!");
  };

  const processAnkiImport = async (file) => {
    try {
      setImportProgress('A carregar...');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js');
      await loadScript('https://cdn.jsdelivr.net/npm/fzstd/umd/index.js');

      const initSqlJsFn = window.initSqlJs; const JSZipClass = window.JSZip;
      if (!initSqlJsFn || !JSZipClass) throw new Error("Bibliotecas falharam.");

      const SQL = await initSqlJsFn({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}` });
      await new Promise(r => setTimeout(r, 100)); 
      const zip = new JSZipClass(); await zip.loadAsync(file);
      
      let dbFile = zip.file("collection.anki21b") || zip.file("collection.anki21") || zip.file("collection.anki2");
      if (!dbFile) throw new Error("Base de dados Anki não encontrada.");
      
      let dbData = await dbFile.async("uint8array");
      if (dbFile.name === "collection.anki21b") { if (!window.fzstd) throw new Error("Biblioteca de descompressão falhou."); dbData = window.fzstd.decompress(dbData); }
      const db = new SQL.Database(dbData);

      let mediaMap = {};
      if (zip.file("media")) {
        try { const mediaData = await zip.file("media").async("string"); mediaMap = JSON.parse(mediaData); } catch (err) {}
      }

      const mediaAssets = {}; const fileNames = Object.keys(zip.files);
      for (let i = 0; i < fileNames.length; i++) {
        const mappedName = mediaMap[fileNames[i]];
        if (mappedName && typeof mappedName === 'string' && mappedName.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)) {
          try {
            const b64 = await zip.file(fileNames[i]).async("base64");
            const exts = mappedName.split('.').pop().toLowerCase();
            mediaAssets[mappedName] = `data:image/${exts === 'jpg' ? 'jpeg' : exts};base64,${b64}`;
          } catch (err) { }
        }
      }

      let decksInfo = [];
      try {
        const decksTable = db.exec("SELECT id, name FROM decks");
        if (decksTable.length > 0 && decksTable[0].values) decksTable[0].values.forEach(row => decksInfo.push({ id: String(row[0]), name: String(row[1]) }));
      } catch (e) {
        try {
          const colQuery = db.exec("SELECT decks FROM col");
          if (colQuery.length > 0 && colQuery[0].values && colQuery[0].values[0]) {
            const parsed = JSON.parse(colQuery[0].values[0][0]);
            Object.values(parsed).forEach(d => decksInfo.push({ id: String(d.id), name: String(d.name) }));
          }
        } catch (err) { }
      }

      const newDecksMap = {}; const newFoldersToCloud = [];
      const getOrCreateFolder = (fName, parentId) => {
        let f = newFoldersToCloud.find(x => x.name === fName && x.parentId === parentId) || folders.find(x => x.name === fName && x.parentId === parentId);
        if (f) return f.id;
        const newId = `f-anki-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newFolder = { id: newId, name: fName, parentId, color: 'text-indigo-400' };
        newFoldersToCloud.push(newFolder); setFolders(prev => [...prev, newFolder]); updateFolderInCloud(newFolder);
        return newId;
      };

      decksInfo.forEach(ankiDeck => {
        if (ankiDeck.name === "Default" && ankiDeck.id === "1") return;
        const pathParts = ankiDeck.name.split(/::|\x1f|\x1e/).map(p => p.trim()).filter(Boolean);
        if (pathParts.length === 0) return;
        let parent = currentFolderId; const deckName = pathParts.pop();
        pathParts.forEach(p => { parent = getOrCreateFolder(p, parent); });
        newDecksMap[ankiDeck.id] = { id: `d-anki-${ankiDeck.id}`, name: deckName, parentId: parent, color: 'bg-emerald-600 text-white', cards: [] };
      });

      const fallbackDeck = { id: `d-fb-${Date.now()}`, name: file.name.split('.')[0], parentId: currentFolderId, color: 'bg-emerald-600 text-white', cards: [] };
      const cardsQuery = db.exec("SELECT c.did, n.flds FROM cards c JOIN notes n ON c.nid = n.id");
      
      let importedCount = 0;
      if (cardsQuery.length > 0) {
        cardsQuery[0].values.forEach((row) => {
          const fields = row[1].split('\x1f');
          if (fields.length >= 2 && !fields[0].includes("Atualize para a versão")) {
            let front = fields[0], back = fields[1];
            Object.keys(mediaAssets).forEach(imgName => {
              const b64 = mediaAssets[imgName];
              front = front.split(imgName).join(b64).split(encodeURIComponent(imgName)).join(b64);
              back = back.split(imgName).join(b64).split(encodeURIComponent(imgName)).join(b64);
            });
            const newCard = { id: `c-anki-${Math.random()}`, type: 'standard', front, back, repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), reviews: 0 };
            if (newDecksMap[String(row[0])]) newDecksMap[String(row[0])].cards.push(newCard); else fallbackDeck.cards.push(newCard);
            importedCount++;
          }
        });
      }
      
      const finalDecks = Object.values(newDecksMap).filter(d => d.cards.length > 0);
      if (fallbackDeck.cards.length > 0) finalDecks.push(fallbackDeck); 
      setDecks(prev => [...prev, ...finalDecks]); finalDecks.forEach(d => updateDeckInCloud(d));

      if(importedCount > 0) showToast(`${importedCount} cartões importados!`);
      else showToast("Nenhum cartão lido.", "error");

    } catch (e) { showToast(`Erro: ${e.message}`, "error"); } finally { setIsImporting(false); setImportProgress(''); }
  };

  const processTextImport = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      if (text.includes('\x00')) { showToast('Ficheiro binário não suportado.', 'error'); setIsImporting(false); return; }
      const lines = text.split('\n'); const importedCards = [];
      lines.forEach((line) => {
        if (!line.trim()) return;
        const separator = line.includes('\t') ? '\t' : ',';
        const parts = line.split(separator);
        if (parts.length >= 2) importedCards.push({ id: `c-imp-${Date.now()}-${Math.random()}`, type: 'standard', front: parts[0].replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim(), back: parts[1].replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim(), repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), reviews: 0 });
      });
      if (importedCards.length > 0) {
        const newDeck = { id: `d-imp-${Date.now()}`, name: file.name.split('.')[0], parentId: currentFolderId, description: 'Importado', color: 'bg-emerald-600 text-white', cards: importedCards };
        setDecks(prev => [...prev, newDeck]); updateDeckInCloud(newDeck); showToast(`${importedCards.length} cartões importados!`);
      }
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const handleUniversalImport = async (e) => {
    const file = e.target.files[0]; if (!file) return; setIsImporting(true);
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'colpkg' || ext === 'apkg' || ext === 'zip') await processAnkiImport(file); else processTextImport(file);
    e.target.value = null; 
  };

  const openEditModal = (type, item, e) => {
    e.stopPropagation(); setModalType(type); setModalMode('edit'); setEditingItemId(item.id);
    setNewItemName(item.name); setNewItemDesc(item.description || ''); setNewItemColor(item.color || (type === 'folder' ? FOLDER_THEMES[0].color : DECK_THEMES[0].color)); setIsModalOpen(true);
  };

  const closeAndResetModal = () => { setIsModalOpen(false); setNewItemName(''); setNewItemDesc(''); setEditingItemId(null); setModalMode('create'); };

  const handleCreateOrEditItem = (e) => {
    e.preventDefault(); if (!newItemName.trim() || !user) return;
    if (modalMode === 'edit') {
      if (modalType === 'folder') {
        const f = folders.find(x => x.id === editingItemId);
        if(f) { const updated = { ...f, name: newItemName, color: newItemColor }; setFolders(prev => prev.map(x => x.id === editingItemId ? updated : x)); updateFolderInCloud(updated); }
      } else {
        const d = validDecks.find(x => x.id === editingItemId);
        if(d) { const updated = { ...d, name: newItemName, description: newItemDesc, color: newItemColor }; setDecks(prev => prev.map(x => x.id === editingItemId ? updated : x)); updateDeckInCloud(updated); }
      }
      showToast(`${modalType === 'folder' ? 'Pasta' : 'Baralho'} atualizado!`);
    } else {
      if (modalType === 'folder') {
        const newFolder = { id: `f-${Date.now()}`, name: newItemName, parentId: currentFolderId, color: newItemColor };
        setFolders(prev => [...prev, newFolder]); updateFolderInCloud(newFolder);
      } else {
        const newDeck = { id: `d-${Date.now()}`, name: newItemName, description: newItemDesc, parentId: currentFolderId, color: newItemColor, cards: [] };
        setDecks(prev => [...prev, newDeck]); updateDeckInCloud(newDeck);
      }
    }
    closeAndResetModal();
  };

  const confirmDelete = () => {
    if (!itemToDelete || !user) return;
    if (itemToDelete.type === 'folder') {
      const getAllNestedFolderIds = (folderId) => {
        let ids = [folderId]; folders.filter(f => f.parentId === folderId).forEach(c => { ids = [...ids, ...getAllNestedFolderIds(c.id)]; }); return ids;
      };
      const idsToDelete = getAllNestedFolderIds(itemToDelete.id);
      const decksToDelete = validDecks.filter(d => idsToDelete.includes(d.parentId));
      const cardIdsToScrub = new Set(decksToDelete.flatMap(d => (d.cards || []).map(c => c.id)));
      
      setFolders(prev => prev.filter(f => !idsToDelete.includes(f.id))); setDecks(prev => prev.filter(d => !idsToDelete.includes(d.parentId))); removeDeletedCardsFromActivity(cardIdsToScrub);
      if (user && db) {
        idsToDelete.forEach(id => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'folders', id)).catch(e => {}));
        decksToDelete.forEach(d => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', d.id)).catch(e => {}));
      }
      showToast("Pasta eliminada.");
    } else {
      const deckToDelete = validDecks.find(d => d.id === itemToDelete.id);
      const cardIdsToScrub = new Set((deckToDelete?.cards || []).map(c => c.id));
      
      setDecks(prev => prev.filter(d => d.id !== itemToDelete.id)); removeDeletedCardsFromActivity(cardIdsToScrub);
      if (user && db) deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', itemToDelete.id)).catch(e => {});
      if (activeDeckId === itemToDelete.id) { setCurrentView('dashboard'); setActiveDeckId(null); }
      showToast("Baralho eliminado.");
    }
    setItemToDelete(null);
  };

  const handleMoveItem = () => {
    if (!itemToMove || !user) return;
    if (itemToMove.type === 'folder') {
      const f = folders.find(x => x.id === itemToMove.id);
      if (f) {
        const updated = { ...f, parentId: moveTargetFolderId };
        setFolders(prev => prev.map(x => x.id === itemToMove.id ? updated : x));
        updateFolderInCloud(updated);
      }
    } else {
      const d = validDecks.find(x => x.id === itemToMove.id);
      if (d) {
        const updated = { ...d, parentId: moveTargetFolderId };
        setDecks(prev => prev.map(x => x.id === itemToMove.id ? updated : x));
        updateDeckInCloud(updated);
      }
    }
    setIsMoveModalOpen(false);
    setItemToMove(null);
    showToast(`${itemToMove.type === 'folder' ? 'Pasta movida' : 'Baralho movido'} com sucesso!`);
  };

  const handleSaveCard = (e) => {
    e.preventDefault(); if (!newCardFront.trim() || !user) return;
    let processedCard = { id: editingCardId || `c-${Date.now()}`, type: cardType, front: newCardFront, back: newCardBack, repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), reviews: 0 };
    
    // Se o user está na vista detail do baralho, este activeDeckId estará definido
    const targetDeckId = reviewQueue[currentCardIndex]?._deckId || activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);

    if (editingCardId && currentDeck) {
      const existing = currentDeck.cards.find(c => c.id === editingCardId);
      if (existing) processedCard = { ...processedCard, repetition: existing.repetition, interval: existing.interval, easeFactor: existing.easeFactor, dueDate: existing.dueDate, reviews: existing.reviews };
    }

    if (cardType === 'choice') { processedCard.options = [...choiceOptions]; processedCard.correctOption = correctOption; } 
    else if (cardType === 'tf') { processedCard.isTrue = tfCorrect; } 
    else if (cardType === 'typing') { processedCard.typeAnswer = typeAnswer; }

    if(currentDeck) {
       let updatedCards;
       if (editingCardId) updatedCards = currentDeck.cards.map(c => c.id === editingCardId ? processedCard : c);
       else updatedCards = [...(currentDeck.cards || []), processedCard];
       
       const updatedDeck = { ...currentDeck, cards: updatedCards };
       setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d)); updateDeckInCloud(updatedDeck);
       showToast(editingCardId ? "Cartão atualizado!" : "Cartão adicionado!");
    }
    setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer(''); setEditingCardId(null);
  };

  const editCard = (card) => {
    setCardType(card.type || 'standard'); setNewCardFront(card.front); setNewCardBack(card.back || '');
    if (card.type === 'choice') { setChoiceOptions(card.options || ['', '', '', '']); setCorrectOption(card.correctOption || 0); }
    if (card.type === 'tf') setTfCorrect(card.isTrue !== false);
    if (card.type === 'typing') setTypeAnswer(card.typeAnswer || '');
    setEditingCardId(card.id); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCard = (cardId) => {
    const targetDeckId = reviewQueue[currentCardIndex]?._deckId || activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);
    if(currentDeck) {
      const updatedDeck = { ...currentDeck, cards: currentDeck.cards.filter(c => c.id !== cardId) };
      setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d)); updateDeckInCloud(updatedDeck); removeDeletedCardsFromActivity(new Set([cardId]));
    }
  };

  // --- RENDERERS UI ---
  if (isAuthLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 notranslate" translate="no"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 notranslate" translate="no">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 tracking-tight animate-float text-center">Flash Cards</h1>
        <button onClick={signInWithGoogle} className="flex items-center gap-3 bg-white text-slate-900 hover:bg-slate-200 px-6 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-white/10">
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Continuar com o Google
        </button>
        {toast && (
          <div className="fixed bottom-6 right-6 z-[90] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl shadow-black/50 border backdrop-blur-md bg-rose-950/80 border-rose-500/30 text-rose-200">
              <Info className="w-5 h-5 text-rose-400" /><p className="font-medium text-sm">{toast.message}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderStatBadges = (stats) => {
    if (calculateTotalDue(stats) === 0) return null;
    return (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {stats.new > 0 && <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(59,130,246,0.15)]" title="Novos">{stats.new}</span>}
        {stats.learning > 0 && <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(244,63,94,0.15)]" title="Aprender">{stats.learning}</span>}
        {stats.review > 0 && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.15)]" title="Revisar">{stats.review}</span>}
      </div>
    );
  };

  const renderMastery = () => {
    const gCards = validDecks.flatMap(d => d.cards || []);
    const gStats = getCardStats(gCards); const totalC = gCards.length || 1;
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative overflow-hidden group flex flex-col h-full justify-between animate-pop delay-300">
        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h3 className="font-bold text-slate-100 flex items-center gap-2"><PieChart className="w-5 h-5 text-blue-400" /> Domínio Global</h3>
              <span className="text-xl font-black text-blue-400">{gCards.length} <span className="text-sm text-slate-500">cartões</span></span>
            </div>
            <div className="w-full flex h-4 rounded-full overflow-hidden border border-slate-800 mb-6 relative z-10">
              <div title={`Novos: ${gStats.new}`} className="bg-blue-500" style={{ width: `${(gStats.new / totalC) * 100}%` }}></div>
              <div title={`Aprender: ${gStats.learning}`} className="bg-rose-500" style={{ width: `${(gStats.learning / totalC) * 100}%` }}></div>
              <div title={`Revisar: ${gStats.review}`} className="bg-emerald-400" style={{ width: `${(gStats.review / totalC) * 100}%` }}></div>
              <div title={`Aprendidos: ${gStats.learned}`} className="bg-slate-600" style={{ width: `${(gStats.learned / totalC) * 100}%` }}></div>
            </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center relative z-10 mt-auto">
          <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold mb-1">Novos</span><span className="text-sm font-semibold text-blue-400">{gStats.new}</span></div>
          <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold mb-1">Aprender</span><span className="text-sm font-semibold text-rose-400">{gStats.learning}</span></div>
          <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold mb-1">Revisar</span><span className="text-sm font-semibold text-emerald-400">{gStats.review}</span></div>
          <div className="flex flex-col"><span className="text-[10px] uppercase text-slate-500 font-bold mb-1">Prontos</span><span className="text-sm font-semibold text-slate-400">{gStats.learned}</span></div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate(); const firstDay = new Date(year, month, 1).getDay();
    const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const cells = []; let monthTotalRevisions = 0;
    
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="p-2"></div>);
    const todayStr = getTodayStr();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d, 12, 0, 0); const y = dateObj.getFullYear(); const m = String(dateObj.getMonth() + 1).padStart(2, '0'); const dy = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dy}`;
      const count = getDailyCount(dateStr); const isToday = dateStr === todayStr; monthTotalRevisions += count;
      
      let bg = 'bg-slate-900/50 border-slate-800 text-slate-400';
      if (count > 0 && count < 5) bg = 'bg-emerald-900/60 border-emerald-900 text-emerald-200';
      if (count >= 5 && count < 15) bg = 'bg-emerald-700/80 border-emerald-700 text-emerald-100';
      if (count >= 15 && count < 30) bg = 'bg-emerald-500 border-emerald-400 text-white';
      if (count >= 30) bg = 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)] text-slate-900 font-bold';

      cells.push(
        <div key={d} className={`relative flex flex-col items-center justify-center h-12 w-full rounded-xl border transition-all hover:scale-110 hover:z-10 cursor-default ${bg}`} title={`${d} de ${monthNames[month]}: ${count} revisões`}>
          <span className="text-sm">{d}</span>
          {isToday && <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></div>}
        </div>
      );
    }
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full relative group animate-pop delay-100">
         <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-400" /> Histórico</h3>
              <div className="flex items-center gap-4 mt-3">
                <button onClick={prevMonth} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{monthNames[month]} {year}</span>
                <button onClick={nextMonth} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="text-right bg-slate-950/50 px-4 py-2 rounded-2xl border border-slate-800/80">
              <span className="text-2xl font-black text-emerald-400">{monthTotalRevisions}</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Neste Mês</p>
            </div>
         </div>
         <div className="relative z-10 w-full mt-2">
           <div className="grid grid-cols-7 gap-1.5 mb-2">{dayNames.map(day => <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{day}</div>)}</div>
           <div className="grid grid-cols-7 gap-1.5">{cells}</div>
         </div>
      </div>
    );
  };

  const renderForecast = () => {
    const allCards = validDecks.flatMap(d => d.cards || []); const today = new Date(); today.setHours(0,0,0,0);
    const forecast = Array(7).fill(0); const labels = [];
    for(let i=0; i<7; i++) {
       const d = new Date(today); d.setDate(today.getDate() + i); labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.',''));
       allCards.forEach(c => { if (c.dueDate) { const cDate = new Date(c.dueDate); cDate.setHours(0,0,0,0); if (cDate.getTime() === d.getTime()) forecast[i]++; } });
    }
    let overdue = 0; allCards.forEach(c => { if (c.dueDate < today.getTime()) overdue++; });
    forecast[0] += overdue; const max = Math.max(...forecast, 10);

    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col h-full relative group animate-pop delay-200">
        <div className="absolute top-0 left-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none"></div>
        <h3 className="text-xl font-bold text-slate-100 mb-8 flex items-center gap-2 relative z-10"><BarChart2 className="w-5 h-5 text-indigo-400" /> Previsão Semanal</h3>
        <div className="flex items-end justify-between flex-grow min-h-[160px] gap-2 relative z-10 mt-auto chart-scroll-container">
           <div className="flex items-end justify-between w-full h-full min-w-min gap-2">
             {forecast.map((val, i) => {
               const height = Math.max((val / max) * 100, 4);
               return (
                 <div key={i} className="flex flex-col items-center gap-3 flex-1 h-full justify-end">
                   <div className="w-full max-w-[40px] relative flex items-end justify-center group/bar h-full bg-slate-950 rounded-t-xl border border-b-0 border-slate-800/80">
                     <div className="w-full bg-indigo-500/80 rounded-t-xl transition-all duration-500 group-hover/bar:bg-indigo-400" style={{ height: `${height}%` }}></div>
                     <span className="absolute -top-7 text-xs font-bold text-slate-300 opacity-0 group-hover/bar:opacity-100 transition-opacity">{val}</span>
                   </div>
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{i === 0 ? 'Hoje' : labels[i]}</span>
                 </div>
               )
             })}
           </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    let daysCount = 7; let days = []; const today = new Date();

    if (reportPeriod === 'all') {
        const dates = Object.keys(activityMap).sort();
        if (dates.length > 0) {
            const firstDate = new Date(dates[0]); const diffTime = Math.abs(today - firstDate);
            daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            for(let i = 0; i < daysCount; i++) { const d = new Date(firstDate); d.setDate(firstDate.getDate() + i); days.push(d); }
        } else { days.push(today); daysCount = 1; }
    } else {
        daysCount = reportPeriod === 'week' ? 7 : 30;
        for(let i = daysCount - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); days.push(d); }
    }

    let totalReviewsPeriod = 0;
    const activityData = days.map(d => {
      const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dy = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dy}`; const count = getDailyCountFiltered(dateStr, reportDeckId); totalReviewsPeriod += count;
      return { label: reportPeriod === 'week' ? d.toLocaleDateString('pt-BR', {weekday: 'short'}).replace('.','') : `${dy}/${m}`, count, date: d };
    });
    
    const maxActivity = Math.max(...activityData.map(a => a.count), 5);
    const minBarWidth = reportPeriod === 'all' || reportPeriod === 'month' ? 'min-w-[12px]' : 'w-full max-w-[32px]';
    const gapSize = reportPeriod === 'all' || reportPeriod === 'month' ? 'gap-0.5' : 'gap-1 sm:gap-2';

    let targetCards = [];
    if (reportDeckId === 'all') { targetCards = validDecks.flatMap(d => d.cards || []); } 
    else { const deck = validDecks.find(d => d.id === reportDeckId); if (deck) targetCards = deck.cards || []; }

    let totalR = 0; let revCardsCount = 0; const retentionBuckets = { exc: 0, good: 0, fair: 0, poor: 0 };
    let matureCount = 0; let youngCount = 0; const now = Date.now();

    targetCards.forEach(c => {
      const state = c.state !== undefined ? c.state : (c.reviews > 0 ? 2 : 0);
      if (state === 2 && c.stability) { 
        revCardsCount++; const elapsed = Math.max((now - (c.last_review || now)) / 86400000, 0); const r = forgetting_curve(elapsed, c.stability); totalR += r;
        if (r >= 0.9) retentionBuckets.exc++; else if (r >= 0.8) retentionBuckets.good++; else if (r >= 0.7) retentionBuckets.fair++; else retentionBuckets.poor++;
        if (c.interval >= 21) matureCount++; else youngCount++;
      } else if (state === 1 || state === 3) { youngCount++; }
    });

    const avgRetention = revCardsCount > 0 ? ((totalR / revCardsCount) * 100).toFixed(1) : 'N/A';
    const totalStudied = revCardsCount + youngCount; const maturePercent = totalStudied > 0 ? Math.round((matureCount / totalStudied) * 100) : 0;

    return (
      <div className="animate-in fade-in duration-300 pb-10 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" /> Métricas de Desempenho FSRS</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <select value={reportDeckId} onChange={e => setReportDeckId(e.target.value)} className="w-full appearance-none bg-slate-950 border border-slate-700 text-slate-300 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:border-indigo-500 text-sm font-medium transition-colors">
                <option value="all">Todos os Baralhos</option>
                {validDecks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <Filter className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex-wrap">
              <button onClick={() => setReportPeriod('week')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${reportPeriod === 'week' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>7 Dias</button>
              <div className="w-px bg-slate-700"></div>
              <button onClick={() => setReportPeriod('month')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${reportPeriod === 'month' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>30 Dias</button>
              <div className="w-px bg-slate-700"></div>
              <button onClick={() => setReportPeriod('all')} className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${reportPeriod === 'all' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>Tudo</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-100">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500"><Activity className="w-32 h-32" /></div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2 relative z-10">Revisões {reportPeriod === 'all' ? '(Total)' : `(${daysCount}d)`}</span>
            <div className="text-4xl sm:text-5xl font-black text-indigo-400 relative z-10">{totalReviewsPeriod}</div>
            <div className="mt-4 text-xs text-slate-500 font-medium relative z-10">Cartões processados no período</div>
          </div>
          
          <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-200">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500"><BrainCircuit className="w-32 h-32" /></div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2 relative z-10">Retenção Estimada</span>
            <div className="text-4xl sm:text-5xl font-black text-emerald-400 relative z-10">{avgRetention === 'N/A' ? '--' : `${avgRetention}%`}</div>
            <div className="mt-4 text-xs text-slate-500 font-medium relative z-10">Estimativa Algorítmica da FSRS (R)</div>
          </div>

          <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-300">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500"><Award className="w-32 h-32" /></div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2 relative z-10">Cartões Maduros</span>
            <div className="flex items-end gap-2 relative z-10">
              <div className="text-4xl sm:text-5xl font-black text-amber-400">{maturePercent}%</div>
              <div className="text-slate-500 font-bold mb-1.5 text-sm sm:text-base">/ {matureCount}</div>
            </div>
            <div className="mt-4 text-xs text-slate-500 font-medium relative z-10">Cartões com intervalo {'>'} 21 dias</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col min-h-[350px] animate-pop delay-400">
            <h3 className="text-slate-200 font-bold flex items-center gap-2 mb-6"><CalendarDays className="w-5 h-5 text-blue-400" /> Histórico de Volume</h3>
            <div className="flex-grow flex items-end justify-between chart-scroll-container">
              <div className={`flex items-end h-full min-w-full ${reportPeriod === 'all' ? 'w-max' : ''} ${gapSize}`}>
                {activityData.map((data, i) => {
                  const height = maxActivity === 0 ? 0 : (data.count / maxActivity) * 100;
                  const showLabel = reportPeriod === 'week' || (reportPeriod === 'month' && i % 3 === 0) || (reportPeriod === 'all' && i % Math.max(1, Math.floor(daysCount / 10)) === 0);
                  return (
                    <div key={i} className="relative flex flex-col items-center flex-1 h-full justify-end group/bar">
                      <div className={`${minBarWidth} bg-slate-950 rounded-t-sm sm:rounded-t-md border border-b-0 border-slate-800/80 relative flex items-end justify-center overflow-hidden h-full`}>
                        <div className="w-full bg-gradient-to-t from-blue-600/80 to-indigo-400/80 rounded-t-sm sm:rounded-t-md transition-all duration-700 ease-out" style={{ height: `${Math.max(height, 2)}%` }}></div>
                        <span className="absolute -top-6 text-[10px] font-bold text-slate-200 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-800 px-1.5 py-0.5 rounded z-10">{data.count}</span>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase mt-2 h-4 truncate w-full text-center">{showLabel ? data.label : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col min-h-[350px] animate-pop delay-400">
            <h3 className="text-slate-200 font-bold flex items-center gap-2 mb-2"><PieChart className="w-5 h-5 text-emerald-400" /> Saúde da Memória</h3>
            <p className="text-sm text-slate-500 mb-8">Probabilidade de lembrança com base no FSRS</p>
            <div className="flex-grow flex flex-col justify-center gap-5 sm:gap-6">
              {[
                { label: 'Excelente (90-100%)', count: retentionBuckets.exc, color: 'bg-emerald-400' },
                { label: 'Bom (80-89%)', count: retentionBuckets.good, color: 'bg-blue-400' },
                { label: 'Razoável (70-79%)', count: retentionBuckets.fair, color: 'bg-amber-400' },
                { label: `Crítico (${'<'}70%)`, count: retentionBuckets.poor, color: 'bg-rose-400' },
              ].map((tier, i) => {
                const pct = revCardsCount === 0 ? 0 : (tier.count / revCardsCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-3 sm:gap-4">
                    <div className="w-28 sm:w-36 shrink-0 text-xs sm:text-sm font-semibold text-slate-300">{tier.label}</div>
                    <div className="flex-grow h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div className={`h-full ${tier.color} transition-all duration-1000 shadow-[0_0_8px_currentColor] opacity-90`} style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="w-8 sm:w-12 text-right text-xs sm:text-sm font-bold text-slate-200">{tier.count}</div>
                  </div>
                )
              })}
            </div>
            {revCardsCount === 0 && <div className="text-center text-sm text-slate-500 mt-4 italic">Sem dados suficientes de revisão para calcular.</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const currentFolders = folders.filter(f => f.parentId === currentFolderId);
    const currentDecks = validDecks.filter(d => d.parentId === currentFolderId);

    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-2 pb-16 sm:pb-0 animate-in fade-in duration-300">
        {/* Desktop Tabs */}
        <div className="hidden sm:flex space-x-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-fit mb-6">
          <button onClick={() => { setMainTab('home'); setCurrentFolderId(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${mainTab === 'home' ? 'bg-slate-800 text-indigo-400 shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
            <Home className="w-4 h-4" /> Início
          </button>
          <button onClick={() => { setMainTab('stats'); setCurrentFolderId(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${mainTab === 'stats' ? 'bg-slate-800 text-indigo-400 shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
            <PieChart className="w-4 h-4" /> Estatísticas
          </button>
          <button onClick={() => { setMainTab('reports'); setCurrentFolderId(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${mainTab === 'reports' ? 'bg-slate-800 text-indigo-400 shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
            <Activity className="w-4 h-4" /> Relatórios
          </button>
        </div>

        {/* Mobile Fixed Bottom Navigation */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex justify-around items-center px-2 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <button onClick={() => { setMainTab('home'); setCurrentFolderId(null); }} className={`flex flex-col items-center justify-center w-full gap-1.5 transition-colors ${mainTab === 'home' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">Início</span>
          </button>
          <button onClick={() => { setMainTab('stats'); setCurrentFolderId(null); }} className={`flex flex-col items-center justify-center w-full gap-1.5 transition-colors ${mainTab === 'stats' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] font-bold">Estatísticas</span>
          </button>
          <button onClick={() => { setMainTab('reports'); setCurrentFolderId(null); }} className={`flex flex-col items-center justify-center w-full gap-1.5 transition-colors ${mainTab === 'reports' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-bold">Relatórios</span>
          </button>
        </div>

        {/* --- INÍCIO (HOME) --- */}
        {mainTab === 'home' && (
          <div className="animate-in fade-in duration-300 pb-10">
            
            {/* Secção Hero com Meta Diária no ecrã inicial principal */}
            {currentFolderId === null && (
              <div className="mb-8 bg-gradient-to-br from-indigo-900/40 to-purple-900/10 border border-indigo-500/20 p-6 sm:p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-xl shadow-indigo-900/10">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="relative z-10 w-full md:w-1/2">
                   <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">{getGreeting()}, pronto para focar?</h2>
                   <p className="text-slate-400">Você tem <strong className="text-indigo-400 text-lg">{calculateTotalDue(globalStats)}</strong> cartões pendentes hoje.</p>
                </div>
                <div className="relative z-10 w-full md:w-1/2 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
                   <div className="flex justify-between text-sm font-medium mb-3">
                     <span className="text-slate-300 flex items-center gap-1.5"><Target className="w-4 h-4 text-rose-400"/> Meta Diária</span>
                     <span className="text-rose-400 font-bold">{getDailyCount(getTodayStr())} / {dailyGoal}</span>
                   </div>
                   <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                     <div className="bg-gradient-to-r from-orange-400 to-rose-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: `${Math.min((getDailyCount(getTodayStr()) / dailyGoal) * 100, 100)}%` }}></div>
                   </div>
                </div>
              </div>
            )}

            {/* Breadcrumbs da Biblioteca */}
            {currentFolderId !== null && (
              <div className="flex items-center gap-2 mb-6 text-sm font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800 w-full overflow-x-auto custom-scrollbar">
                <button onClick={() => setCurrentFolderId(null)} className="flex items-center gap-2 transition-colors whitespace-nowrap hover:text-slate-200"><Home className="w-4 h-4" /> Início</button>
                {breadcrumbs.map(crumb => (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <button onClick={() => setCurrentFolderId(crumb.id)} className={`transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'text-indigo-400' : 'hover:text-slate-200'}`}>{crumb.name}</button>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Novo Painel para Estudar Toda a Pasta Atual (quando aplicável) */}
            {currentFolderId !== null && (
              <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-r from-indigo-900/30 to-slate-900 border border-indigo-500/20 p-5 rounded-2xl shadow-lg gap-4">
                 <div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                       <Folder className="w-5 h-5 text-indigo-400" />
                       {folders.find(f => f.id === currentFolderId)?.name}
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                       <strong className="text-indigo-400">{calculateTotalDue(getFolderStats(currentFolderId))}</strong> cartões pendentes em sub-baralhos.
                    </p>
                 </div>
                 <div className="flex gap-2 w-full sm:w-auto">
                     <button onClick={() => startReview(null, false, currentFolderId)} disabled={calculateTotalDue(getFolderStats(currentFolderId)) === 0} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${calculateTotalDue(getFolderStats(currentFolderId)) > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
                         <Play className="w-4 h-4" fill="currentColor" /> Estudar Tudo
                     </button>
                     <button onClick={() => startReview(null, true, currentFolderId)} disabled={calculateTotalDue(getFolderStats(currentFolderId)) === 0 && getFolderStats(currentFolderId).learned === 0} className={`flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95`} title="Rever ignorando agendamento">
                         <FastForward className="w-4 h-4" fill="currentColor" /> Modo Livre
                     </button>
                 </div>
              </div>
            )}

            <div className="mb-10">
               <div className="flex items-center justify-between mb-5">
                 <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2"><Folder className="w-5 h-5 text-indigo-400" /> Coleções</h2>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                 {currentFolders.map((folder, index) => {
                   const isMenuOpen = activeMenuId === folder.id; const colorClass = folder.color || 'text-indigo-400';
                   return (
                     <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className={`bg-slate-900/50 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between group animate-pop hover:-translate-y-1.5 transition-all duration-300 hover:shadow-xl hover:shadow-${folder.color?.split('-')[1]-500/10}`} style={{animationDelay: `${index * 50}ms`}}>
                       <div className="flex items-center gap-4 truncate">
                         <div className={`p-3 bg-slate-950 rounded-xl shrink-0 ${colorClass}`}>
                           <Folder className="w-6 h-6 absolute opacity-20" /><Folder className="w-6 h-6 relative z-10" />
                         </div>
                         <span className="font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors text-lg truncate">{folder.name}</span>
                       </div>
                       <div className="flex items-center gap-3 shrink-0 ml-2">
                        {renderStatBadges(getFolderStats(folder.id))}
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : folder.id); }} className={`p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-all border border-transparent ${isMenuOpen ? 'opacity-100 bg-slate-800 border-slate-700 text-slate-200' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-800/80 hover:border-slate-700'}`}>
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                              <button onClick={(e) => { openEditModal('folder', folder, e); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</button>
                              <button onClick={(e) => { e.stopPropagation(); setItemToMove({id: folder.id, type: 'folder', name: folder.name, parentId: folder.parentId}); setMoveTargetFolderId(folder.parentId); setIsMoveModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><CornerUpRight className="w-4 h-4" /> Mover</button>
                              <div className="h-px bg-slate-700 w-full"></div>
                              <button onClick={(e) => { e.stopPropagation(); setItemToDelete({id: folder.id, type: 'folder', name: folder.name}); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Eliminar</button>
                            </div>
                          )}
                        </div>
                       </div>
                     </div>
                   )
                 })}
                 <div onClick={() => { setModalMode('create'); setModalType('folder'); setNewItemColor(FOLDER_THEMES[0].color); setIsModalOpen(true); }} className="bg-slate-900/20 rounded-2xl p-5 border-2 border-dashed border-slate-800/60 hover:border-indigo-500/40 cursor-pointer flex items-center gap-4 text-slate-500 hover:text-indigo-400 animate-pop hover:-translate-y-1 transition-all duration-300">
                    <div className="p-3 bg-slate-950/50 rounded-xl"><FolderPlus className="w-6 h-6" /></div>
                    <span className="font-medium">Nova Coleção</span>
                 </div>
               </div>
            </div>

            <div>
               <div className="flex items-center justify-between mb-5">
                 <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2"><BookOpen className="w-5 h-5 text-indigo-400" /> Baralhos</h2>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                 {currentDecks.map((deck, index) => {
                   const stats = getCardStats(deck.cards); const due = calculateTotalDue(stats);
                   const isMenuOpen = activeMenuId === deck.id; const colorClass = deck.color?.includes('text-') ? deck.color : `${deck.color} text-white`;

                   return (
                     <div key={deck.id} onClick={() => { setActiveDeckId(deck.id); setCurrentView('deck-detail'); }} className={`bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 cursor-pointer flex flex-col h-full group relative animate-pop hover:-translate-y-1.5 transition-all duration-300 hover:shadow-xl hover:shadow-${deck.color?.split('-')[1] || 'indigo'}-500/10`} style={{animationDelay: `${index * 50}ms`}}>
                       <div className="flex items-start justify-between mb-4">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${colorClass}`}><BookOpen className="w-6 h-6" /></div>
                         <div className="flex items-center gap-3 shrink-0 ml-2">
                           {renderStatBadges(stats)}
                           <div className="relative" onClick={e => e.stopPropagation()}>
                             <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : deck.id); }} className={`p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-all border border-transparent ${isMenuOpen ? 'opacity-100 bg-slate-800 border-slate-700 text-slate-200' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-800/80 hover:border-slate-700'}`}>
                               <MoreVertical className="w-5 h-5" />
                             </button>
                             {isMenuOpen && (
                               <div className="absolute right-0 top-full mt-2 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                                 <button onClick={(e) => { openEditModal('deck', deck, e); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</button>
                                 <button onClick={(e) => { e.stopPropagation(); setItemToMove({id: deck.id, type: 'deck', name: deck.name, parentId: deck.parentId}); setMoveTargetFolderId(deck.parentId); setIsMoveModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><CornerUpRight className="w-4 h-4" /> Mover</button>
                                 <div className="h-px bg-slate-700 w-full"></div>
                                 <button onClick={(e) => { e.stopPropagation(); setItemToDelete({id: deck.id, type: 'deck', name: deck.name}); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Eliminar</button>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                       <h3 className="text-xl font-bold text-slate-200 mb-2 group-hover:text-indigo-300 transition-colors">{deck.name}</h3>
                       <p className="text-slate-400 text-sm flex-grow line-clamp-2">{deck.description}</p>
                       <div className="mt-6 pt-4 border-t border-slate-800/50 flex justify-between items-center text-sm text-slate-500">
                         <span>{deck.cards?.length || 0} cartões totais</span>
                         <button onClick={(e) => { e.stopPropagation(); startReview(deck.id); }} disabled={due === 0} className={`p-2 rounded-full transition-all ${due > 0 ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:scale-110' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}>
                           <Play className="w-5 h-5" fill="currentColor" />
                         </button>
                       </div>
                     </div>
                   )
                 })}
                 <div onClick={() => { setModalMode('create'); setModalType('deck'); setNewItemColor(DECK_THEMES[0].color); setIsModalOpen(true); }} className="bg-slate-900/30 rounded-2xl p-6 border-2 border-dashed border-slate-800/80 flex flex-col items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-950/10 transition-all duration-300 cursor-pointer min-h-[220px] animate-pop hover:-translate-y-1">
                   <Plus className="w-10 h-10 mb-2" />
                   <span className="font-medium">Novo Baralho</span>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* --- ESTATÍSTICAS (STATS) --- */}
        {mainTab === 'stats' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8 pb-10">
            <div className="lg:col-span-2 xl:col-span-2">{renderCalendar()}</div>
            <div className="lg:col-span-1 xl:col-span-1">{renderMastery()}</div>
            <div className="lg:col-span-2 xl:col-span-3">{renderForecast()}</div>
          </div>
        )}
        
        {/* --- RELATÓRIOS (REPORTS) --- */}
        {mainTab === 'reports' && renderReports()}

      </div>
    );
  };

  const renderDeckDetail = () => {
    if (!activeDeck) return null;
    const stats = getCardStats(activeDeck.cards); const due = calculateTotalDue(stats);
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-2 pb-20 animate-in slide-in-from-right-4 fade-in duration-300">
        <button onClick={() => {
          setCurrentView('dashboard');
          setEditingCardId(null);
          setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer('');
        }} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>

        <div className="bg-slate-900/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-slate-800 mb-8 flex flex-col gap-6 relative group">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0 ${activeDeck.color?.includes('text-') ? activeDeck.color : activeDeck.color + ' text-white'}`}><BookOpen className="w-8 h-8 sm:w-10 sm:h-10" /></div>
              <div><h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">{activeDeck.name}</h1><p className="text-slate-400">Gerir e adicionar cartões de estudo</p></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => startReview(activeDeck.id)} disabled={due === 0} className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 ${due > 0 ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>
                <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Revisar <span className="bg-indigo-500/30 text-indigo-100 px-2 py-0.5 rounded-full text-sm ml-1">{due}</span>
              </button>
              <button onClick={() => startReview(activeDeck.id, true)} disabled={!activeDeck.cards || activeDeck.cards.length === 0} className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 ${activeDeck.cards?.length > 0 ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 shadow-lg' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'}`} title="Adiantar">
                <FastForward className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Estudo Livre
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-6 border-t border-slate-800/50">
            <div className="bg-slate-950/50 rounded-xl p-4 border border-blue-500/20 flex flex-col items-center justify-center"><span className="text-3xl font-black text-blue-400 mb-1">{stats.new}</span><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Novos</span></div>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-rose-500/20 flex flex-col items-center justify-center"><span className="text-3xl font-black text-rose-400 mb-1">{stats.learning}</span><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aprender</span></div>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-emerald-500/20 flex flex-col items-center justify-center"><span className="text-3xl font-black text-emerald-400 mb-1">{stats.review}</span><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revisar</span></div>
            <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 flex flex-col items-center justify-center opacity-80"><span className="text-3xl font-black text-slate-300 mb-1">{stats.learned}</span><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aprendidos</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 sticky top-6">
              <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                {editingCardId ? <Pencil className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />} {editingCardId ? 'Editar Cartão' : 'Novo Cartão'}
              </h3>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2 rounded-xl mb-6 border border-slate-800">
                {CARD_TYPES.map(type => {
                  const IconComp = type.Icon;
                  return (
                    <button key={type.id} type="button" onClick={() => setCardType(type.id)} className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all ${cardType === type.id ? 'bg-indigo-500/20 text-indigo-400 shadow-sm border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent'}`}>
                      <IconComp className="w-4 h-4" /> {type.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSaveCard} className="space-y-4">
                <RichTextEditor label="Frente" placeholder="" value={newCardFront} onChange={setNewCardFront} />

                {cardType === 'choice' && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-400">Opções</label>
                    {choiceOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button type="button" onClick={() => setCorrectOption(idx)} className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${correctOption === idx ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-transparent hover:border-slate-500'}`}><Check className="w-3 h-3" /></button>
                        <input type="text" value={opt} onChange={(e) => updateChoiceOption(idx, e.target.value)} className={`w-full bg-slate-950 border text-sm rounded-lg p-2 focus:outline-none transition-colors ${correctOption === idx ? 'border-emerald-500/50 text-emerald-100' : 'border-slate-800 text-slate-300 focus:border-indigo-500'}`} placeholder="" />
                      </div>
                    ))}
                  </div>
                )}
                {cardType === 'tf' && (
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Qual a certa?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setTfCorrect(true)} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${tfCorrect ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>Verdadeiro</button>
                      <button type="button" onClick={() => setTfCorrect(false)} className={`flex-1 py-2 rounded-lg font-bold border transition-all ${!tfCorrect ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}>Falso</button>
                    </div>
                  </div>
                )}
                {cardType === 'typing' && (
                  <div className="pt-2 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-400 mb-1">Gabarito</label>
                    <input type="text" value={typeAnswer} onChange={(e) => setTypeAnswer(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-indigo-300 font-mono rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="" />
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800">
                  <RichTextEditor label="Verso" placeholder="" value={newCardBack} onChange={setNewCardBack} />
                </div>
                <div className="flex gap-2 mt-4">
                  {editingCardId && <button type="button" onClick={() => {
                    setEditingCardId(null);
                    setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer('');
                  }} className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors">Cancelar</button>}
                  <button type="submit" className={`bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors border border-indigo-500/50 ${editingCardId ? 'w-2/3' : 'w-full'}`}>{editingCardId ? 'Guardar' : 'Adicionar'}</button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">Cartões <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs">{activeDeck.cards?.length || 0}</span></h3>
            {(activeDeck.cards || []).slice().reverse().map((card) => {
              let statusLabel = ''; let statusColor = '';
              if (card.reviews === 0) { statusLabel = 'Novo'; statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
              else if (card.interval === 0) { statusLabel = 'Aprender'; statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20'; }
              else if (card.dueDate <= Date.now()) { statusLabel = 'Revisar'; statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
              else { statusLabel = 'Aprendido'; statusColor = 'text-slate-400 bg-slate-800 border-slate-700'; }

              const typeObj = CARD_TYPES.find(t => t.id === (card.type || 'standard')) || CARD_TYPES[0];
              const TypeIconComp = typeObj.Icon;

              return (
                <div key={card.id} className={`bg-slate-900/80 p-5 rounded-2xl border flex items-start justify-between group transition-all duration-300 anki-content ${editingCardId === card.id ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-800 hover:border-slate-700 hover:-translate-y-1'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow pr-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                           <TypeIconComp className="w-3 h-3" /> {typeObj.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <div className="text-slate-200 font-medium line-clamp-4 text-sm sm:text-base overflow-hidden break-words" dangerouslySetInnerHTML={{ __html: card.front }} />
                    </div>
                    <div className="pt-8">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                        {card.type === 'standard' ? 'Verso' : card.type === 'typing' ? `Gabarito: ${card.typeAnswer}` : card.type === 'tf' ? `Gabarito: ${card.isTrue ? 'V' : 'F'}` : 'Detalhes'}
                      </span>
                      <div className="text-slate-400 line-clamp-4 text-sm sm:text-base overflow-hidden break-words" dangerouslySetInnerHTML={{ __html: card.back }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => editCard(card)} className="text-slate-600 hover:text-indigo-400 p-2 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-indigo-500/10" title="Editar"><Pencil className="w-5 h-5" /></button>
                    <button onClick={() => deleteCard(card.id)} className="text-slate-600 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10" title="Eliminar"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              )
            })}
            {(!activeDeck.cards || activeDeck.cards.length === 0) && <div className="text-center py-10 text-slate-600 border border-dashed border-slate-800 rounded-2xl">Este baralho está vazio.</div>}
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    if (!reviewQueue.length) return null;
    const currentCard = reviewQueue[currentCardIndex];
    const progress = (currentCardIndex / reviewQueue.length) * 100;
    const intervalLabels = [0,1,2,3].map(q => formatInterval(calculateNextReview(currentCard, q).interval));
    const type = currentCard.type || 'standard';

    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col pb-24">
        <div className="flex items-center justify-between mb-8 pt-4 gap-4">
          <button onClick={() => setCurrentView('dashboard')} className="text-slate-500 p-2 rounded-lg hover:bg-slate-800 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
          <div className="flex-grow"><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
        </div>

        <div className="flex-grow flex flex-col justify-center items-center w-full max-w-5xl mx-auto" style={{ perspective: '1000px' }}>
          {type === 'standard' && (
            <div key={currentCard.id} className="w-full animate-slide-right">
              <div 
                className="relative w-full h-[500px] cursor-pointer transition-transform duration-500" 
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} 
                onClick={() => setIsFlipped(prev => !prev)} 
              >
                {/* FRENTE */}
                <div 
                  className="absolute inset-0 w-full h-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <div className="p-6 text-left border-b border-slate-800/50 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600 uppercase">Pergunta</span>
                    <span className="text-xs text-slate-600 bg-slate-950 px-2 py-1 rounded hidden sm:block">Clique para virar</span>
                  </div>
                  <div className="flex-grow flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-2xl sm:text-3xl text-slate-100 text-center w-full" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
                  </div>
                </div>

                {/* VERSO */}
                <div 
                  className="absolute inset-0 w-full h-full bg-indigo-950/40 rounded-3xl border border-indigo-500/20 flex flex-col shadow-2xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="p-6 text-left border-b border-indigo-500/20 flex justify-between items-center">
                    <span className="text-sm font-bold text-indigo-400/50 uppercase">Resposta</span>
                    <button className="p-2 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-400 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}><RefreshCcw className="w-4 h-4" /></button>
                  </div>
                  <div className="flex-grow flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                    <div className="text-2xl sm:text-3xl text-indigo-100 text-center w-full" dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {type !== 'standard' && (
            <div key={currentCard.id} className="w-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl min-h-[400px] animate-slide-right">
              <div className="p-8 border-b border-slate-800/50">
                <div className="text-xl sm:text-3xl font-medium text-slate-100 text-center" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
              </div>
              <div className="flex-grow p-6 sm:px-10 bg-slate-950/50 flex flex-col justify-center gap-4">
                {type === 'choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentCard.options?.map((opt, idx) => {
                      let btnClass = "bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500";
                      if (isFlipped) {
                        if (idx === currentCard.correctOption) btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-300";
                        else if (reviewInteraction === idx) btnClass = "bg-rose-500/20 border-rose-500 text-rose-300";
                        else btnClass = "opacity-30";
                      }
                      return (
                        <button key={idx} disabled={isFlipped} onClick={() => handleInteractiveSubmit(idx)} className={`p-4 rounded-xl border-2 text-left font-medium transition-all flex justify-between text-lg ${btnClass}`}>
                          {opt} <span className="text-xs opacity-30 font-mono hidden sm:block">{idx+1}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {type === 'tf' && (
                  <div className="flex gap-4 h-32">
                    <button disabled={isFlipped} onClick={() => handleInteractiveSubmit(true)} className={`flex-1 rounded-2xl border-2 font-bold text-2xl transition-all ${isFlipped ? (currentCard.isTrue ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'opacity-30') : 'bg-slate-900 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'} relative`}>VERDADEIRO <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">1</span></button>
                    <button disabled={isFlipped} onClick={() => handleInteractiveSubmit(false)} className={`flex-1 rounded-2xl border-2 font-bold text-2xl transition-all ${isFlipped ? (!currentCard.isTrue ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'opacity-30') : 'bg-slate-900 border-rose-500/30 text-rose-500 hover:bg-rose-500/10'} relative`}>FALSO <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">2</span></button>
                  </div>
                )}
                {type === 'typing' && (
                  <div className="w-full flex flex-col items-center gap-4">
                    <input type="text" autoFocus disabled={isFlipped} value={isFlipped ? reviewInteraction : typedInput} onChange={e => setTypedInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && typedInput && handleInteractiveSubmit(typedInput)} className={`w-full max-w-lg bg-transparent border-b-2 text-center text-3xl font-mono p-4 outline-none transition-colors ${!isFlipped ? 'border-indigo-500 text-indigo-300' : ((reviewInteraction || '').toLowerCase() === (currentCard.typeAnswer || '').toLowerCase() ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400 line-through')}`} placeholder="" />
                    {isFlipped && (reviewInteraction || '').toLowerCase() !== (currentCard.typeAnswer || '').toLowerCase() && (
                      <div className="text-emerald-400 font-mono text-2xl animate-pop"><span className="text-slate-500 text-sm block">Correta:</span>{currentCard.typeAnswer}</div>
                    )}
                  </div>
                )}
              </div>
              {isFlipped && currentCard.back && (
                <div className="p-6 bg-indigo-950/30 border-t border-indigo-500/20 text-indigo-100 animate-in fade-in duration-300"><div dangerouslySetInnerHTML={{ __html: currentCard.back }} /></div>
              )}
            </div>
          )}
        </div>

        <div className="h-32 mt-8 flex flex-col justify-center max-w-4xl mx-auto w-full">
          {!isFlipped && type === 'standard' ? (
            <button onClick={() => setIsFlipped(true)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl py-6 rounded-2xl shadow-lg transition-all active:scale-95">Mostrar Resposta</button>
          ) : isFlipped ? (
            <div className="grid grid-cols-4 gap-2 sm:gap-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <button onClick={() => handleAnswer(0)} className="p-4 sm:py-6 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl">
                Errei <span className="text-sm opacity-50 block">{intervalLabels[0]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">1</span>
              </button>
              <button onClick={() => handleAnswer(1)} className="p-4 sm:py-6 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl">
                Difícil <span className="text-sm opacity-50 block">{intervalLabels[1]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">2</span>
              </button>
              <button onClick={() => handleAnswer(2)} className="p-4 sm:py-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl">
                Bom <span className="text-sm opacity-50 block">{intervalLabels[2]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">3</span>
              </button>
              <button onClick={() => handleAnswer(3)} className="p-4 sm:py-6 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl">
                Fácil <span className="text-sm opacity-50 block">{intervalLabels[3]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">4</span>
              </button>
            </div>
          ) : (
            <div className="text-center text-slate-500">Responda para avançar</div>
          )}
        </div>
      </div>
    );
  };

  const renderFinished = () => (
    <div className="max-w-md mx-auto p-6 min-h-[80vh] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
      <div className="w-24 h-24 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-pop"><Sparkles className="w-12 h-12" /></div>
      <h1 className="text-3xl font-bold text-slate-100 mb-2">Sessão Concluída!</h1>
      <p className="text-slate-400 mb-8">Reviu <span className="font-bold text-slate-200">{sessionStats.reviewed}</span> cartões.</p>
      <button onClick={() => setCurrentView('dashboard')} className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"><CheckCircle2 className="w-5 h-5" /> Concluir</button>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col notranslate" translate="no" lang="pt-BR" onClick={() => setActiveMenuId(null)}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      
      {!user ? (
        <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 flex-grow">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 tracking-tight animate-float text-center">Flash Cards</h1>
          
          <button 
            onClick={signInWithGoogle}
            className="flex items-center gap-3 bg-white text-slate-900 hover:bg-slate-200 px-6 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar com o Google
          </button>

          {toast && (
            <div className="fixed bottom-6 right-6 z-[90] animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl shadow-black/50 border backdrop-blur-md bg-rose-950/80 border-rose-500/30 text-rose-200">
                <Info className="w-5 h-5 text-rose-400" />
                <p className="font-medium text-sm">{toast.message}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* CABEÇALHO FLUTUANTE */}
          <header className="w-full px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-between z-40 relative">
            {/* Título */}
            <h1 onClick={() => setCurrentView('dashboard')} className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 tracking-tight cursor-pointer hover:opacity-80 transition-opacity">
              Flash Cards
            </h1>

            {/* Ações */}
            <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur-md p-1.5 rounded-full border border-slate-800/80 shadow-sm">
              <input type="file" accept=".txt,.csv,.colpkg,.apkg,.zip" ref={fileInputRef} onChange={handleUniversalImport} className="hidden" />
              
              <div className={`hidden sm:flex px-3 py-1.5 rounded-full text-sm font-medium items-center gap-1.5 border transition-all ${calculateStreak() > 0 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]' : 'bg-slate-800 text-slate-500 border-slate-700'}`} title="Ofensiva (Dias Seguidos)">
                <Flame className={`w-4 h-4 ${calculateStreak() > 0 ? 'fill-current' : ''}`} /> {calculateStreak()}
              </div>
              
              {isImporting ? (
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : (
                <button onClick={() => fileInputRef.current.click()} className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-full transition-colors" title="Importar">
                  <Upload className="w-4 h-4" />
                </button>
              )}
              
              <div className="w-px h-5 bg-slate-800 mx-1"></div>
              
              <button onClick={toggleFullScreen} className="w-8 h-8 flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-full transition-colors" title="Ecrã Inteiro">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-full transition-colors" title="Sair da Conta">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          <main className="flex-grow w-full pb-24 sm:pb-12">
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'deck-detail' && renderDeckDetail()}
            {currentView === 'review' && renderReview()}
            {currentView === 'finished' && renderFinished()}
          </main>

          {/* WIDGET FLUTUANTE POMODORO (Colapsável p/ Celular) */}
          <div className={`fixed left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-6 z-[50] animate-pop pointer-events-auto transition-all duration-300 ${currentView === 'dashboard' ? 'bottom-24 sm:bottom-6' : 'bottom-6'}`}>
            <div className={`bg-slate-900/95 backdrop-blur-xl border p-1 sm:p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex items-center transition-all duration-500 hover:bg-slate-900 hover:shadow-2xl ${pomoActive ? (pomoMode === 'work' ? 'border-indigo-500/40 shadow-indigo-500/20' : 'border-emerald-500/40 shadow-emerald-500/20') : 'border-slate-700/60'}`}>

              {/* Progress Ring / Play Button */}
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                  <path className="text-slate-800/80" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className={`${pomoMode === 'work' ? 'text-indigo-500' : 'text-emerald-500'} transition-all duration-1000 ease-linear`} strokeWidth="2.5" strokeDasharray={`${(pomoTime / ((pomoMode === 'work' ? pomoWorkDuration : pomoBreakDuration) * 60)) * 100}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <button onClick={() => setPomoActive(!pomoActive)} className={`relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-colors ${pomoActive ? (pomoMode === 'work' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400') : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                   {pomoActive ? <Pause className="w-3 h-3 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current ml-0.5" />}
                </button>
              </div>

              {/* Área Ocultável */}
              <div className={`flex items-center overflow-hidden transition-all duration-500 ease-in-out ${isPomoExpanded ? 'max-w-[300px] opacity-100 ml-1 sm:ml-2' : 'max-w-0 opacity-0 ml-0'}`}>
                {/* Info */}
                <div className="flex flex-col justify-center px-1 sm:px-2 cursor-pointer select-none whitespace-nowrap" onClick={() => setIsPomoSettingsOpen(true)}>
                  <span className={`font-mono text-lg sm:text-xl font-bold tracking-tight leading-none ${pomoActive ? 'text-slate-100' : 'text-slate-300'}`}>
                    {formatPomoTime(pomoTime)}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                    <span className={`text-[8px] sm:text-[9px] uppercase font-bold tracking-wider ${pomoMode === 'work' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                      {pomoMode === 'work' ? 'Foco' : 'Pausa'}
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({length: pomoTotalBlocks}).map((_, i) => (
                         <div key={i} className={`w-1 h-1 rounded-full ${i < currentPomoBlock ? (pomoMode==='work' ? 'bg-indigo-400' : 'bg-emerald-400') : 'bg-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-0.5 pl-1 pr-1 border-l border-slate-700/50 ml-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); setIsPomoSettingsOpen(true); }} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors" title="Configurações">
                    <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setPomoActive(false); setPomoTime(pomoMode === 'work' ? pomoWorkDuration * 60 : pomoBreakDuration * 60); setCurrentPomoBlock(1); }} className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors" title="Reiniciar Ciclo">
                    <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>

              {/* Botão de Expandir/Recolher */}
              <button onClick={() => setIsPomoExpanded(!isPomoExpanded)} className="ml-1 mr-1 p-1 text-slate-500 hover:text-slate-300 rounded-full transition-colors shrink-0">
                {isPomoExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

            </div>
          </div>
        </>
      )}

      {/* MODAL CONFIG POMODORO */}
      {isPomoSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsPomoSettingsOpen(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-400" /> Configurações</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Meta Diária (cartões)</label>
                <input type="number" min="1" max="1000" required value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
              <div className="pt-4 border-t border-slate-800">
                <label className="block text-sm font-medium text-slate-400 mb-1">Total de Blocos do Ciclo</label>
                <input type="number" min="1" max="20" required value={pomoTotalBlocks} onChange={(e) => setPomoTotalBlocks(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tempo de Foco (minutos)</label>
                <input type="number" min="1" max="120" required value={pomoWorkDuration} onChange={(e) => setPomoWorkDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tempo de Pausa (minutos)</label>
                <input type="number" min="1" max="60" required value={pomoBreakDuration} onChange={(e) => setPomoBreakDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button type="button" onClick={() => setIsPomoSettingsOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOVER ITEM */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsMoveModalOpen(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-slate-100 mb-6 flex items-center gap-2"><CornerUpRight className="w-6 h-6 text-indigo-400" /> Mover "{itemToMove?.name}"</h3>
            <div className="space-y-4">
               <label className="block text-sm font-medium text-slate-400">Selecionar Destino</label>
               <select
                   value={moveTargetFolderId || ''}
                   onChange={(e) => setMoveTargetFolderId(e.target.value === '' ? null : e.target.value)}
                   className="w-full bg-slate-950 border border-slate-800 text-slate-300 py-3 px-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
               >
                   {getFolderPaths(itemToMove?.type === 'folder' ? itemToMove.id : null).map(path => (
                       <option key={path.id || 'root'} value={path.id || ''}>{path.path}</option>
                   ))}
               </select>
            </div>
            <div className="flex gap-3 mt-8 pt-4 border-t border-slate-800/50">
               <button onClick={() => setIsMoveModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95">Cancelar</button>
               <button onClick={handleMoveItem} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95">Mover</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setItemToDelete(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20"><Trash2 className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Eliminar {itemToDelete.type === 'folder' ? 'Pasta' : 'Baralho'}?</h3>
            <p className="text-slate-400 mb-6 text-sm">Esta ação é irreversível.</p>
            <div className="flex gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-rose-500/25 active:scale-95">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={closeAndResetModal}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-slate-100 mb-6">{modalMode === 'edit' ? 'Editar ' : 'Criar nov'}{modalType === 'folder' ? 'a Pasta' : 'o Baralho'}</h3>
            <form onSubmit={handleCreateOrEditItem} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                <input type="text" autoFocus value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" />
              </div>
              {modalType === 'deck' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Descrição</label>
                  <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20 custom-scrollbar transition-colors" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2"><Palette className="w-4 h-4" /> Estilo Visual</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {modalType === 'folder' && FOLDER_THEMES.map(theme => (
                    <button key={theme.id} type="button" onClick={() => setNewItemColor(theme.color)} className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-slate-950 border transition-all duration-200 ${newItemColor === theme.color ? 'border-slate-400 scale-110 shadow-lg shadow-black/50' : 'border-slate-800 opacity-70 hover:opacity-100 hover:scale-105'} ${theme.color}`} title={theme.label}>
                      <Folder className="w-6 h-6 fill-current opacity-20 absolute" /><Folder className="w-6 h-6" />
                    </button>
                  ))}
                  {modalType !== 'folder' && DECK_THEMES.map(theme => (
                    <button key={theme.id} type="button" onClick={() => setNewItemColor(theme.color)} className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${theme.color} ${newItemColor === theme.color ? 'ring-2 ring-white ring-offset-2 ring-slate-900 scale-110 z-10' : 'opacity-70 hover:opacity-100 hover:scale-105'}`} title={theme.label}>
                      <BookOpen className="w-6 h-6" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button type="button" onClick={closeAndResetModal} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors active:scale-95">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-95">{modalMode === 'edit' ? 'Guardar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[90] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl shadow-black/50 border backdrop-blur-md ${toast.type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-200' : 'bg-slate-800/90 border-slate-700 text-slate-100'}`}>
            <Info className={`w-5 h-5 ${toast.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`} />
            <p className="font-medium text-sm">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}