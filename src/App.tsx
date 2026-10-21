// @ts-nocheck
import { Toast } from './components/Toast';
import { RichTextEditor } from './components/RichTextEditor';
import { Header, BrandLogo, MobileBottomNav } from './components/Header';
import { app, auth, db, appId } from './services/firebase';
import {
  clamp,
  forgetting_curve,
  calculateNextReview,
  getEffectiveLapses,
  getCardRatingBreakdown,
  isCardBuried,
  isCardLeech,
  isCardUnlearned,
  checkCardDue,
  formatInterval,
} from './utils/fsrs';
import {
  cleanupData,
  getTodayStr,
  getGreeting,
  parseTagsString,
  getAllGlobalTags,
  getCardStats,
  calculateTotalDue,
} from './utils/helpers';
import {
  buildExportJSONFile,
  buildExportCSVFile,
  parseAnkiPackage,
  parseTextImportContent,
} from './utils/importExport';
import { SettingsModal } from './components/modals/SettingsModal';
import { CustomStudyModal } from './components/modals/CustomStudyModal';
import { FolderDeckModal } from './components/modals/FolderDeckModal';
import { CardEditModal } from './components/modals/CardEditModal';
import {
  StreakRecoveryModal,
  MoveItemModal,
  MoveCardsModal,
  DeleteConfirmModal,
} from './components/modals/ActionModals';
import { StatsView } from './components/stats/StatsWidgets';
import { ReportsView } from './components/views/ReportsView';
import { DashboardView } from './components/views/DashboardView';
import { DeckDetailView } from './components/views/DeckDetailView';
import { ReviewView, FinishedView } from './components/views/ReviewView';
import {
  initialFolders,
  initialDecks,
  FOLDER_THEMES,
  DECK_THEMES,
  CARD_TYPES,
  globalStyles,
} from './constants/themes';
import React, { useState, useEffect, useRef } from 'react';
import { 
  onAuthStateChanged, signInWithPopup, GoogleAuthProvider, 
  signOut, signInWithCustomToken, signInAnonymously 
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

import { 
  BookOpen, Plus, Play, ArrowLeft, CheckCircle2, BrainCircuit, Trash2, 
  Sparkles, Folder, ChevronRight, ChevronLeft, FolderPlus, Upload, 
  Loader2, Info, RefreshCcw, Pencil, MoreVertical, Palette, Layers, List, 
  CheckSquare, Keyboard, Check, FastForward, CalendarDays, Target, 
  PieChart, RotateCcw, Settings, Home, Flame, BarChart2, LogOut,
  Maximize, Minimize, Activity, TrendingUp, Filter, Award, CornerUpRight, X,
  Eye, EyeOff, History, Timer, Send, Volume2, VolumeX, Search, AlertTriangle,
  Download, PauseCircle, PlayCircle, SkipForward, Tag, SlidersHorizontal, Trophy, Gauge
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const firstLoadRefFolders = useRef(true);
  const firstLoadRefDecks = useRef(true);
  const isProcessingRef = useRef(false);
  const hasCleanedUpPhantoms = useRef(false);

  const [decks, setDecks] = useState(() => {
    try { const saved = localStorage.getItem('lumina_decks'); if (saved) { const p = JSON.parse(saved); return Array.isArray(p) ? p : initialDecks; } } catch (e) {}
    return initialDecks;
  });
  const [folders, setFolders] = useState(() => {
    try { const saved = localStorage.getItem('lumina_folders'); if (saved) { const p = JSON.parse(saved); return Array.isArray(p) ? p : initialFolders; } } catch (e) {}
    return initialFolders;
  });
  const [activityMap, setActivityMap] = useState(() => {
    try { const saved = localStorage.getItem('lumina_activity'); if (saved) { const p = JSON.parse(saved); return typeof p === 'object' && !Array.isArray(p) ? p : {}; } } catch (e) {}
    return {};
  });
  
  const [streakRecoveries, setStreakRecoveries] = useState(() => {
    try { const saved = localStorage.getItem('lumina_streakRecoveries'); if (saved) { const p = JSON.parse(saved); return Array.isArray(p) ? p : []; } } catch (e) {}
    return [];
  });
  const [calendarEvents, setCalendarEvents] = useState(() => {
    try { const saved = localStorage.getItem('lumina_calendarEvents'); if (saved) { const p = JSON.parse(saved); return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : {}; } } catch (e) {}
    return {};
  });

  const [dailyGoal, setDailyGoal] = useState(() => {
    try { const saved = localStorage.getItem('lumina_dailyGoal'); if (saved) return parseInt(saved); } catch(e){} return 50;
  });

  const [desiredRetention, setDesiredRetention] = useState(() => {
    try {
      const saved = localStorage.getItem('lumina_desiredRetention');
      if (saved) return clamp(parseFloat(saved), 0.75, 0.97);
    } catch (e) {}
    return 0.90;
  });

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [mainTab, setMainTab] = useState('home'); 
  const [reportPeriod, setReportPeriod] = useState('week'); 
  const [forecastPeriod, setForecastPeriod] = useState('week');
  const [reportDeckId, setReportDeckId] = useState('all'); 
  
  const [activeDeckId, setActiveDeckId] = useState(null);

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
  const activeDeck = validDecks.find(d => d.id === activeDeckId) || decks.find(d => d.id === activeDeckId);
  
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  const [reviewQueue, setReviewQueue] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewInteraction, setReviewInteraction] = useState(null); 
  const [typedInput, setTypedInput] = useState(''); 
  const [eliminatedOptions, setEliminatedOptions] = useState(new Set()); 
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  
  const [reviewHistory, setReviewHistory] = useState([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [streakRecoveryDate, setStreakRecoveryDate] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [cardType, setCardType] = useState('standard');
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState(''); 
  const [choiceOptions, setChoiceOptions] = useState(['', '', '', '']); 
  const [correctOption, setCorrectOption] = useState(0);
  const [tfCorrect, setTfCorrect] = useState(true);
  const [typeAnswer, setTypeAnswer] = useState('');
  const [cardTagsInput, setCardTagsInput] = useState('');
  const [editingCardId, setEditingCardId] = useState(null); 
  const [isCardEditModalOpen, setIsCardEditModalOpen] = useState(false);
  
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [isMoveCardsModalOpen, setIsMoveCardsModalOpen] = useState(false);
  const [moveCardsTargetDeckId, setMoveCardsTargetDeckId] = useState(null);

  const [deckSearchQuery, setDeckSearchQuery] = useState('');
  const [deckStatusFilter, setDeckStatusFilter] = useState('all');
  const [deckTypeFilter, setDeckTypeFilter] = useState('all');
  const [deckTagFilter, setDeckTagFilter] = useState('all');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isCustomStudyModalOpen, setIsCustomStudyModalOpen] = useState(false);
  const [customStudyConfig, setCustomStudyConfig] = useState({
    sourceType: 'all', // 'all' | 'folder' | 'deck'
    sourceId: null,
    preset: 'cram', // 'cram' | 'leeches' | 'new_only' | 'interactive' | 'due_only'
    cardType: 'all',
    tag: 'all',
    limit: 20
  });

  const fileInputRef = useRef(null);
  const backupInputRef = useRef(null);
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

  const stateRef = useRef({});

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };

  const syncDataToCloud = (newMap, newRecs, newCalEvents = null) => {
    if (!user || !db) return;
    const payload = {};
    if (newMap) payload.activityMap = newMap;
    if (newRecs) payload.streakRecoveries = newRecs;
    if (newCalEvents) payload.calendarEvents = newCalEvents;
    if (Object.keys(payload).length > 0) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), payload, { merge: true }).catch(console.error);
    }
  };

  const handleUpdateCalendarEvents = (newEvents) => {
    setCalendarEvents(newEvents);
    syncDataToCloud(null, null, newEvents);
  };

  useEffect(() => { try { localStorage.setItem('lumina_decks', JSON.stringify(decks)); } catch(e){} }, [decks]);
  useEffect(() => { try { localStorage.setItem('lumina_folders', JSON.stringify(folders)); } catch(e){} }, [folders]);
  useEffect(() => { try { localStorage.setItem('lumina_activity', JSON.stringify(activityMap)); } catch(e){} }, [activityMap]);
  useEffect(() => { try { localStorage.setItem('lumina_streakRecoveries', JSON.stringify(streakRecoveries)); } catch(e){} }, [streakRecoveries]);
  useEffect(() => { try { localStorage.setItem('lumina_calendarEvents', JSON.stringify(calendarEvents)); } catch(e){} }, [calendarEvents]);

  useEffect(() => {
    if (!hasCleanedUpPhantoms.current && Object.keys(activityMap).length > 0) {
      const { cleanMap, cleanRecoveries, hasChanges } = cleanupData(activityMap, streakRecoveries);
      if (hasChanges) {
        setActivityMap(cleanMap);
        setStreakRecoveries(cleanRecoveries);
        syncDataToCloud(cleanMap, cleanRecoveries);
      }
      hasCleanedUpPhantoms.current = true;
    }
  }, [activityMap, streakRecoveries]);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else if (!auth.currentUser) {
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

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else {
          setIsFullscreen(prev => !prev);
          showToast("Tela cheia nativa restrita na prévia. Abra em uma nova guia para usar.", "info");
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      setIsFullscreen(prev => !prev);
      showToast("Tela cheia nativa restrita neste ambiente de prévia.", "info");
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) return showToast("Firebase não inicializado corretamente.", "error");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast("Conectado com o Google com sucesso!");
    } catch (error) {
      showToast("Não foi possível abrir o pop-up do Google neste ambiente.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      setDecks([]); setFolders([]); setActivityMap({}); setStreakRecoveries([]); setCalendarEvents({});
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
        
        const currentDataMap = data.activityMap || {};
        const currentDataRecs = data.streakRecoveries || [];
        const { cleanMap, cleanRecoveries, hasChanges } = cleanupData(currentDataMap, currentDataRecs);

        setActivityMap(cleanMap);
        setStreakRecoveries(cleanRecoveries);

        if (hasChanges) {
          setDoc(profileRef, { activityMap: cleanMap, streakRecoveries: cleanRecoveries }, { merge: true }).catch(console.error);
        }

        if (data.calendarEvents && typeof data.calendarEvents === 'object') setCalendarEvents(data.calendarEvents);
        if (data.dailyGoal) setDailyGoal(data.dailyGoal);
        if (data.desiredRetention) setDesiredRetention(clamp(parseFloat(data.desiredRetention), 0.75, 0.97));
      } else {
        const localActivity = localStorage.getItem('lumina_activity');
        const activityToSync = localActivity ? JSON.parse(localActivity) : {};
        const localRecs = localStorage.getItem('lumina_streakRecoveries');
        const recsToSync = localRecs ? JSON.parse(localRecs) : [];
        const localCalEvents = localStorage.getItem('lumina_calendarEvents');
        const calEventsToSync = localCalEvents ? JSON.parse(localCalEvents) : {};
        setDoc(profileRef, { activityMap: activityToSync, streakRecoveries: recsToSync, calendarEvents: calEventsToSync, dailyGoal: 50, desiredRetention: 0.90 }).catch(console.error);
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

  useEffect(() => { 
    setReviewInteraction(null); 
    setTypedInput(''); 
    setEliminatedOptions(new Set()); 
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [currentCardIndex, isFlipped, currentView]);

  const speakCardText = (htmlContent, e) => {
    if (e) e.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast("Seu navegador não suporta leitura em voz alta.", "error");
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent || '';
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').replace(/\s+/g, ' ').trim();
    if (!plainText) {
      showToast("Nenhum texto disponível para leitura neste lado.", "info");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const s = stateRef.current;
      if (!s || s.currentView !== 'review') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      
      if (e.code === 'Space') { 
        e.preventDefault(); 
        if (s.cardType === 'standard' || s.isFlipped) {
          setIsFlipped(prev => !prev); 
        }
      } 
      else if (s.isFlipped) {
        if (e.key === '1') s.handleAnswer(0); 
        if (e.key === '2') s.handleAnswer(1);
        if (e.key === '3') s.handleAnswer(2); 
        if (e.key === '4') s.handleAnswer(3);
      } else if (!s.isFlipped) {
        if (s.cardType === 'choice' && ['1','2','3','4','5','6'].includes(e.key)) {
          const idx = parseInt(e.key) - 1;
          const currentOptsLen = s.reviewQueue[s.currentCardIndex]?.options?.length || 4;
          if (idx < currentOptsLen && !eliminatedOptions.has(idx)) {
            s.handleInteractiveSubmit(idx);
          }
        }
        else if (s.cardType === 'tf') { 
          if (e.key === '1') s.handleInteractiveSubmit(true); 
          if (e.key === '2') s.handleInteractiveSubmit(false); 
        }
      }
      
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (s.handleUndo) s.handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [eliminatedOptions]); 

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
      if (hasChanges) syncDataToCloud(newMap, null);
      return hasChanges ? newMap : prev;
    });
  };

  const getDailyCount = (dateStr) => {
    const data = activityMap[dateStr];
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    return 0; 
  };

  const getDailyCountFiltered = (dateStr, deckId) => {
    const data = activityMap[dateStr];
    if (!data || !Array.isArray(data)) return 0;
    if (deckId === 'all') return data.length;
    
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
      
      const isCompleted = getDailyCount(str) > 0 || streakRecoveries.includes(str);

      if (isCompleted) { 
        streak++; 
        d.setDate(d.getDate() - 1); 
      } else if (streak === 0 && str === getTodayStr()) { 
        d.setDate(d.getDate() - 1); 
      } else { 
        break; 
      }
    }
    return streak;
  };

  const calculateLongestStreak = () => {
    const activeDatesSet = new Set([
      ...Object.keys(activityMap).filter(k => getDailyCount(k) > 0),
      ...(streakRecoveries || [])
    ]);
    if (activeDatesSet.size === 0) return 0;

    const sortedDates = Array.from(activeDatesSet).sort();
    let maxStreak = 1;
    let currentRun = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1] + 'T12:00:00');
      const currDate = new Date(sortedDates[i] + 'T12:00:00');
      const diffDays = Math.round((currDate - prevDate) / 86400000);
      if (diffDays === 1) {
        currentRun++;
        if (currentRun > maxStreak) maxStreak = currentRun;
      } else if (diffDays > 1) {
        currentRun = 1;
      }
    }
    return Math.max(maxStreak, calculateStreak());
  };

  const getRecoveriesCountForMonth = (yearMonthStr) => {
    return streakRecoveries.filter(d => d.startsWith(yearMonthStr)).length;
  };

  const confirmRecoverStreak = () => {
    if(!streakRecoveryDate) return;
    const yearMonthStr = streakRecoveryDate.substring(0, 7);
    
    if (getRecoveriesCountForMonth(yearMonthStr) >= 2) {
      showToast("Limite de 2 recuperações por mês atingido.", "error");
    } else {
      const newRecs = [...streakRecoveries, streakRecoveryDate];
      setStreakRecoveries(newRecs);
      syncDataToCloud(null, newRecs);
      showToast("Ofensiva recuperada com sucesso!");
    }
    setStreakRecoveryDate(null);
  };

  const getDecksInFolder = (folderId, visited = new Set()) => {
    if (visited.has(folderId)) return [];
    visited.add(folderId);
    let result = [];
    result.push(...validDecks.filter(d => d.parentId === folderId));
    folders.filter(f => f.parentId === folderId).forEach(sf => { result.push(...getDecksInFolder(sf.id, visited)); });
    return result;
  };

  const getFolderStats = (folderId) => getCardStats(getDecksInFolder(folderId).filter(d => !d.isIgnored).flatMap(d => d.cards || []));
  const globalStats = getCardStats(validDecks.filter(d => !d.isIgnored).flatMap(d => d.cards || []));

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
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'decks', deckData.id), cleanData)
    .catch(e => {
      console.error("Firebase sync error", e);
      if (e.message && e.message.toLowerCase().includes('exceeds the limit')) {
        showToast("Falha ao sincronizar: O baralho excedeu o limite de tamanho (1MB). Reduza a quantidade de imagens.", "error");
      } else {
        showToast("Erro ao sincronizar na nuvem.", "error");
      }
    });
  };

  const updateFolderInCloud = (folderData) => {
    if (!user || !db) return;
    const cleanData = JSON.parse(JSON.stringify(folderData));
    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'folders', folderData.id), cleanData).catch(e => console.error("Firebase sync error", e));
  };

  const toggleIgnoreDeck = (deck, e) => {
    e.stopPropagation();
    const updatedDeck = { ...deck, isIgnored: !deck.isIgnored };
    setDecks(prev => prev.map(d => d.id === deck.id ? updatedDeck : d));
    updateDeckInCloud(updatedDeck);
    showToast(updatedDeck.isIgnored ? "Baralho ignorado das estatísticas." : "Baralho reativado.");
  };

  const startReview = (deckId, forceAll = false, folderId = null) => {
    let dueCards = [];
    if (folderId) {
      const decksToStudy = getDecksInFolder(folderId).filter(d => !d.isIgnored);
      decksToStudy.forEach(deck => {
        let cards = (deck.cards || []).filter(c => checkCardDue(c));
        if (forceAll) cards = deck.cards || [];
        cards = cards.map(c => ({ ...c, _deckId: deck.id }));
        dueCards.push(...cards);
      });
      setActiveDeckId(null);
    } else {
      const deck = validDecks.find(d => d.id === deckId);
      if (!deck || deck.isIgnored) {
        if(deck?.isIgnored) showToast("Este baralho está ignorado.", "info");
        return;
      }
      let cards = (deck.cards || []).filter(c => checkCardDue(c));
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
    setReviewHistory([]); 
    setCurrentView('review');
  };

  const openCustomStudyModal = (sourceType = 'all', sourceId = null) => {
    setCustomStudyConfig({
      sourceType,
      sourceId,
      preset: 'cram',
      cardType: 'all',
      tag: 'all',
      limit: 20
    });
    setIsCustomStudyModalOpen(true);
  };

  const getFilteredCustomStudyCards = (config = customStudyConfig) => {
    let sourceDecks = [];
    if (config.sourceType === 'deck' && config.sourceId) {
      const d = validDecks.find(x => x.id === config.sourceId);
      if (d) sourceDecks = [d];
    } else if (config.sourceType === 'folder' && config.sourceId) {
      sourceDecks = getDecksInFolder(config.sourceId).filter(d => !d.isIgnored);
    } else {
      sourceDecks = validDecks.filter(d => !d.isIgnored);
    }

    let pool = [];
    sourceDecks.forEach(deck => {
      (deck.cards || []).forEach(c => {
        if (c.isSuspended) return;
        pool.push({ ...c, _deckId: deck.id });
      });
    });

    if (config.preset === 'leeches') {
      pool = pool.filter(c => isCardLeech(c));
    } else if (config.preset === 'unlearned') {
      pool = pool.filter(c => isCardUnlearned(c));
    } else if (config.preset === 'new_only') {
      pool = pool.filter(c => (c.state === 0 || !c.reviews));
    } else if (config.preset === 'interactive') {
      pool = pool.filter(c => ['choice', 'tf', 'typing'].includes(c.type || 'standard'));
    } else if (config.preset === 'due_only') {
      pool = pool.filter(c => checkCardDue(c));
    }

    if (config.cardType !== 'all') {
      if (config.cardType === 'choice_tf') {
        pool = pool.filter(c => c.type === 'choice' || c.type === 'tf');
      } else {
        pool = pool.filter(c => (c.type || 'standard') === config.cardType);
      }
    }

    if (config.tag !== 'all') {
      pool = pool.filter(c => Array.isArray(c.tags) && c.tags.includes(config.tag));
    }

    return pool;
  };

  const handleStartCustomStudy = (e) => {
    if (e) e.preventDefault();
    const matched = getFilteredCustomStudyCards(customStudyConfig);
    if (matched.length === 0) {
      showToast("Nenhum cartão encontrado com esses filtros.", "info");
      return;
    }

    const shuffled = [...matched].sort(() => Math.random() - 0.5);
    const finalQueue = customStudyConfig.limit > 0 ? shuffled.slice(0, customStudyConfig.limit) : shuffled;

    if (customStudyConfig.sourceType === 'deck' && customStudyConfig.sourceId) {
      setActiveDeckId(customStudyConfig.sourceId);
    } else {
      setActiveDeckId(null);
    }

    setReviewQueue(finalQueue);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionStats({ reviewed: 0, correct: 0 });
    setReviewHistory([]);
    setIsCustomStudyModalOpen(false);
    setCurrentView('review');
    showToast(`Treino personalizado iniciado (${finalQueue.length} cartões)!`);
  };

  const handleAnswer = (quality) => {
    const currentCard = reviewQueue[currentCardIndex];
    setReviewHistory(prev => [...prev, { card: currentCard, index: currentCardIndex, queue: [...reviewQueue], quality, sessionStats: { ...sessionStats } }]);

    const updatedCard = calculateNextReview(currentCard, quality, desiredRetention);
    const cType = currentCard.type || 'standard';
    if (cType !== 'standard' && reviewInteraction !== null) {
      let wasCorrect = false;
      if (cType === 'choice') wasCorrect = reviewInteraction === currentCard.correctOption;
      else if (cType === 'tf') wasCorrect = reviewInteraction === (currentCard.isTrue !== false);
      else if (cType === 'typing') {
        wasCorrect = String(reviewInteraction).trim().toLowerCase() === String(currentCard.typeAnswer || '').trim().toLowerCase();
      }
      const prevInteractive = currentCard.interactiveStats || { attempts: 0, correct: 0 };
      updatedCard.interactiveStats = {
        attempts: (prevInteractive.attempts || 0) + 1,
        correct: (prevInteractive.correct || 0) + (wasCorrect ? 1 : 0)
      };
    }

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
    
    setActivityMap(newActivityMap); syncDataToCloud(newActivityMap, null);

    let newQueue = [...reviewQueue];
    // Cartões marcados como "Errei" (quality === 0) voltam para o fim da fila na sessão atual
    if (quality === 0) newQueue.push({ ...updatedCard, _deckId: currentCard._deckId });
    if (currentCardIndex + 1 < newQueue.length) { setReviewQueue(newQueue); setIsFlipped(false); setCurrentCardIndex(prev => prev + 1); } 
    else setCurrentView('finished');
  };

  const handleUndo = () => {
    if (reviewHistory.length === 0) return;
    const lastState = reviewHistory[reviewHistory.length - 1];
    const targetDeckId = lastState.card._deckId || activeDeckId;
    const targetDeck = validDecks.find(d => d.id === targetDeckId);

    if (targetDeck) {
      const cleanOldCard = { ...lastState.card };
      delete cleanOldCard._deckId; 
      
      const restoredCards = targetDeck.cards.map(c => c.id === cleanOldCard.id ? cleanOldCard : c);
      const updatedDeck = { ...targetDeck, cards: restoredCards };
      setDecks(prev => prev.map(d => d.id === targetDeck.id ? updatedDeck : d)); 
      updateDeckInCloud(updatedDeck);
    }

    // Reverte também o registro no activityMap do dia para não inflar estatísticas
    const todayStr = getTodayStr();
    if (Array.isArray(activityMap[todayStr])) {
      const currentList = [...activityMap[todayStr]];
      const lastIdx = currentList.lastIndexOf(lastState.card.id);
      if (lastIdx !== -1) {
        currentList.splice(lastIdx, 1);
        const newActivityMap = { ...activityMap, [todayStr]: currentList };
        setActivityMap(newActivityMap);
        syncDataToCloud(newActivityMap, null);
      }
    }

    setSessionStats(lastState.sessionStats); setReviewQueue(lastState.queue); setCurrentCardIndex(lastState.index);
    setIsFlipped(true); setReviewHistory(prev => prev.slice(0, -1));
  };

  const handleDeleteReviewCard = () => {
    const currentCard = reviewQueue[currentCardIndex];
    const targetDeckId = currentCard._deckId || activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);
    
    if (currentDeck) {
      const updatedDeck = { ...currentDeck, cards: currentDeck.cards.filter(c => c.id !== currentCard.id) };
      setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d));
      updateDeckInCloud(updatedDeck);
      removeDeletedCardsFromActivity(new Set([currentCard.id]));
      
      const newQueue = reviewQueue.filter(c => c.id !== currentCard.id);
      
      if (newQueue.length === 0) setCurrentView('finished');
      else {
        setReviewQueue(newQueue);
        if (currentCardIndex >= newQueue.length) setCurrentCardIndex(newQueue.length - 1);
        setIsFlipped(false); setReviewInteraction(null); setTypedInput(''); setEliminatedOptions(new Set());
      }
      setReviewHistory([]);
      showToast("Cartão excluído com sucesso!");
    }
  };

  const handleBuryReviewCard = () => {
    const currentCard = reviewQueue[currentCardIndex];
    const targetDeckId = currentCard._deckId || activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);
    if (!currentDeck || !currentCard) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const buriedUntil = tomorrow.getTime();

    const updatedDeck = {
      ...currentDeck,
      cards: currentDeck.cards.map(c => c.id === currentCard.id ? { ...c, buriedUntil } : c)
    };
    setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d));
    updateDeckInCloud(updatedDeck);

    const newQueue = reviewQueue.filter((_, idx) => idx !== currentCardIndex);
    if (newQueue.length === 0 || currentCardIndex >= newQueue.length) {
      if (newQueue.length === 0) setCurrentView('finished');
      else setCurrentCardIndex(newQueue.length - 1);
    }
    setReviewQueue(newQueue);
    setIsFlipped(false); setReviewInteraction(null); setTypedInput(''); setEliminatedOptions(new Set());
    showToast("Cartão enterrado até amanhã!");
  };

  const handleSuspendReviewCard = () => {
    const currentCard = reviewQueue[currentCardIndex];
    const targetDeckId = currentCard._deckId || activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);
    if (!currentDeck || !currentCard) return;

    const updatedDeck = {
      ...currentDeck,
      cards: currentDeck.cards.map(c => c.id === currentCard.id ? { ...c, isSuspended: true } : c)
    };
    setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d));
    updateDeckInCloud(updatedDeck);

    const newQueue = reviewQueue.filter((_, idx) => idx !== currentCardIndex);
    if (newQueue.length === 0 || currentCardIndex >= newQueue.length) {
      if (newQueue.length === 0) setCurrentView('finished');
      else setCurrentCardIndex(newQueue.length - 1);
    }
    setReviewQueue(newQueue);
    setIsFlipped(false); setReviewInteraction(null); setTypedInput(''); setEliminatedOptions(new Set());
    showToast("Cartão suspenso! Você pode reativá-lo no baralho.");
  };

  const toggleSuspendCard = (cardId) => {
    if (!activeDeck) return;
    let newlySuspended = false;
    const updatedCards = (activeDeck.cards || []).map(c => {
      if (c.id === cardId) {
        newlySuspended = !c.isSuspended;
        return { ...c, isSuspended: newlySuspended, buriedUntil: null };
      }
      return c;
    });
    const updatedDeck = { ...activeDeck, cards: updatedCards };
    setDecks(prev => prev.map(d => d.id === activeDeck.id ? updatedDeck : d));
    updateDeckInCloud(updatedDeck);
    showToast(newlySuspended ? "Cartão suspenso." : "Cartão reativado!");
  };

  const handleExportJSON = () => {
    try {
      buildExportJSONFile({
        dailyGoal,
        desiredRetention,
        folders,
        decks,
        activityMap,
        streakRecoveries,
      });
      showToast("Backup (.json) exportado com sucesso!");
    } catch (err) {
      showToast("Erro ao exportar backup.", "error");
    }
  };

  const handleExportCSV = () => {
    try {
      buildExportCSVFile(validDecks);
      showToast("Planilha (.csv) exportada com sucesso!");
    } catch (err) {
      showToast("Erro ao exportar CSV.", "error");
    }
  };

  const handleRestoreBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!parsed || (!Array.isArray(parsed.decks) && !Array.isArray(parsed.folders))) {
          throw new Error("Formato de backup inválido.");
        }
        const restoredFolders = Array.isArray(parsed.folders) ? parsed.folders : [];
        const restoredDecks = Array.isArray(parsed.decks) ? parsed.decks : [];
        const restoredActivity = parsed.activityMap && typeof parsed.activityMap === 'object' ? parsed.activityMap : activityMap;
        const restoredRecoveries = Array.isArray(parsed.streakRecoveries) ? parsed.streakRecoveries : streakRecoveries;
        const restoredGoal = parsed.dailyGoal ? parseInt(parsed.dailyGoal) : dailyGoal;
        const restoredRetention = parsed.desiredRetention ? clamp(parseFloat(parsed.desiredRetention), 0.75, 0.97) : desiredRetention;

        setFolders(restoredFolders);
        setDecks(restoredDecks);
        setActivityMap(restoredActivity);
        setStreakRecoveries(restoredRecoveries);
        setDailyGoal(restoredGoal);
        setDesiredRetention(restoredRetention);

        if (user && db) {
          restoredFolders.forEach(f => updateFolderInCloud(f));
          restoredDecks.forEach(d => updateDeckInCloud(d));
          setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), {
            activityMap: restoredActivity,
            streakRecoveries: restoredRecoveries,
            dailyGoal: restoredGoal,
            desiredRetention: restoredRetention
          }, { merge: true }).catch(console.error);
        }
        setIsSettingsOpen(false);
        showToast(`Backup restaurado! (${restoredDecks.length} baralhos)`);
      } catch (err) {
        showToast("Arquivo de backup inválido ou corrompido.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleInteractiveSubmit = (val) => { 
    const finalVal = typeof val === 'string' ? val.trim() : val;
    setReviewInteraction(finalVal); 
    setIsFlipped(true); 
  };

  const toggleEliminateOption = (idx) => {
    setEliminatedOptions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleCardSelection = (id) => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const updateChoiceOption = (idx, value) => { const newOpts = [...choiceOptions]; newOpts[idx] = value; setChoiceOptions(newOpts); };

  const addChoiceOption = () => { if (choiceOptions.length < 6) setChoiceOptions([...choiceOptions, '']); };

  const removeChoiceOption = (idx) => {
    if (choiceOptions.length > 2) {
      const newOpts = choiceOptions.filter((_, i) => i !== idx);
      setChoiceOptions(newOpts);
      if (correctOption === idx) setCorrectOption(0);
      else if (correctOption > idx) setCorrectOption(correctOption - 1);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const finalGoal = dailyGoal || 50;
    const finalRetention = clamp(Number(desiredRetention) || 0.90, 0.75, 0.97);
    setDailyGoal(finalGoal);
    setDesiredRetention(finalRetention);
    setIsSettingsOpen(false);
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), {
        dailyGoal: finalGoal,
        desiredRetention: finalRetention
      }, { merge: true }).catch(console.error);
    }
    showToast("Configurações salvas!");
  };

  const processAnkiImport = async (file) => {
    try {
      const { newFolders, newDecks, importedCount } = await parseAnkiPackage(
        file,
        currentFolderId,
        folders,
        setImportProgress
      );
      if (newFolders.length > 0) {
        setFolders(prev => [...prev, ...newFolders]);
        newFolders.forEach(f => updateFolderInCloud(f));
      }
      if (newDecks.length > 0) {
        setDecks(prev => [...prev, ...newDecks]);
        newDecks.forEach(d => updateDeckInCloud(d));
      }
      if (importedCount > 0) showToast(`${importedCount} cartões importados!`);
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
      try {
        const newDeck = parseTextImportContent(
          String(evt.target?.result || ''),
          file.name,
          currentFolderId
        );
        if (newDeck) {
          setDecks(prev => [...prev, newDeck]);
          updateDeckInCloud(newDeck);
          showToast(`${newDeck.cards.length} cartões importados!`);
        }
      } catch (err) {
        showToast(err.message || 'Ficheiro binário não suportado.', 'error');
      } finally {
        setIsImporting(false);
      }
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

  const closeAndResetModal = () => { setIsModalOpen(false); setNewItemName(''); setNewItemDesc(''); setEditingItemId(null); };

  const handleCreateOrEditItem = (e) => {
    e.preventDefault(); if (!newItemName.trim() || !user || isProcessingRef.current) return;
    isProcessingRef.current = true;

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
    setTimeout(() => { isProcessingRef.current = false; }, 300);
  };

  const confirmDelete = () => {
    if (!itemToDelete || !user || isProcessingRef.current) return;
    isProcessingRef.current = true;

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
    setTimeout(() => { isProcessingRef.current = false; }, 300);
  };

  const handleMoveItem = () => {
    if (!itemToMove || !user || isProcessingRef.current) return;
    isProcessingRef.current = true;

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
    setTimeout(() => { isProcessingRef.current = false; }, 300);
  };

  const handleMoveCards = () => {
    const sourceDeck = activeDeck;
    const targetDeck = validDecks.find(d => d.id === moveCardsTargetDeckId);
    if (!sourceDeck || !targetDeck || selectedCardIds.size === 0) return;

    const cardsToMove = sourceDeck.cards.filter(c => selectedCardIds.has(c.id));
    const updatedSourceDeck = { ...sourceDeck, cards: sourceDeck.cards.filter(c => !selectedCardIds.has(c.id)) };
    const updatedTargetDeck = { ...targetDeck, cards: [...(targetDeck.cards || []), ...cardsToMove] };

    setDecks(prev => prev.map(d => {
      if (d.id === sourceDeck.id) return updatedSourceDeck;
      if (d.id === targetDeck.id) return updatedTargetDeck;
      return d;
    }));

    updateDeckInCloud(updatedSourceDeck);
    updateDeckInCloud(updatedTargetDeck);

    setIsMoveCardsModalOpen(false);
    setIsSelectMode(false);
    setSelectedCardIds(new Set());
    showToast(`${cardsToMove.length} cartões movidos com sucesso!`);
  };

  const handleSaveCard = (e) => {
    e.preventDefault(); if (!newCardFront.trim() || !user || isProcessingRef.current) return;
    isProcessingRef.current = true;

    const parsedTags = parseTagsString(cardTagsInput);

    let processedCard = { 
      id: editingCardId || `c-${Date.now()}`, 
      type: cardType, 
      front: newCardFront, 
      back: newCardBack, 
      tags: parsedTags,
      state: 0,
      interval: 0, 
      dueDate: Date.now(), 
      reviews: 0 
    };
    
    const targetDeckId = currentView === 'review' ? (reviewQueue[currentCardIndex]?._deckId || activeDeckId) : activeDeckId;
    const currentDeck = validDecks.find(d => d.id === targetDeckId);

    if (editingCardId && currentDeck) {
      const existing = currentDeck.cards.find(c => c.id === editingCardId);
      if (existing) {
        processedCard = { 
          ...existing, 
          type: cardType, 
          front: newCardFront, 
          back: newCardBack,
          tags: parsedTags
        };
      }
    }

    if (cardType === 'choice') { processedCard.options = [...choiceOptions]; processedCard.correctOption = correctOption; } 
    else if (cardType === 'tf') { processedCard.isTrue = tfCorrect; } 
    else if (cardType === 'typing') { processedCard.typeAnswer = typeAnswer.trim(); }

    if (currentDeck) {
      let updatedCards;
      if (editingCardId) updatedCards = currentDeck.cards.map(c => c.id === editingCardId ? processedCard : c);
      else updatedCards = [...(currentDeck.cards || []), processedCard];
      
      const updatedDeck = { ...currentDeck, cards: updatedCards };
      setDecks(prev => prev.map(d => d.id === currentDeck.id ? updatedDeck : d)); updateDeckInCloud(updatedDeck);
      
      if (editingCardId && currentView === 'review') {
        setReviewQueue(prev => prev.map(c => c.id === editingCardId ? { ...c, ...processedCard, _deckId: c._deckId } : c));
      }

      showToast(editingCardId ? "Cartão atualizado!" : "Cartão adicionado!");
    }
    setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer(''); setCardTagsInput(''); setEditingCardId(null);
    setTimeout(() => { isProcessingRef.current = false; }, 300);
  };

  const editCard = (card) => {
    setCardType(card.type || 'standard'); setNewCardFront(card.front); setNewCardBack(card.back || '');
    if (card.type === 'choice') { setChoiceOptions(card.options || ['', '', '', '']); setCorrectOption(card.correctOption || 0); }
    if (card.type === 'tf') setTfCorrect(card.isTrue !== false);
    if (card.type === 'typing') setTypeAnswer(card.typeAnswer || '');
    setCardTagsInput((card.tags || []).map(t => `#${t}`).join(' '));
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

  const activeReviewCardType = reviewQueue[currentCardIndex]?.type || 'standard';
  stateRef.current = {
    currentView,
    isFlipped,
    cardType: activeReviewCardType,
    reviewQueue,
    currentCardIndex,
    handleAnswer,
    handleInteractiveSubmit,
    handleUndo
  };

  if (isAuthLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 notranslate" translate="no"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col notranslate" translate="no" lang="pt-BR" onClick={() => setActiveMenuId(null)}>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      
      {!user ? (
        <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 flex-grow">
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-10 max-w-sm w-full flex flex-col items-center text-center shadow-2xl">
            <div className="mb-8">
            <BrandLogo size="large" />
            </div>
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-slate-100 px-6 py-3.5 rounded-xl font-bold transition-all active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar com o Google
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* CABEÇALHO SÓBRIO E INTEGRADO */}
          <Header
            currentView={currentView}
            mainTab={mainTab}
            onSelectTab={(tabId) => { setMainTab(tabId); setCurrentFolderId(null); }}
            onLogoClick={() => { setCurrentView('dashboard'); setMainTab('home'); setCurrentFolderId(null); }}
            streakCount={calculateStreak()}
            hasDoneToday={getDailyCount(getTodayStr()) > 0 || streakRecoveries.includes(getTodayStr())}
            onOpenCustomStudy={() => openCustomStudyModal('all', null)}
            isImporting={isImporting}
            importProgress={importProgress}
            onTriggerFileImport={() => fileInputRef.current?.click()}
            onOpenSettings={() => setIsSettingsOpen(true)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullScreen}
            onLogout={handleLogout}
            fileInputRef={fileInputRef}
            backupInputRef={backupInputRef}
            onUniversalImport={handleUniversalImport}
            onRestoreBackup={handleRestoreBackup}
          />

          <main className="flex-grow w-full pb-24 sm:pb-12 pt-3">
          {currentView === 'dashboard' && (
              <DashboardView
                mainTab={mainTab}
                setMainTab={setMainTab}
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
                folders={folders}
                validDecks={validDecks}
                globalStats={globalStats}
                dailyGoal={dailyGoal}
                getDailyCount={getDailyCount}
                getDailyCountFiltered={getDailyCountFiltered}
                getDecksInFolder={getDecksInFolder}
                getFolderStats={getFolderStats}
                breadcrumbs={breadcrumbs}
                activeMenuId={activeMenuId}
                setActiveMenuId={setActiveMenuId}
                openCustomStudyModal={openCustomStudyModal}
                setCustomStudyConfig={setCustomStudyConfig}
                setIsCustomStudyModalOpen={setIsCustomStudyModalOpen}
                startReview={startReview}
                openEditModal={openEditModal}
                setItemToMove={setItemToMove}
                setMoveTargetFolderId={setMoveTargetFolderId}
                setIsMoveModalOpen={setIsMoveModalOpen}
                setItemToDelete={setItemToDelete}
                setModalMode={setModalMode}
                setModalType={setModalType}
                setNewItemColor={setNewItemColor}
                setIsModalOpen={setIsModalOpen}
                onOpenDeckDetail={(deckId) => {
                  setActiveDeckId(deckId);
                  setDeckSearchQuery('');
                  setDeckStatusFilter('all');
                  setDeckTypeFilter('all');
                  setDeckTagFilter('all');
                  setCurrentView('deck-detail');
                }}
                toggleIgnoreDeck={toggleIgnoreDeck}
                calendarMonth={calendarMonth}
                setCalendarMonth={setCalendarMonth}
                streakRecoveries={streakRecoveries}
                setStreakRecoveryDate={setStreakRecoveryDate}
                forecastPeriod={forecastPeriod}
                setForecastPeriod={setForecastPeriod}
                calculateStreak={calculateStreak}
                calculateLongestStreak={calculateLongestStreak}
                activityMap={activityMap}
                reportPeriod={reportPeriod}
                setReportPeriod={setReportPeriod}
                reportDeckId={reportDeckId}
                setReportDeckId={setReportDeckId}
                desiredRetention={desiredRetention}
                calendarEvents={calendarEvents}
                onUpdateCalendarEvents={handleUpdateCalendarEvents}
              />
            )}
            {currentView === 'deck-detail' && (
              <DeckDetailView
                activeDeck={activeDeck}
                onBack={() => {
                  setCurrentView('dashboard');
                  setEditingCardId(null);
                  setNewCardFront('');
                  setNewCardBack('');
                  setChoiceOptions(['', '', '', '']);
                  setCorrectOption(0);
                  setTfCorrect(true);
                  setTypeAnswer('');
                  setCardTagsInput('');
                  setIsSelectMode(false);
                  setSelectedCardIds(new Set());
                  setDeckSearchQuery('');
                  setDeckStatusFilter('all');
                  setDeckTypeFilter('all');
                  setDeckTagFilter('all');
                }}
                startReview={startReview}
                openCustomStudyModal={openCustomStudyModal}
                editingCardId={editingCardId}
                onCancelEditCard={() => {
                  setEditingCardId(null);
                  setNewCardFront('');
                  setNewCardBack('');
                  setChoiceOptions(['', '', '', '']);
                  setCorrectOption(0);
                  setTfCorrect(true);
                  setTypeAnswer('');
                  setCardTagsInput('');
                }}
                cardType={cardType}
                setCardType={setCardType}
                newCardFront={newCardFront}
                setNewCardFront={setNewCardFront}
                newCardBack={newCardBack}
                setNewCardBack={setNewCardBack}
                choiceOptions={choiceOptions}
                updateChoiceOption={updateChoiceOption}
                addChoiceOption={addChoiceOption}
                removeChoiceOption={removeChoiceOption}
                correctOption={correctOption}
                setCorrectOption={setCorrectOption}
                tfCorrect={tfCorrect}
                setTfCorrect={setTfCorrect}
                typeAnswer={typeAnswer}
                setTypeAnswer={setTypeAnswer}
                cardTagsInput={cardTagsInput}
                setCardTagsInput={setCardTagsInput}
                handleSaveCard={handleSaveCard}
                deckSearchQuery={deckSearchQuery}
                setDeckSearchQuery={setDeckSearchQuery}
                deckStatusFilter={deckStatusFilter}
                setDeckStatusFilter={setDeckStatusFilter}
                deckTypeFilter={deckTypeFilter}
                setDeckTypeFilter={setDeckTypeFilter}
                deckTagFilter={deckTagFilter}
                setDeckTagFilter={setDeckTagFilter}
                isSelectMode={isSelectMode}
                setIsSelectMode={setIsSelectMode}
                selectedCardIds={selectedCardIds}
                setSelectedCardIds={setSelectedCardIds}
                toggleCardSelection={toggleCardSelection}
                editCard={editCard}
                toggleSuspendCard={toggleSuspendCard}
                deleteCard={deleteCard}
                onOpenMoveCardsModal={() => setIsMoveCardsModalOpen(true)}
              />
            )}
            {currentView === 'review' && (
              <ReviewView
                reviewQueue={reviewQueue}
                currentCardIndex={currentCardIndex}
                desiredRetention={desiredRetention}
                isFlipped={isFlipped}
                setIsFlipped={setIsFlipped}
                reviewInteraction={reviewInteraction}
                typedInput={typedInput}
                setTypedInput={setTypedInput}
                eliminatedOptions={eliminatedOptions}
                toggleEliminateOption={toggleEliminateOption}
                handleInteractiveSubmit={handleInteractiveSubmit}
                handleAnswer={handleAnswer}
                handleUndo={handleUndo}
                canUndo={reviewHistory.length > 0}
                onExit={() => setCurrentView('dashboard')}
                activeMenuId={activeMenuId}
                setActiveMenuId={setActiveMenuId}
                onEditCurrentCard={(card) => {
                  editCard(card);
                  setIsCardEditModalOpen(true);
                }}
                handleBuryReviewCard={handleBuryReviewCard}
                handleSuspendReviewCard={handleSuspendReviewCard}
                handleDeleteReviewCard={handleDeleteReviewCard}
                isSpeaking={isSpeaking}
                speakCardText={speakCardText}
              />
            )}
            {currentView === 'finished' && (
              <FinishedView
                reviewedCount={sessionStats.reviewed}
                onFinish={() => setCurrentView('dashboard')}
              />
            )}
          </main>
        </>
      )}

      {/* MODAL CONFIGURAÇÕES & BACKUP */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        dailyGoal={dailyGoal}
        setDailyGoal={setDailyGoal}
        desiredRetention={desiredRetention}
        setDesiredRetention={setDesiredRetention}
        onSave={handleSaveSettings}
        onExportJSON={handleExportJSON}
        onTriggerRestoreBackup={() => backupInputRef.current?.click()}
        onExportCSV={handleExportCSV}
      />

      {/* MODAL ESTUDO PERSONALIZADO / SIMULADO */}
      <CustomStudyModal
        isOpen={isCustomStudyModalOpen}
        onClose={() => setIsCustomStudyModalOpen(false)}
        config={customStudyConfig}
        setConfig={setCustomStudyConfig}
        onStart={handleStartCustomStudy}
        availableTags={getAllGlobalTags(validDecks)}
        matchedCardsCount={getFilteredCustomStudyCards(customStudyConfig).length}
      />

      {/* MODAIS DE AÇÃO E CONFIRMAÇÃO */}
      <StreakRecoveryModal
        streakRecoveryDate={streakRecoveryDate}
        onClose={() => setStreakRecoveryDate(null)}
        onConfirm={confirmRecoverStreak}
      />

      <MoveItemModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        itemToMove={itemToMove}
        moveTargetFolderId={moveTargetFolderId}
        setMoveTargetFolderId={setMoveTargetFolderId}
        folderPaths={getFolderPaths(itemToMove?.type === 'folder' ? itemToMove.id : null)}
        onConfirm={handleMoveItem}
      />

      <MoveCardsModal
        isOpen={isMoveCardsModalOpen}
        onClose={() => setIsMoveCardsModalOpen(false)}
        selectedCount={selectedCardIds.size}
        moveCardsTargetDeckId={moveCardsTargetDeckId}
        setMoveCardsTargetDeckId={setMoveCardsTargetDeckId}
        availableDecks={validDecks.filter((d) => d.id !== activeDeckId)}
        onConfirm={handleMoveCards}
      />

      <DeleteConfirmModal
        itemToDelete={itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* MODAL CRIAR/EDITAR PASTA/BARALHO */}
      <FolderDeckModal
        isOpen={isModalOpen}
        onClose={closeAndResetModal}
        modalMode={modalMode}
        modalType={modalType}
        newItemName={newItemName}
        setNewItemName={setNewItemName}
        newItemDesc={newItemDesc}
        setNewItemDesc={setNewItemDesc}
        newItemColor={newItemColor}
        setNewItemColor={setNewItemColor}
        onSubmit={handleCreateOrEditItem}
      />

      {/* MODAL EDITAR CARTÃO NA REVISÃO */}
      <CardEditModal
        isOpen={isCardEditModalOpen}
        onClose={() => setIsCardEditModalOpen(false)}
        cardType={cardType}
        setCardType={setCardType}
        newCardFront={newCardFront}
        setNewCardFront={setNewCardFront}
        newCardBack={newCardBack}
        setNewCardBack={setNewCardBack}
        choiceOptions={choiceOptions}
        updateChoiceOption={updateChoiceOption}
        addChoiceOption={addChoiceOption}
        removeChoiceOption={removeChoiceOption}
        correctOption={correctOption}
        setCorrectOption={setCorrectOption}
        tfCorrect={tfCorrect}
        setTfCorrect={setTfCorrect}
        typeAnswer={typeAnswer}
        setTypeAnswer={setTypeAnswer}
        cardTagsInput={cardTagsInput}
        setCardTagsInput={setCardTagsInput}
        onSave={handleSaveCard}
      />

      {/* TOASTS */}
      <Toast toast={toast} />
    </div>
  );
}