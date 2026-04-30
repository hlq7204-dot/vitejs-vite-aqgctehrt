// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
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
  Trophy, Sparkles, Folder, ChevronRight, ChevronLeft, FolderPlus, Upload, 
  Loader2, Info, RefreshCcw, Pencil, MoreVertical, Palette, Layers, List, 
  CheckSquare, Keyboard, Check, X, FastForward, CalendarDays, Target, 
  PieChart, Timer, Pause, RotateCcw, Settings, LayoutDashboard, Library, Flame, BarChart2, LogOut
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

const isFirebaseActive = firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY";

let app, auth, db;
try {
  if (isFirebaseActive) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
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

const globalStyles = `
  .anki-content img { max-width: 100%; max-height: 250px; border-radius: 0.5rem; margin: 0.5rem auto; display: block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
  .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
  .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  .preserve-3d { transform-style: preserve-3d; }
  .swipe-container { user-select: none; -webkit-user-select: none; touch-action: pan-y; }
`;

const calculateNextReview = (card, quality) => {
  let { repetition, interval, easeFactor, reviews } = card;
  const isLearning = repetition === 0;

  if (quality === 0) { 
    repetition = 0; interval = 0;   
    if (!isLearning) easeFactor = Math.max(1.3, easeFactor - 0.20); 
  } else {
    if (isLearning) {
      if (quality === 1) interval = 1; 
      if (quality === 2) interval = 3; 
      if (quality === 3) interval = 6; 
    } else {
      if (quality === 1) { 
        interval = Math.round(interval * 1.2); easeFactor = Math.max(1.3, easeFactor - 0.15); 
      } else if (quality === 2) { 
        interval = Math.round(interval * easeFactor);
      } else if (quality === 3) { 
        interval = Math.round(interval * easeFactor * 1.3); easeFactor += 0.15; 
      }
    }
    repetition += 1;
  }
  const nextDue = interval === 0 ? Date.now() + 60000 : Date.now() + (interval * 24 * 60 * 60 * 1000);
  return { ...card, repetition, interval, easeFactor, dueDate: nextDue, reviews: (reviews || 0) + 1 };
};

const formatInterval = (days) => {
  if (days === 0) return "< 1m";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}m`; 
  return `${Math.round(days / 365)}a`; 
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
      {label && <label className="block text-sm font-medium text-slate-400 mb-1">{label}</label>}
      <div 
        ref={editorRef} 
        contentEditable 
        onInput={handleInput} 
        onPaste={handlePaste} 
        className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 overflow-y-auto min-h-[5rem] max-h-[15rem] cursor-text relative empty:before:content-[attr(data-placeholder)] empty:before:text-slate-700 custom-scrollbar anki-content" 
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

  // Estados com inicialização segura
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

  // Configurações
  const [pomoWorkDuration, setPomoWorkDuration] = useState(() => {
    try { const saved = localStorage.getItem('lumina_pomoWork'); if (saved) return parseInt(saved); } catch(e){} return 25;
  });
  const [pomoBreakDuration, setPomoBreakDuration] = useState(() => {
    try { const saved = localStorage.getItem('lumina_pomoBreak'); if (saved) return parseInt(saved); } catch(e){} return 5;
  });
  const [dailyGoal, setDailyGoal] = useState(() => {
    try { const saved = localStorage.getItem('lumina_dailyGoal'); if (saved) return parseInt(saved); } catch(e){} return 50;
  });

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [mainTab, setMainTab] = useState('overview'); 
  
  const [activeDeckId, setActiveDeckId] = useState(null);
  const activeDeck = decks.find(d => d.id === activeDeckId);
  
  const [calendarMonth, setCalendarMonth] = useState(() => {
     const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  const [reviewQueue, setReviewQueue] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewInteraction, setReviewInteraction] = useState(null); 
  const [typedInput, setTypedInput] = useState(''); 
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });

  // REFs NATIVOS PARA SUPER PERFORMANCE NO SWIPE
  const touchStartRef = useRef(null);
  const currentSwipe = useRef(0);
  const cardRef = useRef(null);
  const swipeLeftOverlayRef = useRef(null);
  const swipeRightOverlayRef = useRef(null);

  const [pomoActive, setPomoActive] = useState(false);
  const [pomoTime, setPomoTime] = useState(pomoWorkDuration * 60);
  const [pomoMode, setPomoMode] = useState('work'); 
  const [isPomoSettingsOpen, setIsPomoSettingsOpen] = useState(false);

  // Modais de Criação
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
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [toast, setToast] = useState(null);

  const stateRef = useRef();
  stateRef.current = { currentView, isFlipped, reviewQueue, currentCardIndex, cardType: reviewQueue[currentCardIndex]?.type || 'standard' };

  // ESCUDO DE PROTEÇÃO LOCAL
  useEffect(() => { localStorage.setItem('lumina_decks', JSON.stringify(decks)); }, [decks]);
  useEffect(() => { localStorage.setItem('lumina_folders', JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem('lumina_activity', JSON.stringify(activityMap)); }, [activityMap]);
  useEffect(() => { localStorage.setItem('lumina_pomoWork', pomoWorkDuration); }, [pomoWorkDuration]);
  useEffect(() => { localStorage.setItem('lumina_pomoBreak', pomoBreakDuration); }, [pomoBreakDuration]);
  useEffect(() => { localStorage.setItem('lumina_dailyGoal', dailyGoal); }, [dailyGoal]);

  // --- FIREBASE INIT & AUTH ---
  useEffect(() => {
    if (!isFirebaseActive || !auth) {
      setIsAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) { console.error("Token de auth:", err); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u); 
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      showToast("Firebase não inicializado corretamente.", "error");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login com Google:", error);
      showToast("Erro ao fazer login. Verifique as configurações.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      setDecks([]);
      setFolders([]);
      setActivityMap({});
      setCurrentView('dashboard');
      setMainTab('overview');
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // --- SYNC DATA (CLOUD) ULTRA-SEGURO ---
  useEffect(() => {
    if (!isFirebaseActive || !user || !db) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activityMap) setActivityMap(data.activityMap);
        if (data.pomoWorkDuration) setPomoWorkDuration(data.pomoWorkDuration);
        if (data.pomoBreakDuration) setPomoBreakDuration(data.pomoBreakDuration);
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

  // RESET REVIEW STATE
  useEffect(() => { 
    setReviewInteraction(null); 
    setTypedInput(''); 
    currentSwipe.current = 0;
  }, [currentCardIndex]);

  // POMODORO TIMER
  useEffect(() => {
    let interval;
    if (pomoActive) {
      interval = setInterval(() => {
        setPomoTime(prev => {
          if (prev <= 1) {
            if (pomoMode === 'work') {
              showToast(`Pomodoro concluído! Pausa de ${pomoBreakDuration} minutos.`, 'info');
              setPomoMode('break'); 
              return pomoBreakDuration * 60;
            } else {
              showToast('Pausa terminada! De volta ao foco.', 'info');
              setPomoMode('work'); 
              setPomoActive(false); 
              return pomoWorkDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pomoActive, pomoMode, pomoBreakDuration, pomoWorkDuration]);

  // ATALHOS DE TECLADO
  useEffect(() => {
    const handleKeyDown = (e) => {
      const s = stateRef.current;
      if (s.currentView !== 'review') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault(); 
        setIsFlipped(prev => !prev);
      } else if (s.isFlipped && s.cardType === 'standard') {
        if (e.key === '1') handleAnswer(0);
        if (e.key === '2') handleAnswer(1);
        if (e.key === '3') handleAnswer(2);
        if (e.key === '4') handleAnswer(3);
      } else if (!s.isFlipped) {
        if (s.cardType === 'choice' && ['1','2','3','4'].includes(e.key)) {
           handleInteractiveSubmit(parseInt(e.key) - 1);
        } else if (s.cardType === 'tf') {
           if (e.key === '1') handleInteractiveSubmit(true);
           if (e.key === '2') handleInteractiveSubmit(false);
        }
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
  
  // --- IDENTIFICAÇÃO E LIMPEZA DE FANTASMAS COM LIMITADOR ---
  const reachableFolders = new Set([null]);
  let changed = true;
  let safetyLimit = 0; 
  while (changed && safetyLimit < 1000) {
    changed = false;
    safetyLimit++;
    for (const f of folders) {
      if (!reachableFolders.has(f.id) && reachableFolders.has(f.parentId)) {
        reachableFolders.add(f.id);
        changed = true;
      }
    }
  }
  const validDecks = decks.filter(d => reachableFolders.has(d.parentId));
  const validCardIds = new Set(validDecks.flatMap(d => (d.cards || []).map(c => c.id)));

  const removeDeletedCardsFromActivity = (idsToRemoveSet) => {
    if (idsToRemoveSet.size === 0) return;
    setActivityMap(prev => {
      let hasChanges = false;
      const newMap = { ...prev };
      for (const dateStr in newMap) {
        const data = newMap[dateStr];
        if (Array.isArray(data)) {
          const filtered = data.filter(id => !idsToRemoveSet.has(id));
          if (filtered.length !== data.length) {
            newMap[dateStr] = filtered;
            hasChanges = true;
          }
        }
      }
      if (hasChanges) syncActivityToCloud(newMap);
      return hasChanges ? newMap : prev;
    });
  };

  const getDailyCount = (dateStr) => {
    const data = activityMap[dateStr];
    if (!data) return 0;
    if (Array.isArray(data)) {
      return data.filter(id => validCardIds.has(id)).length;
    }
    return 0; 
  };

  const calculateStreak = () => {
    let streak = 0; let d = new Date();
    let loopSafeguard = 0; 
    while (loopSafeguard < 3650) { 
      loopSafeguard++;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const str = `${y}-${m}-${dy}`;

      if (getDailyCount(str) > 0) { 
        streak++; d.setDate(d.getDate() - 1); 
      } else if (streak === 0 && str === getTodayStr()) { 
        d.setDate(d.getDate() - 1); 
      } else { 
        break; 
      }
    }
    return streak;
  };

  const getCardStats = (cards) => {
    const now = Date.now();
    return (cards || []).reduce((acc, card) => {
      const r = card.reviews || 0;
      if (r === 0) acc.new++;
      else if (card.interval === 0) acc.learning++;
      else if (card.dueDate <= now) acc.review++;
      else acc.learned++;
      return acc;
    }, { new: 0, learning: 0, review: 0, learned: 0, totalDue: 0 });
  };

  const calculateTotalDue = (stats) => stats.new + stats.learning + stats.review;

  const getDecksInFolder = (folderId, visited = new Set()) => {
    if (visited.has(folderId)) return [];
    visited.add(folderId);
    
    let result = [];
    result.push(...validDecks.filter(d => d.parentId === folderId));
    folders.filter(f => f.parentId === folderId).forEach(sf => { 
      result.push(...getDecksInFolder(sf.id, visited)); 
    });
    return result;
  };

  const getFolderStats = (folderId) => getCardStats(getDecksInFolder(folderId).flatMap(d => d.cards || []));
  const globalStats = getCardStats(validDecks.flatMap(d => d.cards || []));
  const totalPendingGlobal = calculateTotalDue(globalStats);

  const breadcrumbs = [];
  let currId = currentFolderId;
  const visitedCrumb = new Set();
  while (currId && !visitedCrumb.has(currId)) {
    visitedCrumb.add(currId);
    const f = folders.find(f => f.id === currId);
    if (f) { breadcrumbs.unshift(f); currId = f.parentId; } else break;
  }

  // --- FUNÇÕES DE UPDATE NA CLOUD NÃO-BLOQUEANTES ---
  const updateDeckInCloud = (deckData) => {
    if (!isFirebaseActive || !user || !db) return;
    const cleanData = JSON.parse(JSON.stringify(deckData));
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', deckData.id), cleanData).catch(e => console.error("Firebase sync error", e));
  };

  const updateFolderInCloud = (folderData) => {
    if (!isFirebaseActive || !user || !db) return;
    const cleanData = JSON.parse(JSON.stringify(folderData));
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'folders', folderData.id), cleanData).catch(e => console.error("Firebase sync error", e));
  };

  const syncActivityToCloud = (newMap) => {
    if (!isFirebaseActive || !user || !db) return;
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { activityMap: newMap }, { merge: true }).catch(console.error);
  };

  // --- LÓGICA DE ESTUDO ---
  const activeDeckRef = validDecks.find(d => d.id === activeDeckId);

  const startReview = (deckId, forceAll = false) => {
    const deck = validDecks.find(d => d.id === deckId);
    let dueCards = (deck?.cards || []).filter(c => c.dueDate <= Date.now());
    if (forceAll) dueCards = deck?.cards || [];
    if (dueCards.length === 0) return;
    setReviewQueue([...dueCards].sort(() => Math.random() - 0.5));
    setCurrentCardIndex(0); 
    setIsFlipped(false); 
    setSessionStats({ reviewed: 0, correct: 0 });
    setActiveDeckId(deckId); 
    setCurrentView('review');
  };

  const handleAnswer = (quality) => {
    const currentCard = reviewQueue[currentCardIndex];
    const updatedCard = calculateNextReview(currentCard, quality);
    
    if (activeDeckRef) {
      const newDeckData = { ...activeDeckRef, cards: activeDeckRef.cards.map(c => c.id === updatedCard.id ? updatedCard : c) };
      setDecks(prev => prev.map(d => d.id === activeDeckId ? newDeckData : d)); 
      updateDeckInCloud(newDeckData);
    }

    setSessionStats(prev => ({ reviewed: prev.reviewed + 1, correct: prev.correct + (quality > 0 ? 1 : 0) }));

    const todayStr = getTodayStr();
    
    const currentDayData = Array.isArray(activityMap[todayStr]) ? activityMap[todayStr] : [];
    const newActivityMap = { ...activityMap, [todayStr]: [...currentDayData, updatedCard.id] };
    
    setActivityMap(newActivityMap); 
    syncActivityToCloud(newActivityMap);

    let newQueue = [...reviewQueue];
    if (updatedCard.interval === 0) newQueue.push(updatedCard);

    if (currentCardIndex + 1 < newQueue.length) {
      setReviewQueue(newQueue); 
      setIsFlipped(false); 
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setCurrentView('finished');
    }
  };

  const handleInteractiveSubmit = (val) => { 
    setReviewInteraction(val); 
    setIsFlipped(true); 
  };

  // --- NOVA LÓGICA DE SWIPE ULTRA-RÁPIDA (DOM DIRETO) ---
  const onTouchStart = (e) => { 
    const currentCardType = reviewQueue[currentCardIndex]?.type || 'standard';
    if (!isFlipped || currentCardType !== 'standard') return;
    
    touchStartRef.current = e.touches[0].clientX; 
    currentSwipe.current = 0;
  };
  
  const onTouchMove = (e) => { 
    if (!touchStartRef.current || !isFlipped) return;
    
    const diff = e.touches[0].clientX - touchStartRef.current;
    currentSwipe.current = diff;
    
    // Atualização 60FPS direta no DOM (Não causa re-renderização do React)
    if (cardRef.current) {
      cardRef.current.style.transition = 'none';
      cardRef.current.style.transform = `translateX(${diff}px) rotate(${diff * 0.05}deg) rotateY(180deg)`;
    }
    
    if (swipeLeftOverlayRef.current) {
      swipeLeftOverlayRef.current.style.opacity = diff < -20 ? Math.min(Math.abs(diff + 20) / 100, 1) : 0;
    }
    if (swipeRightOverlayRef.current) {
      swipeRightOverlayRef.current.style.opacity = diff > 20 ? Math.min((diff - 20) / 100, 1) : 0;
    }
  };
  
  const onTouchEnd = () => {
    if (!touchStartRef.current) return;
    const diff = currentSwipe.current;
    
    // Limpar efeitos visuais
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0.2, 0.2, 1)';
      cardRef.current.style.transform = 'rotateY(180deg)'; // volta ao normal (virado)
    }
    if (swipeLeftOverlayRef.current) swipeLeftOverlayRef.current.style.opacity = 0;
    if (swipeRightOverlayRef.current) swipeRightOverlayRef.current.style.opacity = 0;
    
    touchStartRef.current = null;
    currentSwipe.current = 0;

    // Disparar a resposta se o deslize for suficientemente longo
    if (diff > 100) handleAnswer(2); // Bom
    else if (diff < -100) handleAnswer(0); // Errei
  };

  const updateChoiceOption = (idx, value) => {
    const newOpts = [...choiceOptions];
    newOpts[idx] = value;
    setChoiceOptions(newOpts);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const finalWork = pomoWorkDuration || 25;
    const finalBreak = pomoBreakDuration || 5;
    const finalGoal = dailyGoal || 50;
    setPomoWorkDuration(finalWork);
    setPomoBreakDuration(finalBreak);
    setDailyGoal(finalGoal);
    setIsPomoSettingsOpen(false);
    
    if (!pomoActive) {
      setPomoTime(pomoMode === 'work' ? finalWork * 60 : finalBreak * 60);
    }

    if (isFirebaseActive && user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), { 
        pomoWorkDuration: finalWork, pomoBreakDuration: finalBreak, dailyGoal: finalGoal 
      }, { merge: true }).catch(console.error);
    }

    showToast("Configurações salvas!");
  };

  // --- IMPORTAÇÃO DE FICHEIROS ---
  const processAnkiImport = async (file) => {
    try {
      setImportProgress('A carregar...');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js');
      await loadScript('https://cdn.jsdelivr.net/npm/fzstd/umd/index.js');

      const initSqlJsFn = window.initSqlJs;
      const JSZipClass = window.JSZip;
      
      if (!initSqlJsFn || !JSZipClass) throw new Error("Bibliotecas falharam.");

      const SQL = await initSqlJsFn({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}` });
      await new Promise(r => setTimeout(r, 100)); 
      
      const zip = new JSZipClass();
      await zip.loadAsync(file);
      
      let dbFile = zip.file("collection.anki21b") || zip.file("collection.anki21") || zip.file("collection.anki2");
      if (!dbFile) throw new Error("Base de dados Anki não encontrada.");
      
      let dbData = await dbFile.async("uint8array");
      if (dbFile.name === "collection.anki21b") {
        if (!window.fzstd) throw new Error("Biblioteca de descompressão falhou.");
        dbData = window.fzstd.decompress(dbData);
      }
      
      const db = new SQL.Database(dbData);

      let mediaMap = {};
      if (zip.file("media")) {
        try {
          const mediaData = await zip.file("media").async("string");
          mediaMap = JSON.parse(mediaData);
        } catch (err) { 
          console.warn("Erro ao ler media map.", err); 
        }
      }

      const mediaAssets = {}; 
      const fileNames = Object.keys(zip.files);
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
        if (decksTable.length > 0 && decksTable[0].values) {
          decksTable[0].values.forEach(row => decksInfo.push({ id: String(row[0]), name: String(row[1]) }));
        }
      } catch (e) {
        try {
          const colQuery = db.exec("SELECT decks FROM col");
          if (colQuery.length > 0 && colQuery[0].values && colQuery[0].values[0]) {
            const parsed = JSON.parse(colQuery[0].values[0][0]);
            Object.values(parsed).forEach(d => {
              decksInfo.push({ id: String(d.id), name: String(d.name) });
            });
          }
        } catch (err) { }
      }

      const newDecksMap = {};
      const newFoldersToCloud = [];
      
      const getOrCreateFolder = (fName, parentId) => {
        let f = newFoldersToCloud.find(x => x.name === fName && x.parentId === parentId) || folders.find(x => x.name === fName && x.parentId === parentId);
        if (f) return f.id;
        const newId = `f-anki-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newFolder = { id: newId, name: fName, parentId, color: 'text-indigo-400' };
        newFoldersToCloud.push(newFolder);
        setFolders(prev => [...prev, newFolder]);
        updateFolderInCloud(newFolder);
        return newId;
      };

      decksInfo.forEach(ankiDeck => {
        if (ankiDeck.name === "Default" && ankiDeck.id === "1") return;
        const pathParts = ankiDeck.name.split(/::|\x1f|\x1e/).map(p => p.trim()).filter(Boolean);
        if (pathParts.length === 0) return;
        let parent = currentFolderId; 
        const deckName = pathParts.pop();
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
            if (newDecksMap[String(row[0])]) newDecksMap[String(row[0])].cards.push(newCard);
            else fallbackDeck.cards.push(newCard);
            importedCount++;
          }
        });
      }
      
      const finalDecks = Object.values(newDecksMap).filter(d => d.cards.length > 0);
      if (fallbackDeck.cards.length > 0) finalDecks.push(fallbackDeck); 
      
      setDecks(prev => [...prev, ...finalDecks]);
      finalDecks.forEach(d => updateDeckInCloud(d));

      if(importedCount > 0) showToast(`${importedCount} cartões importados!`);
      else showToast("Nenhum cartão lido.", "error");

    } catch (e) { 
      showToast(`Erro: ${e.message}`, "error"); 
    } finally { 
      setIsImporting(false); 
      setImportProgress(''); 
    }
  };

  const processTextImport = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      if (text.includes('\x00')) { showToast('Ficheiro binário não suportado.', 'error'); setIsImporting(false); return; }
      const lines = text.split('\n');
      const importedCards = [];
      lines.forEach((line) => {
        if (!line.trim()) return;
        const separator = line.includes('\t') ? '\t' : ',';
        const parts = line.split(separator);
        if (parts.length >= 2) {
          importedCards.push({ id: `c-imp-${Date.now()}-${Math.random()}`, type: 'standard', front: parts[0].replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim(), back: parts[1].replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '').trim(), repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), reviews: 0 });
        }
      });
      if (importedCards.length > 0) {
        const newDeck = { id: `d-imp-${Date.now()}`, name: file.name.split('.')[0], parentId: currentFolderId, description: 'Importado', color: 'bg-emerald-600 text-white', cards: importedCards };
        setDecks(prev => [...prev, newDeck]);
        updateDeckInCloud(newDeck);
        showToast(`${importedCards.length} cartões importados!`);
      }
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const handleUniversalImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsImporting(true);
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'colpkg' || ext === 'apkg' || ext === 'zip') await processAnkiImport(file);
    else processTextImport(file);
    e.target.value = null; 
  };

  // --- CRUD COM INTERFACE OTIMISTA E ANTI-FANTASMAS ---
  const openEditModal = (type, item, e) => {
    e.stopPropagation(); 
    setModalType(type); 
    setModalMode('edit'); 
    setEditingItemId(item.id);
    setNewItemName(item.name); 
    setNewItemDesc(item.description || ''); 
    setNewItemColor(item.color || (type === 'folder' ? FOLDER_THEMES[0].color : DECK_THEMES[0].color));
    setIsModalOpen(true);
  };

  const closeAndResetModal = () => {
    setIsModalOpen(false); 
    setNewItemName(''); 
    setNewItemDesc(''); 
    setEditingItemId(null); 
    setModalMode('create');
  };

  const handleCreateOrEditItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;

    if (modalMode === 'edit') {
      if (modalType === 'folder') {
        const f = folders.find(x => x.id === editingItemId);
        if(f) {
           const updated = { ...f, name: newItemName, color: newItemColor };
           setFolders(prev => prev.map(x => x.id === editingItemId ? updated : x));
           updateFolderInCloud(updated);
        }
      } else {
        const d = validDecks.find(x => x.id === editingItemId);
        if(d) {
           const updated = { ...d, name: newItemName, description: newItemDesc, color: newItemColor };
           setDecks(prev => prev.map(x => x.id === editingItemId ? updated : x));
           updateDeckInCloud(updated);
        }
      }
      showToast(`${modalType === 'folder' ? 'Pasta' : 'Baralho'} atualizado!`);
    } else {
      if (modalType === 'folder') {
        const newFolder = { id: `f-${Date.now()}`, name: newItemName, parentId: currentFolderId, color: newItemColor };
        setFolders(prev => [...prev, newFolder]);
        updateFolderInCloud(newFolder);
      } else {
        const newDeck = { id: `d-${Date.now()}`, name: newItemName, description: newItemDesc, parentId: currentFolderId, color: newItemColor, cards: [] };
        setDecks(prev => [...prev, newDeck]);
        updateDeckInCloud(newDeck);
      }
    }
    
    closeAndResetModal();
  };

  const confirmDelete = () => {
    if (!itemToDelete || !user) return;
    
    if (itemToDelete.type === 'folder') {
      const getAllNestedFolderIds = (folderId) => {
        let ids = [folderId];
        folders.filter(f => f.parentId === folderId).forEach(c => { ids = [...ids, ...getAllNestedFolderIds(c.id)]; });
        return ids;
      };
      const idsToDelete = getAllNestedFolderIds(itemToDelete.id);
      
      const decksToDelete = validDecks.filter(d => idsToDelete.includes(d.parentId));
      const cardIdsToScrub = new Set(decksToDelete.flatMap(d => (d.cards || []).map(c => c.id)));
      
      setFolders(prev => prev.filter(f => !idsToDelete.includes(f.id)));
      setDecks(prev => prev.filter(d => !idsToDelete.includes(d.parentId)));
      removeDeletedCardsFromActivity(cardIdsToScrub);

      if (isFirebaseActive && user && db) {
        idsToDelete.forEach(id => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'folders', id)).catch(e => {}));
        decksToDelete.forEach(d => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', d.id)).catch(e => {}));
      }
      showToast("Pasta eliminada.");
    } else {
      const deckToDelete = validDecks.find(d => d.id === itemToDelete.id);
      const cardIdsToScrub = new Set((deckToDelete?.cards || []).map(c => c.id));
      
      setDecks(prev => prev.filter(d => d.id !== itemToDelete.id));
      removeDeletedCardsFromActivity(cardIdsToScrub);
      
      if (isFirebaseActive && user && db) {
        deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', itemToDelete.id)).catch(e => {});
      }
      if (activeDeckId === itemToDelete.id) { setCurrentView('dashboard'); setActiveDeckId(null); }
      showToast("Baralho eliminado.");
    }
    setItemToDelete(null);
  };

  const handleSaveCard = (e) => {
    e.preventDefault();
    if (!newCardFront.trim() || !user) return;

    let processedCard = { id: editingCardId || `c-${Date.now()}`, type: cardType, front: newCardFront, back: newCardBack, repetition: 0, interval: 0, easeFactor: 2.5, dueDate: Date.now(), reviews: 0 };
    const currentDeck = validDecks.find(d => d.id === activeDeckId);

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
       setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d));
       updateDeckInCloud(updatedDeck);
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
    const currentDeck = validDecks.find(d => d.id === activeDeckId);
    if(currentDeck) {
      const updatedDeck = { ...currentDeck, cards: currentDeck.cards.filter(c => c.id !== cardId) };
      setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d));
      updateDeckInCloud(updatedDeck);
      removeDeletedCardsFromActivity(new Set([cardId]));
    }
  };


  // --- RENDERERS UI ---
  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 notranslate" translate="no"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  // --- LOGIN UI ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 notranslate" translate="no">
        <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center border border-indigo-500/20 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
          <BrainCircuit className="text-indigo-400 w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold mb-3">Lumina Pro</h1>
        <p className="text-slate-400 mb-10 text-center max-w-sm">A sua plataforma de flashcards inteligente. Entre com a sua conta para sincronizar os seus estudos.</p>
        
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
    );
  }

  const renderGlobalPomodoro = () => {
    return (
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-xl shadow-black/50 hover:border-indigo-500/50 transition-all group">
        <button onClick={() => setPomoActive(!pomoActive)} className={`p-2 rounded-xl transition-colors ${pomoActive ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'}`}>
          {pomoActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <div className="flex flex-col min-w-[3.5rem] cursor-pointer pl-1 pr-2" onClick={() => setPomoActive(!pomoActive)}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${pomoMode === 'work' ? 'text-slate-500' : 'text-emerald-500'}`}>{pomoMode === 'work' ? 'Foco' : 'Pausa'}</span>
          <span className={`font-mono font-bold text-lg leading-none ${pomoMode === 'work' ? 'text-indigo-300' : 'text-emerald-400'}`}>{formatPomoTime(pomoTime)}</span>
        </div>
        <div className="w-px h-8 bg-slate-700 mx-1"></div>
        <button onClick={(e) => { e.stopPropagation(); setPomoActive(false); setPomoTime(pomoMode === 'work' ? pomoWorkDuration * 60 : pomoBreakDuration * 60); }} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors" title="Reiniciar">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setIsPomoSettingsOpen(true); setPomoActive(false); }} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors" title="Configurações">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const renderStatBadges = (stats) => {
    if (calculateTotalDue(stats) === 0) return null;
    return (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {stats.new > 0 && <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded" title="Novos">{stats.new}</span>}
        {stats.learning > 0 && <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold px-2 py-0.5 rounded" title="Aprender">{stats.learning}</span>}
        {stats.review > 0 && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded" title="Revisar">{stats.review}</span>}
      </div>
    );
  };

  const renderDailyGoal = () => {
    const todayReviewed = getDailyCount(getTodayStr());
    const goalProgress = Math.min((todayReviewed / dailyGoal) * 100, 100);
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative overflow-hidden group flex flex-col h-full justify-between">
        <div className="absolute top-0 right-0 p-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h3 className="font-bold text-slate-100 flex items-center gap-2"><Target className="w-5 h-5 text-rose-400" /> Meta Diária</h3>
              <span className="text-xl font-black text-rose-400">{todayReviewed} <span className="text-sm text-slate-500">/ {dailyGoal}</span></span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-4 mb-3 overflow-hidden border border-slate-800 relative z-10">
              <div className="bg-gradient-to-r from-orange-400 to-rose-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.5)]" style={{ width: `${goalProgress}%` }}></div>
            </div>
        </div>
        <p className="text-sm font-medium text-slate-400 relative z-10 mt-4">{goalProgress >= 100 ? 'Meta atingida! Excelente trabalho! 🎉' : `Faltam rever ${dailyGoal - todayReviewed} cartões.`}</p>
      </div>
    );
  };

  const renderMastery = () => {
    const gCards = validDecks.flatMap(d => d.cards || []);
    const gStats = getCardStats(gCards);
    const totalC = gCards.length || 1;
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative overflow-hidden group flex flex-col h-full justify-between">
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
    
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    const todayStr = getTodayStr();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d, 12, 0, 0); 
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dy = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dy}`;

      const count = getDailyCount(dateStr); 
      const isToday = dateStr === todayStr;
      monthTotalRevisions += count;
      
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
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full relative group">
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
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col h-full relative group">
        <div className="absolute top-0 left-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none"></div>
        <h3 className="text-xl font-bold text-slate-100 mb-8 flex items-center gap-2 relative z-10"><BarChart2 className="w-5 h-5 text-indigo-400" /> Previsão Semanal</h3>
        <div className="flex items-end justify-between flex-grow min-h-[160px] gap-2 relative z-10 mt-auto">
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
    );
  };

  const renderDashboard = () => {
    const currentFolders = folders.filter(f => f.parentId === currentFolderId);
    const currentDecks = validDecks.filter(d => d.parentId === currentFolderId);
    const streak = calculateStreak();

    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <BrainCircuit className="text-indigo-400 w-8 h-8" />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input type="file" accept=".txt,.csv,.colpkg,.apkg,.zip" ref={fileInputRef} onChange={handleUniversalImport} className="hidden" />
            <div className={`px-4 py-2 rounded-full font-medium flex items-center gap-2 border transition-all ${streak > 0 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              <Flame className={`w-5 h-5 ${streak > 0 ? 'fill-current' : ''}`} /> {streak} dias
            </div>
            {isImporting ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20"><Loader2 className="w-4 h-4 animate-spin" /> {importProgress}</div>
            ) : (
              <button onClick={() => fileInputRef.current.click()} className="p-2.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-full transition-colors" title="Importar pacotes Anki"><Upload className="w-5 h-5" /></button>
            )}
            <div className="w-px h-8 bg-slate-800 mx-1"></div>
            <button onClick={handleLogout} className="p-2.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-full transition-colors" title="Sair da Conta">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex space-x-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 w-full sm:w-fit mb-6 overflow-x-auto custom-scrollbar">
          <button onClick={() => { setMainTab('overview'); setCurrentFolderId(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${mainTab === 'overview' ? 'bg-slate-800 text-indigo-400 shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
            <LayoutDashboard className="w-4 h-4" /> Visão Geral
          </button>
          <button onClick={() => setMainTab('library')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${mainTab === 'library' ? 'bg-slate-800 text-indigo-400 shadow-md border border-slate-700' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
            <Library className="w-4 h-4" /> Biblioteca
          </button>
        </div>

        {mainTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 animate-in fade-in duration-300">
            <div className="lg:col-span-2">{renderCalendar()}</div>
            <div className="lg:col-span-1">{renderForecast()}</div>
            <div className="lg:col-span-2">{renderMastery()}</div>
            <div className="lg:col-span-1">{renderDailyGoal()}</div>
          </div>
        )}

        {mainTab === 'library' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-8 text-sm font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800 w-full overflow-x-auto custom-scrollbar">
              <button onClick={() => setCurrentFolderId(null)} className={`flex items-center gap-2 transition-colors whitespace-nowrap ${currentFolderId === null ? 'text-indigo-400' : 'hover:text-slate-200'}`}><Folder className="w-4 h-4" /> Início</button>
              {breadcrumbs.map(crumb => (
                <React.Fragment key={crumb.id}>
                  <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  <button onClick={() => setCurrentFolderId(crumb.id)} className={`transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'text-indigo-400' : 'hover:text-slate-200'}`}>{crumb.name}</button>
                </React.Fragment>
              ))}
            </div>

            <div className="mb-8">
               <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2"><Folder className="w-5 h-5 text-slate-500" /> Pastas</h2></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {currentFolders.map(folder => {
                   const isMenuOpen = activeMenuId === folder.id; const colorClass = folder.color || 'text-indigo-400';
                   return (
                     <div key={folder.id} onClick={() => setCurrentFolderId(folder.id)} className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between group">
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
                            <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                              <button onClick={(e) => { openEditModal('folder', folder, e); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</button>
                              <div className="h-px bg-slate-700 w-full"></div>
                              <button onClick={(e) => { e.stopPropagation(); setItemToDelete({id: folder.id, type: 'folder', name: folder.name}); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Eliminar</button>
                            </div>
                          )}
                        </div>
                      </div>
                     </div>
                   )
                 })}
                 <div onClick={() => { setModalMode('create'); setModalType('folder'); setNewItemColor(FOLDER_THEMES[0].color); setIsModalOpen(true); }} className="bg-slate-900/20 rounded-2xl p-5 border-2 border-dashed border-slate-800/50 hover:border-indigo-500/30 cursor-pointer flex items-center gap-4 text-slate-500 hover:text-indigo-400">
                    <div className="p-3 bg-slate-950/50 rounded-xl"><FolderPlus className="w-6 h-6" /></div>
                    <span className="font-medium">Nova Pasta</span>
                 </div>
               </div>
            </div>

            <div>
               <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2"><BookOpen className="w-5 h-5 text-slate-500" /> Baralhos</h2></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {currentDecks.map(deck => {
                   const stats = getCardStats(deck.cards); const due = calculateTotalDue(stats);
                   const isMenuOpen = activeMenuId === deck.id; const colorClass = deck.color?.includes('text-') ? deck.color : `${deck.color} text-white`;

                   return (
                     <div key={deck.id} onClick={() => { setActiveDeckId(deck.id); setCurrentView('deck-detail'); }} className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 cursor-pointer flex flex-col h-full group relative">
                       <div className="flex items-start justify-between mb-4">
                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}><BookOpen className="w-6 h-6" /></div>
                         <div className="flex items-center gap-3 shrink-0 ml-2">
                           {renderStatBadges(stats)}
                           <div className="relative" onClick={e => e.stopPropagation()}>
                             <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : deck.id); }} className={`p-1 text-slate-400 hover:text-slate-200 rounded-lg transition-all border border-transparent ${isMenuOpen ? 'opacity-100 bg-slate-800 border-slate-700 text-slate-200' : 'opacity-0 group-hover:opacity-100 hover:bg-slate-800/80 hover:border-slate-700'}`}>
                               <MoreVertical className="w-5 h-5" />
                             </button>
                             {isMenuOpen && (
                               <div className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
                                 <button onClick={(e) => { openEditModal('deck', deck, e); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</button>
                                 <div className="h-px bg-slate-700 w-full"></div>
                                 <button onClick={(e) => { e.stopPropagation(); setItemToDelete({id: deck.id, type: 'deck', name: deck.name}); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Eliminar</button>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                       <h3 className="text-xl font-bold text-slate-200 mb-2">{deck.name}</h3>
                       <p className="text-slate-400 text-sm flex-grow line-clamp-2">{deck.description}</p>
                       <div className="mt-6 pt-4 border-t border-slate-800/50 flex justify-between items-center text-sm text-slate-500">
                         <span>{deck.cards?.length || 0} cartões totais</span>
                         <button onClick={(e) => { e.stopPropagation(); startReview(deck.id); }} disabled={due === 0} className={`p-2 rounded-full transition-colors ${due > 0 ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'}`}>
                           <Play className="w-5 h-5" fill="currentColor" />
                         </button>
                       </div>
                     </div>
                   )
                 })}
                 <div onClick={() => { setModalMode('create'); setModalType('deck'); setNewItemColor(DECK_THEMES[0].color); setIsModalOpen(true); }} className="bg-slate-900/30 rounded-2xl p-6 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 transition-colors cursor-pointer min-h-[220px]">
                   <Plus className="w-10 h-10 mb-2" />
                   <span className="font-medium">Novo Baralho</span>
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeckDetail = () => {
    if (!activeDeck) return null;
    const stats = getCardStats(activeDeck.cards); const due = calculateTotalDue(stats);
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-in fade-in slide-in-from-right-8 duration-300">
        <button onClick={() => {
          setCurrentView('dashboard');
          setEditingCardId(null);
          setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer('');
        }} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>

        <div className="bg-slate-900/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-slate-800 mb-8 flex flex-col gap-6 relative group">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-6">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shrink-0 ${activeDeck.color?.includes('text-') ? activeDeck.color : activeDeck.color + ' text-white'}`}><BookOpen className="w-8 h-8 sm:w-10 sm:h-10" /></div>
              <div><h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">{activeDeck.name}</h1><p className="text-slate-400">{activeDeck.cards?.length || 0} cartões totais</p></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button onClick={() => startReview(activeDeck.id)} disabled={due === 0} className={`px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 ${due > 0 ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/20' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>
                <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Pendentes ({due})
              </button>
              <button onClick={() => startReview(activeDeck.id, true)} disabled={!activeDeck.cards || activeDeck.cards.length === 0} className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 ${activeDeck.cards?.length > 0 ? 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 shadow-lg' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'}`} title="Adiantar">
                <FastForward className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" /> Adiantar Todos
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
              
              <div className="flex gap-1 p-1 bg-slate-950 rounded-xl mb-6 border border-slate-800 overflow-x-auto custom-scrollbar">
                {CARD_TYPES.map(type => {
                  const IconComp = type.Icon;
                  return (
                    <button key={type.id} type="button" onClick={() => setCardType(type.id)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${cardType === type.id ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                      <IconComp className="w-4 h-4" /> {type.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSaveCard} className="space-y-4">
                <RichTextEditor label="Frente (Pergunta)" placeholder="Ex: Capital do Brasil?" value={newCardFront} onChange={setNewCardFront} />

                {cardType === 'choice' && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-400">Opções</label>
                    {choiceOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button type="button" onClick={() => setCorrectOption(idx)} className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border transition-all ${correctOption === idx ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-transparent hover:border-slate-500'}`}><Check className="w-3 h-3" /></button>
                        <input type="text" value={opt} onChange={(e) => updateChoiceOption(idx, e.target.value)} className={`w-full bg-slate-950 border text-sm rounded-lg p-2 focus:outline-none transition-colors ${correctOption === idx ? 'border-emerald-500/50 text-emerald-100' : 'border-slate-800 text-slate-300 focus:border-indigo-500'}`} placeholder={`Opção ${idx + 1}`} />
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
                    <input type="text" value={typeAnswer} onChange={(e) => setTypeAnswer(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-indigo-300 font-mono rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Brasília" />
                  </div>
                )}
                <div className="pt-2 border-t border-slate-800">
                  <RichTextEditor label={cardType === 'standard' ? "Verso" : "Explicação (Opcional)"} placeholder="Adicione notas..." value={newCardBack} onChange={setNewCardBack} />
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
            <h3 className="font-bold text-slate-200 mb-4">Cartões neste baralho ({activeDeck.cards?.length || 0})</h3>
            {(activeDeck.cards || []).slice().reverse().map((card) => {
              let statusLabel = ''; let statusColor = '';
              if (card.reviews === 0) { statusLabel = 'Novo'; statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
              else if (card.interval === 0) { statusLabel = 'Aprender'; statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20'; }
              else if (card.dueDate <= Date.now()) { statusLabel = 'Revisar'; statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
              else { statusLabel = 'Aprendido'; statusColor = 'text-slate-400 bg-slate-800 border-slate-700'; }

              const typeObj = CARD_TYPES.find(t => t.id === (card.type || 'standard')) || CARD_TYPES[0];
              const TypeIconComp = typeObj.Icon;

              return (
                <div key={card.id} className={`bg-slate-900/80 p-5 rounded-2xl border flex items-start justify-between group transition-colors anki-content ${editingCardId === card.id ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-800 hover:border-slate-700'}`}>
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
                        {card.type === 'standard' ? 'Verso' : card.type === 'typing' ? `Gabarito: ${card.typeAnswer}` : card.type === 'tf' ? `Gabarito: ${card.isTrue ? 'V' : 'F'}` : 'Explicação'}
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
      <div className="max-w-3xl mx-auto p-4 sm:p-6 min-h-screen flex flex-col">
        <div className="flex items-center justify-between mb-8 pt-4 gap-4">
          <button onClick={() => setCurrentView('deck-detail')} className="text-slate-500 p-2 rounded-lg hover:bg-slate-800"><ArrowLeft className="w-6 h-6" /></button>
          <div className="flex-grow"><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
        </div>

        <div className="flex-grow flex flex-col justify-center perspective-1000 swipe-container relative">
          
          {/* INDICADORES VISUAIS DO SWIPE */}
          {type === 'standard' && isFlipped && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 sm:px-8 z-50">
              <div ref={swipeLeftOverlayRef} className="flex flex-col items-center opacity-0 transition-opacity duration-100">
                <div className="bg-rose-500 text-white p-4 sm:p-5 rounded-full shadow-[0_0_30px_rgba(244,63,94,0.6)] mb-2">
                  <X className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-bold text-rose-400 text-lg sm:text-xl uppercase tracking-wider bg-slate-950/50 px-3 py-1 rounded-lg backdrop-blur-sm">Errei</span>
              </div>
              <div ref={swipeRightOverlayRef} className="flex flex-col items-center opacity-0 transition-opacity duration-100">
                <div className="bg-emerald-500 text-white p-4 sm:p-5 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.6)] mb-2">
                  <Check className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-bold text-emerald-400 text-lg sm:text-xl uppercase tracking-wider bg-slate-950/50 px-3 py-1 rounded-lg backdrop-blur-sm">Bom</span>
              </div>
            </div>
          )}

          {type === 'standard' && (
            <div 
              ref={cardRef}
              className="relative w-full h-[500px] cursor-pointer preserve-3d transition-transform duration-500" 
              style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} 
              onClick={() => setIsFlipped(prev => !prev)} 
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              <div className="absolute w-full h-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl backface-hidden">
                <div className="p-6 text-left border-b border-slate-800/50 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 uppercase">Pergunta</span>
                  <span className="text-xs text-slate-600 bg-slate-950 px-2 py-1 rounded hidden sm:block">Espaço para virar</span>
                </div>
                <div className="flex-grow flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                  <div className="text-2xl text-slate-100 text-center w-full" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
                </div>
              </div>

              <div className="absolute w-full h-full bg-indigo-950/40 rounded-3xl border border-indigo-500/20 flex flex-col shadow-2xl backface-hidden rotate-y-180">
                <div className="p-6 text-left border-b border-indigo-500/20 flex justify-between items-center">
                  <span className="text-sm font-bold text-indigo-400/50 uppercase">Resposta</span>
                  <button className="p-2 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-400 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}><RefreshCcw className="w-4 h-4" /></button>
                </div>
                <div className="flex-grow flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                  <div className="text-2xl text-indigo-100 text-center w-full" dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                </div>
              </div>
            </div>
          )}

          {type !== 'standard' && (
            <div className="w-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl min-h-[400px]">
              <div className="p-8 border-b border-slate-800/50">
                <div className="text-xl sm:text-2xl font-medium text-slate-100 text-center" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
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
                        <button key={idx} disabled={isFlipped} onClick={() => handleInteractiveSubmit(idx)} className={`p-4 rounded-xl border-2 text-left font-medium transition-all flex justify-between ${btnClass}`}>
                          {opt} <span className="text-xs opacity-30 font-mono hidden sm:block">{idx+1}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {type === 'tf' && (
                  <div className="flex gap-4 h-32">
                    <button disabled={isFlipped} onClick={() => handleInteractiveSubmit(true)} className={`flex-1 rounded-2xl border-2 font-bold text-xl ${isFlipped ? (currentCard.isTrue ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'opacity-30') : 'bg-slate-900 border-emerald-500/30 text-emerald-500'} relative`}>VERDADEIRO <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">1</span></button>
                    <button disabled={isFlipped} onClick={() => handleInteractiveSubmit(false)} className={`flex-1 rounded-2xl border-2 font-bold text-xl ${isFlipped ? (!currentCard.isTrue ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'opacity-30') : 'bg-slate-900 border-rose-500/30 text-rose-500'} relative`}>FALSO <span className="absolute top-2 left-2 text-xs opacity-50 font-mono">2</span></button>
                  </div>
                )}
                {type === 'typing' && (
                  <div className="w-full flex flex-col items-center gap-4">
                    <input type="text" autoFocus disabled={isFlipped} value={isFlipped ? reviewInteraction : typedInput} onChange={e => setTypedInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && typedInput && handleInteractiveSubmit(typedInput)} className={`w-full max-w-md bg-transparent border-b-2 text-center text-2xl font-mono p-4 outline-none ${!isFlipped ? 'border-indigo-500 text-indigo-300' : ((reviewInteraction || '').toLowerCase() === (currentCard.typeAnswer || '').toLowerCase() ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400 line-through')}`} placeholder="Digite..." />
                    {isFlipped && (reviewInteraction || '').toLowerCase() !== (currentCard.typeAnswer || '').toLowerCase() && (
                      <div className="text-emerald-400 font-mono text-xl"><span className="text-slate-500 text-sm block">Correta:</span>{currentCard.typeAnswer}</div>
                    )}
                  </div>
                )}
              </div>
              {isFlipped && currentCard.back && (
                <div className="p-6 bg-indigo-950/30 border-t border-indigo-500/20 text-indigo-100"><div dangerouslySetInnerHTML={{ __html: currentCard.back }} /></div>
              )}
            </div>
          )}
        </div>

        <div className="h-32 mt-8 flex flex-col justify-center">
          {!isFlipped && type === 'standard' ? (
            <button onClick={() => setIsFlipped(true)} className="w-full bg-indigo-600 text-white font-bold text-lg py-5 rounded-2xl shadow-lg">Mostrar Resposta</button>
          ) : isFlipped ? (
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              <button onClick={() => handleAnswer(0)} className="p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl font-bold relative">
                Errei <span className="text-xs opacity-50 block">{intervalLabels[0]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">1</span>
              </button>
              <button onClick={() => handleAnswer(1)} className="p-4 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-2xl font-bold relative">
                Difícil <span className="text-xs opacity-50 block">{intervalLabels[1]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">2</span>
              </button>
              <button onClick={() => handleAnswer(2)} className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl font-bold relative">
                Bom <span className="text-xs opacity-50 block">{intervalLabels[2]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">3</span>
              </button>
              <button onClick={() => handleAnswer(3)} className="p-4 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-2xl font-bold relative">
                Fácil <span className="text-xs opacity-50 block">{intervalLabels[3]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">4</span>
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
      <div className="w-24 h-24 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6"><Sparkles className="w-12 h-12" /></div>
      <h1 className="text-3xl font-bold text-slate-100 mb-2">Sessão Concluída!</h1>
      <p className="text-slate-400 mb-8">Reviu <span className="font-bold text-slate-200">{sessionStats.reviewed}</span> cartões.</p>
      <button onClick={() => setCurrentView('dashboard')} className="w-full mt-8 bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Concluir</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-10 notranslate" translate="no" lang="pt-BR" onClick={() => setActiveMenuId(null)}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      
      {!user ? (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center border border-indigo-500/20 mb-8 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            <BrainCircuit className="text-indigo-400 w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Lumina Pro</h1>
          <p className="text-slate-400 mb-10 text-center max-w-sm">A sua plataforma de flashcards inteligente. Entre com a sua conta para sincronizar os seus estudos.</p>
          
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
        </div>
      ) : (
        <>
          {renderGlobalPomodoro()}
          {currentView === 'dashboard' && renderDashboard()}
          {currentView === 'deck-detail' && renderDeckDetail()}
          {currentView === 'review' && renderReview()}
          {currentView === 'finished' && renderFinished()}
        </>
      )}

      {/* MODALS */}
      {isPomoSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={() => setIsPomoSettingsOpen(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-400" /> Configurações</h3>
            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Meta Diária (cartões)</label>
                <input type="number" min="1" max="1000" required value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="pt-4 border-t border-slate-800">
                <label className="block text-sm font-medium text-slate-400 mb-1">Tempo de Foco (minutos)</label>
                <input type="number" min="1" max="120" required value={pomoWorkDuration} onChange={(e) => setPomoWorkDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tempo de Pausa (minutos)</label>
                <input type="number" min="1" max="60" required value={pomoBreakDuration} onChange={(e) => setPomoBreakDuration(e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button type="button" onClick={() => setIsPomoSettingsOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/25">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {itemToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setItemToDelete(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20"><Trash2 className="w-8 h-8" /></div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Eliminar {itemToDelete.type === 'folder' ? 'Pasta' : 'Baralho'}?</h3>
            <p className="text-slate-400 mb-6 text-sm">Esta ação é irreversível.</p>
            <div className="flex gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-rose-500/25">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={closeAndResetModal}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl shadow-black" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-slate-100 mb-6">{modalMode === 'edit' ? 'Editar ' : 'Criar nov'}{modalType === 'folder' ? 'a Pasta' : 'o Baralho'}</h3>
            <form onSubmit={handleCreateOrEditItem} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                <input type="text" autoFocus value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {modalType === 'deck' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Descrição (opcional)</label>
                  <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20 custom-scrollbar" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2"><Palette className="w-4 h-4" /> Estilo Visual</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {modalType === 'folder' && FOLDER_THEMES.map(theme => (
                    <button key={theme.id} type="button" onClick={() => setNewItemColor(theme.color)} className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-slate-950 border transition-all ${newItemColor === theme.color ? 'border-slate-400 scale-110 shadow-lg shadow-black/50' : 'border-slate-800 opacity-70 hover:opacity-100'} ${theme.color}`} title={theme.label}>
                      <Folder className="w-6 h-6 fill-current opacity-20 absolute" /><Folder className="w-6 h-6" />
                    </button>
                  ))}
                  {modalType !== 'folder' && DECK_THEMES.map(theme => (
                    <button key={theme.id} type="button" onClick={() => setNewItemColor(theme.color)} className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${theme.color} ${newItemColor === theme.color ? 'ring-2 ring-white ring-offset-2 ring-slate-900 scale-110 z-10' : 'opacity-70 hover:opacity-100'}`} title={theme.label}>
                      <BookOpen className="w-6 h-6" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-8 pt-2">
                <button type="button" onClick={closeAndResetModal} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/25">{modalMode === 'edit' ? 'Guardar' : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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