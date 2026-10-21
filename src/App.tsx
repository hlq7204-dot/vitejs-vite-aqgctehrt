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

  const syncDataToCloud = (newMap, newRecs) => {
    if (!user || !db) return;
    const payload = {};
    if (newMap) payload.activityMap = newMap;
    if (newRecs) payload.streakRecoveries = newRecs;
    if (Object.keys(payload).length > 0) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main'), payload, { merge: true }).catch(console.error);
    }
  };

  useEffect(() => { try { localStorage.setItem('lumina_decks', JSON.stringify(decks)); } catch(e){} }, [decks]);
  useEffect(() => { try { localStorage.setItem('lumina_folders', JSON.stringify(folders)); } catch(e){} }, [folders]);
  useEffect(() => { try { localStorage.setItem('lumina_activity', JSON.stringify(activityMap)); } catch(e){} }, [activityMap]);
  useEffect(() => { try { localStorage.setItem('lumina_streakRecoveries', JSON.stringify(streakRecoveries)); } catch(e){} }, [streakRecoveries]);
  useEffect(() => { try { localStorage.setItem('lumina_dailyGoal', dailyGoal); } catch(e){} }, [dailyGoal]);
  useEffect(() => { try { localStorage.setItem('lumina_desiredRetention', desiredRetention); } catch(e){} }, [desiredRetention]);

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
      setDecks([]); setFolders([]); setActivityMap({}); setStreakRecoveries([]);
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

        if (data.dailyGoal) setDailyGoal(data.dailyGoal);
        if (data.desiredRetention) setDesiredRetention(clamp(parseFloat(data.desiredRetention), 0.75, 0.97));
      } else {
        const localActivity = localStorage.getItem('lumina_activity');
        const activityToSync = localActivity ? JSON.parse(localActivity) : {};
        const localRecs = localStorage.getItem('lumina_streakRecoveries');
        const recsToSync = localRecs ? JSON.parse(localRecs) : [];
        setDoc(profileRef, { activityMap: activityToSync, streakRecoveries: recsToSync, dailyGoal: 50, desiredRetention: 0.90 }).catch(console.error);
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

  const renderDeckDetail = () => {
    if (!activeDeck) return null;
    const stats = getCardStats(activeDeck.cards); const due = calculateTotalDue(stats);

    const getCardStatusCategory = (card) => {
      if (card.isSuspended) return 'suspended';
      const cardState = card.state !== undefined ? card.state : (card.reviews > 0 ? 2 : 0);
      if (cardState === 0 || card.reviews === 0) return 'new';
      if (cardState === 1 || cardState === 3 || card.interval < 1) return 'learning';
      if (checkCardDue(card)) return 'review';
      return 'learned';
    };

    const allDeckCards = (activeDeck.cards || []).slice().reverse();
    const leechCount = allDeckCards.filter(c => isCardLeech(c)).length;
    const unlearnedCount = allDeckCards.filter(c => isCardUnlearned(c)).length;
    const deckTags = Array.from(new Set(allDeckCards.flatMap(c => c.tags || []))).sort();

    const filteredDeckCards = allDeckCards.filter(card => {
      if (deckTypeFilter !== 'all' && (card.type || 'standard') !== deckTypeFilter) return false;
      if (deckTagFilter !== 'all' && !(card.tags || []).includes(deckTagFilter)) return false;
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
        const frontText = (card.front || '').replace(/<[^>]*>/g, ' ').toLowerCase();
        const backText = (card.back || '').replace(/<[^>]*>/g, ' ').toLowerCase();
        const typeAns = (card.typeAnswer || '').toLowerCase();
        const optsText = (card.options || []).join(' ').toLowerCase();
        const tagsText = (card.tags || []).join(' ').toLowerCase();
        if (!frontText.includes(q) && !backText.includes(q) && !typeAns.includes(q) && !optsText.includes(q) && !tagsText.includes(q)) {
          return false;
        }
      }
      return true;
    });

    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-2 pb-20 animate-in slide-in-from-right-4 fade-in duration-300">
        <button onClick={() => {
          setCurrentView('dashboard');
          setEditingCardId(null);
          setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer(''); setCardTagsInput('');
          setIsSelectMode(false); setSelectedCardIds(new Set());
          setDeckSearchQuery(''); setDeckStatusFilter('all'); setDeckTypeFilter('all'); setDeckTagFilter('all');
        }} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</button>

        <div className="bg-slate-900/80 backdrop-blur-sm rounded-3xl p-6 sm:p-8 border border-slate-800 mb-8 flex flex-col gap-6 relative group">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 ${activeDeck.color || DECK_THEMES[0].color}`}><BookOpen className="w-7 h-7 sm:w-8 sm:h-8" /></div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-3">
                  {activeDeck.name}
                  {activeDeck.isIgnored && <span className="bg-slate-800 text-slate-400 text-xs font-bold px-2 py-1 rounded border border-slate-700 flex items-center gap-1 uppercase tracking-wider"><EyeOff className="w-3 h-3"/> Ignorado</span>}
                </h1>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap">
              <button onClick={() => startReview(activeDeck.id)} disabled={due === 0 || activeDeck.isIgnored} className={`px-6 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${due > 0 && !activeDeck.isIgnored ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>
                <Play className="w-4 h-4" fill="currentColor" /> Revisar <span className="bg-black/20 text-indigo-100 px-2 py-0.5 rounded-full text-xs ml-1">{activeDeck.isIgnored ? '0' : due}</span>
              </button>
              <button onClick={() => startReview(activeDeck.id, true)} disabled={!activeDeck.cards || activeDeck.cards.length === 0} className={`px-5 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${activeDeck.cards?.length > 0 ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'}`} title="Adiantar">
                <FastForward className="w-4 h-4" fill="currentColor" /> Estudo Livre
              </button>
              <button onClick={() => openCustomStudyModal('deck', activeDeck.id)} disabled={!activeDeck.cards || activeDeck.cards.length === 0} className={`px-5 py-3 rounded-xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${activeDeck.cards?.length > 0 ? 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800' : 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-slate-800'}`} title="Estudo Personalizado / Simulado">
                <SlidersHorizontal className="w-4 h-4" /> Personalizar
              </button>
            </div>
          </div>
          {}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 pt-6 border-t border-slate-800/50">
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
                        {choiceOptions.length > 2 && (
                          <button type="button" onClick={() => removeChoiceOption(idx)} className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                    {choiceOptions.length < 6 && (
                      <button type="button" onClick={addChoiceOption} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 mt-2 p-1"><Plus className="w-4 h-4"/> Adicionar opção</button>
                    )}
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
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-sm font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> Etiquetas (#tags)
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
                      {deckTags.slice(0, 8).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            const current = parseTagsString(cardTagsInput);
                            if (current.includes(t)) {
                              setCardTagsInput(current.filter(x => x !== t).map(x => `#${x}`).join(' '));
                            } else {
                              setCardTagsInput([...current, t].map(x => `#${x}`).join(' '));
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
                  {editingCardId && <button type="button" onClick={() => {
                    setEditingCardId(null);
                    setNewCardFront(''); setNewCardBack(''); setChoiceOptions(['', '', '', '']); setCorrectOption(0); setTfCorrect(true); setTypeAnswer(''); setCardTagsInput('');
                  }} className="w-1/3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-xl transition-colors">Cancelar</button>}
                  <button type="submit" className={`bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors border border-indigo-500/50 ${editingCardId ? 'w-2/3' : 'w-full'}`}>{editingCardId ? 'Guardar' : 'Adicionar'}</button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                Cartões
                <span className="bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full text-xs">
                  {filteredDeckCards.length !== allDeckCards.length ? `${filteredDeckCards.length} de ${allDeckCards.length}` : allDeckCards.length}
                </span>
                {leechCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeckStatusFilter(deckStatusFilter === 'leech' ? 'all' : 'leech')}
                    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border transition-all ${deckStatusFilter === 'leech' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
                    title="Filtrar cartões difíceis (Sanguessugas)"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> {leechCount} {leechCount === 1 ? 'sanguessuga' : 'sanguessugas'}
                  </button>
                )}
              </h3>
              {activeDeck.cards?.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {isSelectMode && (
                    <button onClick={() => {
                      const targetIds = filteredDeckCards.map(c => c.id);
                      const allFilteredSelected = targetIds.length > 0 && targetIds.every(id => selectedCardIds.has(id));
                      if (allFilteredSelected) {
                        setSelectedCardIds(new Set());
                      } else {
                        setSelectedCardIds(new Set(targetIds));
                      }
                    }} className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors flex-1 sm:flex-none">
                      {filteredDeckCards.length > 0 && filteredDeckCards.every(c => selectedCardIds.has(c.id)) ? 'Desmarcar Visíveis' : 'Selecionar Visíveis'}
                    </button>
                  )}
                  <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedCardIds(new Set()); }} className={`text-sm px-3 py-1.5 rounded-lg border transition-colors flex-1 sm:flex-none ${isSelectMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
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
                      {deckTags.map(t => (
                        <option key={t} value={t}>#{t}</option>
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
                  ].map(tab => (
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
              const cardState = card.state !== undefined ? card.state : (card.reviews > 0 ? 2 : 0);
              let statusLabel = ''; let statusColor = '';
              if (card.isSuspended) { statusLabel = 'Suspenso'; statusColor = 'text-slate-400 bg-slate-800/90 border-slate-600'; }
              else if (isCardBuried(card)) { statusLabel = 'Enterrado até amanhã'; statusColor = 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30'; }
              else if (cardState === 0 || card.reviews === 0) { statusLabel = 'Novo'; statusColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20'; }
              else if (cardState === 1 || cardState === 3 || card.interval < 1) { statusLabel = 'Aprender'; statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20'; }
              else if (checkCardDue(card)) { statusLabel = 'Revisar'; statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; }
              else { statusLabel = 'Aprendido'; statusColor = 'text-slate-400 bg-slate-800 border-slate-700'; }

              const leech = isCardLeech(card);
              const typeObj = CARD_TYPES.find(t => t.id === (card.type || 'standard')) || CARD_TYPES[0];
              const TypeIconComp = typeObj.Icon;

              return (
                <div key={card.id} 
                  className={`bg-slate-900/80 p-5 rounded-2xl border flex items-start gap-3 sm:gap-4 group transition-all duration-300 anki-content ${card.isSuspended ? 'opacity-60' : ''} ${isSelectMode && selectedCardIds.has(card.id) ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : (leech ? 'border-amber-500/40 hover:border-amber-500/60' : (editingCardId === card.id ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-800 hover:border-slate-700 hover:-translate-y-1'))} ${isSelectMode ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (isSelectMode) toggleCardSelection(card.id); }}
                >
                  {isSelectMode && (
                    <div className="flex items-center h-full mr-4 pt-1 shrink-0">
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${selectedCardIds.has(card.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-slate-950 border-slate-600 text-transparent'}`}>
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
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>{statusLabel}</span>
                        {leech && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            title={`Cartão difícil (Dificuldade FSRS: ${card.difficulty ? card.difficulty.toFixed(1) : '--'} • Lapsos em revisão: ${getEffectiveLapses(card)}). Considere simplificar ou dividir este cartão.`}
                          >
                            <AlertTriangle className="w-3 h-3" /> Sanguessuga {card.difficulty ? `(D: ${card.difficulty.toFixed(1)})` : ''}
                          </span>
                        )}
                        {(card.tags || []).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDeckTagFilter(deckTagFilter === t ? 'all' : t); }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                          >
                            #{t}
                          </button>
                        ))}
                      </div>
                      <div className="text-slate-200 font-medium text-sm sm:text-base break-words" dangerouslySetInnerHTML={{ __html: card.front }} />
                    </div>
                    <div className="pt-4 md:pt-8 border-t border-slate-800 md:border-0 max-h-64 overflow-y-auto custom-scrollbar">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                        {card.type === 'standard' ? 'Verso' : card.type === 'typing' ? `Gabarito: ${card.typeAnswer}` : card.type === 'tf' ? `Gabarito: ${card.isTrue ? 'V' : 'F'}` : 'Detalhes'}
                      </span>
                      <div className="text-slate-400 text-sm sm:text-base break-words" dangerouslySetInnerHTML={{ __html: card.back }} />
                    </div>
                  </div>
                  {!isSelectMode && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); editCard(card); }} className="text-slate-600 hover:text-indigo-400 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-indigo-500/10" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); toggleSuspendCard(card.id); }} className={`p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg ${card.isSuspended ? 'text-amber-400 hover:bg-amber-500/10 opacity-100' : 'text-slate-600 hover:text-amber-400 hover:bg-amber-500/10'}`} title={card.isSuspended ? "Reativar Cartão" : "Suspender Cartão"}>
                        {card.isSuspended ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }} className="text-slate-600 hover:text-red-400 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
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
                  onClick={() => { setDeckSearchQuery(''); setDeckStatusFilter('all'); setDeckTypeFilter('all'); setDeckTagFilter('all'); }}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                >
                  Limpar filtros
                </button>
              </div>
            )}
            {(!activeDeck.cards || activeDeck.cards.length === 0) && <div className="text-center py-10 text-slate-600 border border-dashed border-slate-800 rounded-2xl">Este baralho está vazio.</div>}
            
            {selectedCardIds.size > 0 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-slate-700 flex items-center gap-4 z-50 animate-pop">
                <span className="text-slate-200 font-bold whitespace-nowrap"><span className="text-indigo-400">{selectedCardIds.size}</span> selecionados</span>
                <div className="w-px h-6 bg-slate-700"></div>
                <button onClick={() => setIsMoveCardsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"><CornerUpRight className="w-4 h-4" /> Mover</button>
                <button onClick={() => setSelectedCardIds(new Set())} className="text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl font-medium transition-colors hidden sm:block">Desmarcar</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    if (!reviewQueue.length) return null;
    const currentCard = reviewQueue[currentCardIndex];
    const progress = (currentCardIndex / reviewQueue.length) * 100;
    const intervalLabels = [0,1,2,3].map(q => formatInterval(calculateNextReview(currentCard, q, desiredRetention).interval));
    const type = currentCard.type || 'standard';
    const leech = isCardLeech(currentCard);

    const normalizedUserTyped = (reviewInteraction || '').trim().toLowerCase();
    const normalizedExpectedTyped = (currentCard.typeAnswer || '').trim().toLowerCase();
    const isTypedCorrect = normalizedUserTyped === normalizedExpectedTyped;

    let interactiveSuggestedGrade = null;
    if (isFlipped && type !== 'standard' && reviewInteraction !== null) {
      if (type === 'choice') interactiveSuggestedGrade = reviewInteraction === currentCard.correctOption ? 2 : 0;
      else if (type === 'tf') interactiveSuggestedGrade = reviewInteraction === (currentCard.isTrue !== false) ? 2 : 0;
      else if (type === 'typing') interactiveSuggestedGrade = isTypedCorrect ? 2 : 0;
    }

    const renderReviewDropdownMenu = (menuKey) => (
      activeMenuId === menuKey && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
          <button onClick={() => { editCard(currentCard); setIsCardEditModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar Cartão</button>
          <button onClick={() => { handleBuryReviewCard(); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-indigo-300 hover:bg-slate-700 flex items-center gap-2"><SkipForward className="w-4 h-4" /> Enterrar até amanhã</button>
          <button onClick={() => { handleSuspendReviewCard(); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-amber-300 hover:bg-slate-700 flex items-center gap-2"><PauseCircle className="w-4 h-4" /> Suspender Cartão</button>
          <div className="h-px bg-slate-700 w-full"></div>
          <button onClick={() => { handleDeleteReviewCard(); setActiveMenuId(null); }} className="w-full text-left px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir Cartão</button>
        </div>
      )
    );

    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 min-h-screen flex flex-col pb-24" onClick={() => setActiveMenuId(null)}>
        <div className="flex items-center justify-between mb-8 pt-4 gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentView('dashboard')} className="text-slate-500 p-2 rounded-lg hover:bg-slate-800 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
            <button onClick={handleUndo} disabled={reviewHistory.length === 0} className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${reviewHistory.length > 0 ? 'text-indigo-400 hover:bg-indigo-900/30 cursor-pointer' : 'text-slate-700 cursor-not-allowed'}`} title="Desfazer último cartão (Ctrl+Z)">
              <RotateCcw className="w-5 h-5" /> <span className="hidden sm:inline text-sm font-bold">Desfazer</span>
            </button>
          </div>
          <div className="flex-grow"><div className="h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
          <span className="text-xs font-bold text-slate-500 shrink-0">{currentCardIndex + 1} / {reviewQueue.length}</span>
        </div>

        <div className="flex-grow flex flex-col justify-center items-center w-full max-w-5xl mx-auto" style={{ perspective: '1000px' }}>
          {type === 'standard' && (
            <div key={currentCard.id} className="w-full animate-slide-right">
              <div 
                className="relative w-full h-[65vh] min-h-[400px] max-h-[800px] cursor-pointer transition-transform duration-500" 
                style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} 
                onClick={() => setIsFlipped(prev => !prev)} 
              >
                {/* FRENTE */}
                <div 
                  className="absolute inset-0 w-full h-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <div className="p-6 text-left border-b border-slate-800/50 flex justify-between items-center group">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-600 uppercase">Pergunta</span>
                      {leech && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" /> Sanguessuga
                        </span>
                      )}
                      {(currentCard.tags || []).map(t => (
                        <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">#{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => speakCardText(currentCard.front, e)}
                        className={`p-1.5 rounded-lg border transition-colors ${isSpeaking ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800/60 text-slate-400 hover:text-indigo-300 border-slate-700/50'}`}
                        title="Ouvir pronúncia / Ler em voz alta"
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setActiveMenuId(activeMenuId === 'review_menu' ? null : 'review_menu')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-800/60 hover:bg-slate-700 hover:text-indigo-300 rounded-lg transition-colors border border-slate-700/50" title="Opções do Cartão">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {renderReviewDropdownMenu('review_menu')}
                      </div>
                      <span className="text-xs text-slate-600 bg-slate-950 px-2 py-1 rounded hidden sm:block">Clique (ou Espaço) para virar</span>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                    <div className="min-h-full flex flex-col justify-center p-6 sm:p-8">
                      <div className="w-full text-2xl sm:text-3xl text-slate-100 text-center anki-content break-words" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
                    </div>
                  </div>
                </div>

                {/* VERSO */}
                <div 
                  className="absolute inset-0 w-full h-full bg-indigo-950/40 rounded-3xl border border-indigo-500/20 flex flex-col shadow-2xl"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <div className="p-6 text-left border-b border-indigo-500/20 flex justify-between items-center group">
                    <span className="text-sm font-bold text-indigo-400/50 uppercase">Resposta</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => speakCardText(currentCard.back, e)}
                        className={`p-1.5 rounded-lg border transition-colors ${isSpeaking ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50' : 'bg-indigo-900/40 text-indigo-300/70 hover:text-indigo-200 border-indigo-500/30'}`}
                        title="Ouvir resposta em voz alta"
                      >
                        {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setActiveMenuId(activeMenuId === 'review_menu_verso' ? null : 'review_menu_verso')} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-400/70 bg-indigo-900/40 hover:bg-indigo-800 hover:text-indigo-200 rounded-lg transition-colors border border-indigo-500/30" title="Opções do Cartão">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                        {renderReviewDropdownMenu('review_menu_verso')}
                      </div>
                      <button className="p-2 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-400 rounded-full transition-colors border border-indigo-500/30" onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} title="Virar Novamente"><RefreshCcw className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                    <div className="min-h-full flex flex-col justify-center p-6 sm:p-8">
                      <div className="w-full text-2xl sm:text-3xl text-indigo-100 text-center anki-content break-words" dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {type !== 'standard' && (
            <div key={currentCard.id} className="w-full bg-slate-900 rounded-3xl border border-slate-800 flex flex-col shadow-2xl min-h-[400px] max-h-[80vh] animate-slide-right relative group overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-slate-800/40" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {type === 'choice' ? 'Múltipla Escolha' : type === 'tf' ? 'Verdadeiro ou Falso' : 'Digitação'}
                  </span>
                  {leech && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <AlertTriangle className="w-3 h-3" /> Sanguessuga
                    </span>
                  )}
                  {(currentCard.tags || []).map(t => (
                    <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">#{t}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => speakCardText(`${currentCard.front} ${(currentCard.options || []).join('. ')}`, e)}
                    className={`p-2 rounded-lg border transition-colors ${isSpeaking ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-950 text-slate-400 hover:text-indigo-300 border-slate-700'}`}
                    title="Ouvir pergunta em voz alta"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <div className="relative">
                    <button onClick={() => setActiveMenuId(activeMenuId === 'review_menu' ? null : 'review_menu')} className="p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 bg-slate-950 border border-slate-700 rounded-lg transition-colors shadow-md" title="Opções do Cartão">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {renderReviewDropdownMenu('review_menu')}
                  </div>
                </div>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-grow flex flex-col">
                <div className="p-6 sm:p-8 border-b border-slate-800/50 shrink-0">
                  <div className="text-xl sm:text-3xl font-medium text-slate-100 text-center anki-content break-words" dangerouslySetInnerHTML={{ __html: currentCard.front }} />
                </div>
                <div className="flex-grow p-6 sm:px-10 bg-slate-950/50 flex flex-col justify-center gap-4">
                  {type === 'choice' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                      {currentCard.options?.map((opt, idx) => {
                        const isEliminated = eliminatedOptions.has(idx);
                        let btnClass = "bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500";
                        
                        if (isFlipped) {
                          if (idx === currentCard.correctOption) btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-300";
                          else if (reviewInteraction === idx) btnClass = "bg-rose-500/20 border-rose-500 text-rose-300";
                          else btnClass = "opacity-30";
                        } else if (isEliminated) {
                          btnClass = "bg-slate-950 border-slate-800 text-slate-600 line-through opacity-40 grayscale";
                        }

                        const isOdd = currentCard.options.length % 2 !== 0;
                        const isLast = idx === currentCard.options.length - 1;
                        const spanClass = isOdd && isLast ? "md:col-span-2" : "";

                        return (
                          <div key={idx} className={`relative flex ${spanClass}`}>
                            <button 
                              disabled={isFlipped || isEliminated} 
                              onClick={() => handleInteractiveSubmit(idx)} 
                              className={`w-full p-4 pr-12 rounded-xl border-2 text-left font-medium transition-all flex justify-between items-center text-lg ${btnClass}`}
                            >
                              <span>{opt}</span> 
                              <span className="text-xs opacity-30 font-mono hidden sm:block">{idx+1}</span>
                            </button>
                            {!isFlipped && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleEliminateOption(idx); }}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${isEliminated ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'}`}
                                title={isEliminated ? "Restaurar alternativa" : "Riscar alternativa (Eliminar)"}
                              >
                                {isEliminated ? <RotateCcw className="w-4 h-4"/> : <X className="w-4 h-4"/>}
                              </button>
                            )}
                          </div>
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
                      <div className="w-full max-w-lg flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          disabled={isFlipped}
                          value={isFlipped ? reviewInteraction : typedInput}
                          onChange={e => setTypedInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && typedInput.trim() && handleInteractiveSubmit(typedInput)}
                          className={`flex-grow bg-transparent border-b-2 text-center text-2xl sm:text-3xl font-mono p-4 outline-none transition-colors ${!isFlipped ? 'border-indigo-500 text-indigo-300' : (isTypedCorrect ? 'border-emerald-500 text-emerald-400' : 'border-rose-500 text-rose-400 line-through')}`}
                          placeholder="Digite sua resposta..."
                        />
                        {!isFlipped && (
                          <button
                            type="button"
                            onClick={() => typedInput.trim() && handleInteractiveSubmit(typedInput)}
                            disabled={!typedInput.trim()}
                            className={`p-4 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 ${typedInput.trim() ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                            title="Confirmar resposta"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      {isFlipped && !isTypedCorrect && (
                        <div className="text-emerald-400 font-mono text-2xl animate-pop text-center">
                          <span className="text-slate-500 text-sm block">Correta:</span>
                          {currentCard.typeAnswer}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {isFlipped && currentCard.back && (
                <div className="p-6 bg-indigo-950/30 border-t border-indigo-500/20 text-indigo-100 shrink-0 animate-in fade-in duration-300">
                  <div className="anki-content break-words" dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-32 mt-8 flex flex-col justify-center max-w-4xl mx-auto w-full">
          {!isFlipped && type === 'standard' ? (
            <button onClick={() => setIsFlipped(true)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xl py-6 rounded-2xl shadow-lg transition-all active:scale-95">Mostrar Resposta</button>
          ) : isFlipped ? (
            <div className="grid grid-cols-4 gap-2 sm:gap-4 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <button onClick={() => handleAnswer(0)} className={`p-4 sm:py-6 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border rounded-2xl font-bold relative transition-all active:scale-95 text-lg sm:text-xl ${interactiveSuggestedGrade === 0 ? 'border-rose-400 ring-2 ring-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.25)]' : 'border-rose-500/20'}`}>
                Errei <span className="text-sm opacity-50 block">{intervalLabels[0]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">1</span>
              </button>
              <button onClick={() => handleAnswer(1)} className="p-4 sm:py-6 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-2xl font-bold relative transition-colors active:scale-95 text-lg sm:text-xl">
                Difícil <span className="text-sm opacity-50 block">{intervalLabels[1]}</span><span className="absolute top-2 right-2 text-[10px] opacity-30 font-mono hidden sm:block">2</span>
              </button>
              <button onClick={() => handleAnswer(2)} className={`p-4 sm:py-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border rounded-2xl font-bold relative transition-all active:scale-95 text-lg sm:text-xl ${interactiveSuggestedGrade === 2 ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]' : 'border-emerald-500/20'}`}>
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
              />
            )}
            {currentView === 'deck-detail' && renderDeckDetail()}
            {currentView === 'review' && renderReview()}
            {currentView === 'finished' && renderFinished()}
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