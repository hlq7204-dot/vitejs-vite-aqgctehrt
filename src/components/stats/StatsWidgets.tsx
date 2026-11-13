// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  PieChart,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Flame,
  Trophy,
  Award,
  Plus,
  CheckSquare,
  Square,
  Bell,
  Clock,
  Trash2,
  Pencil,
  Check,
  X,
  History,
  Play,
  GraduationCap,
  BookOpen,
  Folder as FolderIcon,
  Layers,
  Repeat,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  Deck,
  Folder,
  CalendarEventItem,
  CalendarEventType,
  CalendarRecurrence,
} from '../../types';
import { checkCardDue, isCardBuried } from '../../utils/fsrs';
import { getCardStats, getTodayStr } from '../../utils/helpers';

export type { CalendarEventItem } from '../../types';

interface DisplayCalendarItem extends CalendarEventItem {
  originDate: string;
  isProjected: boolean;
  isCompletedOnDate: boolean;
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const RECURRENCE_LABELS: Record<CalendarRecurrence, string> = {
  none: 'Não se repete',
  daily: 'Diário',
  weekdays: 'Seg–Sex',
  weekly: 'Semanal',
  custom_days: 'Dias específicos',
};

const formatRecurrenceBadge = (item: CalendarEventItem): string => {
  if (!item.recurrence || item.recurrence === 'none') return '';
  if (item.recurrence === 'custom_days') {
    const days = [...(item.recurrenceDays || [])].sort((a, b) => a - b);
    if (days.length === 0) return 'Dias específicos';
    if (days.length === 7) return 'Todos os dias';
    return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
  }
  return RECURRENCE_LABELS[item.recurrence];
};

const matchesRecurrenceOnDate = (
  originDateStr: string,
  targetDateStr: string,
  recurrence?: CalendarRecurrence,
  recurrenceDays?: number[]
): boolean => {
  if (!recurrence || recurrence === 'none') return false;
  if (targetDateStr <= originDateStr) return false;

  const targetDate = new Date(targetDateStr + 'T12:00:00');
  const targetDow = targetDate.getDay();

  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return targetDow >= 1 && targetDow <= 5;
  if (recurrence === 'weekly') {
    const originDate = new Date(originDateStr + 'T12:00:00');
    return targetDow === originDate.getDay();
  }
  if (recurrence === 'custom_days') {
    return Array.isArray(recurrenceDays) && recurrenceDays.includes(targetDow);
  }
  return false;
};

interface StatsViewProps {
  validDecks: Deck[];
  folders?: Folder[];
  getDecksInFolder?: (folderId: string | null) => Deck[];
  startReview?: (
    deckId: string | null,
    forceAll?: boolean,
    folderId?: string | null
  ) => void;
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  getDailyCount: (dateStr: string) => number;
  streakRecoveries: string[];
  setStreakRecoveryDate: (dateStr: string | null) => void;
  forecastPeriod: string;
  setForecastPeriod: (period: string) => void;
  calculateStreak: () => number;
  calculateLongestStreak: () => number;
  calendarEvents?: Record<string, CalendarEventItem[]>;
  onUpdateCalendarEvents?: (newEvents: Record<string, CalendarEventItem[]>) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  validDecks,
  folders = [],
  getDecksInFolder,
  startReview,
  calendarMonth,
  setCalendarMonth,
  getDailyCount,
  streakRecoveries,
  setStreakRecoveryDate,
  forecastPeriod,
  setForecastPeriod,
  calculateStreak,
  calculateLongestStreak,
  calendarEvents = {},
  onUpdateCalendarEvents,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState<CalendarEventType>('task');
  const [newItemTime, setNewItemTime] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemRecurrence, setNewItemRecurrence] =
    useState<CalendarRecurrence>('none');
  const [newItemRecurrenceDays, setNewItemRecurrenceDays] = useState<number[]>(
    () => [new Date(getTodayStr() + 'T12:00:00').getDay()]
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingOriginDate, setEditingOriginDate] = useState<string | null>(
    null
  );
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const [showOverdueDetails, setShowOverdueDetails] = useState(false);

  const eventsMap =
    calendarEvents &&
    typeof calendarEvents === 'object' &&
    !Array.isArray(calendarEvents)
      ? calendarEvents
      : {};

  const activeDecksList = useMemo(
    () => validDecks.filter((d) => !d.isIgnored),
    [validDecks]
  );

  // Lista todos os itens recorrentes cadastrados para projeção nas datas seguintes
  const recurringOrigins = useMemo(() => {
    const list: { originDate: string; item: CalendarEventItem }[] = [];
    Object.entries(eventsMap).forEach(([dateStr, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (item && item.recurrence && item.recurrence !== 'none') {
          list.push({ originDate: dateStr, item });
        }
      });
    });
    return list;
  }, [eventsMap]);

  // Resolve os itens diretos + recorrentes de qualquer data (respeitando datas excluídas)
  const getItemsForDate = (targetDateStr: string): DisplayCalendarItem[] => {
    const rawDirect = Array.isArray(eventsMap[targetDateStr])
      ? eventsMap[targetDateStr]
      : [];

    const directItems: DisplayCalendarItem[] = rawDirect
      .filter((item) => !(item.excludedDates || []).includes(targetDateStr))
      .map((item) => {
        const isRec = item.recurrence && item.recurrence !== 'none';
        const isCompletedOnDate = isRec
          ? (item.completedDates || []).includes(targetDateStr) || !!item.completed
          : !!item.completed;
        return {
          ...item,
          originDate: targetDateStr,
          isProjected: false,
          isCompletedOnDate,
        };
      });

    const projectedItems: DisplayCalendarItem[] = [];
    recurringOrigins.forEach(({ originDate, item }) => {
      if ((item.excludedDates || []).includes(targetDateStr)) return;
      if (
        matchesRecurrenceOnDate(
          originDate,
          targetDateStr,
          item.recurrence,
          item.recurrenceDays
        )
      ) {
        projectedItems.push({
          ...item,
          originDate,
          isProjected: true,
          isCompletedOnDate: (item.completedDates || []).includes(targetDateStr),
        });
      }
    });

    return [...directItems, ...projectedItems].sort((a, b) =>
      (a.time || '99:99').localeCompare(b.time || '99:99')
    );
  };

  // Tarefas únicas de dias anteriores que ainda não foram concluídas
  const overdueTasks = useMemo(() => {
    const todayStr = getTodayStr();
    const list: { originDate: string; item: CalendarEventItem }[] = [];
    const pastDates = Object.keys(eventsMap)
      .filter((d) => d < todayStr)
      .sort();

    pastDates.forEach((dateStr) => {
      const items = Array.isArray(eventsMap[dateStr]) ? eventsMap[dateStr] : [];
      items.forEach((item) => {
        const isOneOff = !item.recurrence || item.recurrence === 'none';
        if (item.type === 'task' && !item.completed && isOneOff) {
          list.push({ originDate: dateStr, item });
        }
      });
    });

    return list;
  }, [eventsMap]);

  // Mapa de revisões previstas pelo FSRS por data (YYYY-MM-DD)
  const forecastByDateStr = useMemo(() => {
    const map: Record<string, number> = {};
    const todayStr = getTodayStr();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    activeDecksList.forEach((deck) => {
      (deck.cards || []).forEach((c) => {
        if (c.isSuspended || isCardBuried(c)) return;
        const isDueNow = checkCardDue(c);
        const isDueToday =
          !c.dueDate || isDueNow || c.dueDate <= endOfToday.getTime();

        if (isDueToday) {
          map[todayStr] = (map[todayStr] || 0) + 1;
        } else if (c.dueDate) {
          const d = new Date(c.dueDate);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          const dStr = `${y}-${m}-${dy}`;
          map[dStr] = (map[dStr] || 0) + 1;
        }
      });
    });

    return map;
  }, [activeDecksList]);

  // Próxima prova futura cadastrada na agenda
  const nextUpcomingExam = useMemo(() => {
    const todayStr = getTodayStr();
    const futureDates = Object.keys(eventsMap)
      .filter((d) => d >= todayStr)
      .sort();

    for (const dateStr of futureDates) {
      const items = Array.isArray(eventsMap[dateStr]) ? eventsMap[dateStr] : [];
      const exam = items.find((i) => i.type === 'exam');
      if (exam) {
        return { dateStr, exam };
      }
    }
    return null;
  }, [eventsMap]);

  const updateEvents = (nextMap: Record<string, CalendarEventItem[]>) => {
    const cleanMap = JSON.parse(JSON.stringify(nextMap));
    if (onUpdateCalendarEvents) {
      onUpdateCalendarEvents(cleanMap);
    }
  };

  const resetFormInputs = (targetDateStr = selectedDate) => {
    setNewItemTitle('');
    setNewItemTime('');
    setNewItemLink('');
    setNewItemRecurrence('none');
    const dow = new Date(targetDateStr + 'T12:00:00').getDay();
    setNewItemRecurrenceDays([dow]);
    setEditingItemId(null);
    setEditingOriginDate(null);
    setPendingDeleteKey(null);
  };

  const toggleWeekdaySelection = (dayIndex: number) => {
    setNewItemRecurrenceDays((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIndex);
      }
      return [...prev, dayIndex].sort((a, b) => a - b);
    });
  };

  // Encontra a primeira data (a partir de baseDateStr) que coincide com os dias da semana selecionados
  const findFirstMatchingDateStr = (
    baseDateStr: string,
    daysOfWeek: number[]
  ): string => {
    if (!daysOfWeek || daysOfWeek.length === 0) return baseDateStr;
    const base = new Date(baseDateStr + 'T12:00:00');
    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(base);
      candidate.setDate(base.getDate() + offset);
      if (daysOfWeek.includes(candidate.getDay())) {
        const y = candidate.getFullYear();
        const m = String(candidate.getMonth() + 1).padStart(2, '0');
        const dy = String(candidate.getDate()).padStart(2, '0');
        return `${y}-${m}-${dy}`;
      }
    }
    return baseDateStr;
  };

  const handleSaveCalendarItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const trimmedTime = newItemTime.trim();
    const effectiveRecurrence: CalendarRecurrence =
      newItemType === 'exam' ? 'none' : newItemRecurrence;

    const effectiveDays =
      effectiveRecurrence === 'custom_days'
        ? newItemRecurrenceDays.length > 0
          ? [...newItemRecurrenceDays].sort((a, b) => a - b)
          : [new Date(selectedDate + 'T12:00:00').getDay()]
        : undefined;

    const linkedDeckId = newItemLink.startsWith('deck:')
      ? newItemLink.slice(5)
      : undefined;
    const linkedFolderId = newItemLink.startsWith('folder:')
      ? newItemLink.slice(7)
      : undefined;

    if (editingItemId) {
      const targetOriginDate = editingOriginDate || selectedDate;
      const originItems = Array.isArray(eventsMap[targetOriginDate])
        ? [...eventsMap[targetOriginDate]]
        : [];

      const updated = originItems.map((item) => {
        if (item.id !== editingItemId) return item;
        const updatedItem: CalendarEventItem = {
          id: item.id,
          title: newItemTitle.trim(),
          type: newItemType,
          completed: newItemType === 'task' ? !!item.completed : false,
          recurrence: effectiveRecurrence,
        };
        if (effectiveDays) updatedItem.recurrenceDays = effectiveDays;
        if (item.completedDates && effectiveRecurrence !== 'none') {
          updatedItem.completedDates = item.completedDates;
        }
        if (item.excludedDates && effectiveRecurrence !== 'none') {
          updatedItem.excludedDates = item.excludedDates;
        }
        if (trimmedTime) updatedItem.time = trimmedTime;
        if (linkedDeckId) updatedItem.deckId = linkedDeckId;
        if (linkedFolderId) updatedItem.folderId = linkedFolderId;
        return updatedItem;
      });
      updateEvents({ ...eventsMap, [targetOriginDate]: updated });
      resetFormInputs(selectedDate);
    } else {
      const startDateStr =
        effectiveRecurrence === 'custom_days' && effectiveDays
          ? findFirstMatchingDateStr(selectedDate, effectiveDays)
          : selectedDate;

      const targetDayItems = Array.isArray(eventsMap[startDateStr])
        ? [...eventsMap[startDateStr]]
        : [];

      const newItem: CalendarEventItem = {
        id: `ev-${Date.now()}`,
        title: newItemTitle.trim(),
        type: newItemType,
        completed: false,
        recurrence: effectiveRecurrence,
      };
      if (effectiveDays) newItem.recurrenceDays = effectiveDays;
      if (trimmedTime) newItem.time = trimmedTime;
      if (linkedDeckId) newItem.deckId = linkedDeckId;
      if (linkedFolderId) newItem.folderId = linkedFolderId;

      updateEvents({
        ...eventsMap,
        [startDateStr]: [...targetDayItems, newItem],
      });

      if (startDateStr !== selectedDate) {
        const startObj = new Date(startDateStr + 'T12:00:00');
        setCalendarMonth(
          new Date(startObj.getFullYear(), startObj.getMonth(), 1)
        );
        setSelectedDate(startDateStr);
      }
      resetFormInputs(startDateStr);
    }
  };

  const handleToggleTask = (displayItem: DisplayCalendarItem) => {
    const originDate = displayItem.originDate;
    const originItems = Array.isArray(eventsMap[originDate])
      ? eventsMap[originDate]
      : [];
    const isRec = displayItem.recurrence && displayItem.recurrence !== 'none';

    const updated = originItems.map((item) => {
      if (item.id !== displayItem.id) return item;
      if (isRec) {
        const prevDates = new Set(item.completedDates || []);
        if (prevDates.has(selectedDate)) prevDates.delete(selectedDate);
        else prevDates.add(selectedDate);
        return {
          ...item,
          completedDates: Array.from(prevDates),
          completed:
            originDate === selectedDate
              ? prevDates.has(selectedDate)
              : item.completed,
        };
      }
      return { ...item, completed: !item.completed };
    });

    updateEvents({ ...eventsMap, [originDate]: updated });
  };

  // Exclui toda a série (ou um evento único)
  const handleDeleteEntireSeries = (displayItem: DisplayCalendarItem) => {
    const originDate = displayItem.originDate;
    const originItems = Array.isArray(eventsMap[originDate])
      ? eventsMap[originDate]
      : [];
    const updated = originItems.filter((item) => item.id !== displayItem.id);
    const nextMap = { ...eventsMap };
    if (updated.length > 0) {
      nextMap[originDate] = updated;
    } else {
      delete nextMap[originDate];
    }
    updateEvents(nextMap);
    setPendingDeleteKey(null);
    if (editingItemId === displayItem.id) {
      resetFormInputs(selectedDate);
    }
  };

  // Exclui o evento recorrente apenas na data selecionada (mantendo os outros dias)
  const handleDeleteOnlyThisDate = (displayItem: DisplayCalendarItem) => {
    const originDate = displayItem.originDate;
    const originItems = Array.isArray(eventsMap[originDate])
      ? eventsMap[originDate]
      : [];

    const updated = originItems.map((item) => {
      if (item.id !== displayItem.id) return item;
      const nextExcluded = Array.from(
        new Set([...(item.excludedDates || []), selectedDate])
      );
      return {
        ...item,
        excludedDates: nextExcluded,
      };
    });

    updateEvents({ ...eventsMap, [originDate]: updated });
    setPendingDeleteKey(null);
    if (editingItemId === displayItem.id) {
      resetFormInputs(selectedDate);
    }
  };

  const handleDeleteButtonClick = (displayItem: DisplayCalendarItem) => {
    const isRecurring =
      displayItem.recurrence && displayItem.recurrence !== 'none';
    if (!isRecurring) {
      handleDeleteEntireSeries(displayItem);
      return;
    }
    const key = `${displayItem.originDate}-${displayItem.id}`;
    setPendingDeleteKey((prev) => (prev === key ? null : key));
  };

  const handleStartEditItem = (displayItem: DisplayCalendarItem) => {
    setPendingDeleteKey(null);
    setEditingItemId(displayItem.id);
    setEditingOriginDate(displayItem.originDate);
    setNewItemTitle(displayItem.title);
    setNewItemType(displayItem.type || 'task');
    setNewItemTime(displayItem.time || '');
    setNewItemRecurrence(displayItem.recurrence || 'none');
    if (
      displayItem.recurrence === 'custom_days' &&
      Array.isArray(displayItem.recurrenceDays) &&
      displayItem.recurrenceDays.length > 0
    ) {
      setNewItemRecurrenceDays([...displayItem.recurrenceDays]);
    } else {
      setNewItemRecurrenceDays([
        new Date(displayItem.originDate + 'T12:00:00').getDay(),
      ]);
    }
    if (displayItem.deckId) setNewItemLink(`deck:${displayItem.deckId}`);
    else if (displayItem.folderId) setNewItemLink(`folder:${displayItem.folderId}`);
    else setNewItemLink('');
  };

  const handleMoveAllOverdueToToday = () => {
    if (overdueTasks.length === 0) return;
    const todayStr = getTodayStr();
    const nextMap: Record<string, CalendarEventItem[]> = { ...eventsMap };
    const movedItems: CalendarEventItem[] = [];

    overdueTasks.forEach(({ originDate, item }) => {
      const currentList = Array.isArray(nextMap[originDate])
        ? nextMap[originDate]
        : [];
      const filtered = currentList.filter((x) => x.id !== item.id);
      if (filtered.length > 0) nextMap[originDate] = filtered;
      else delete nextMap[originDate];
      movedItems.push({ ...item, completed: false });
    });

    const todayList = Array.isArray(nextMap[todayStr]) ? nextMap[todayStr] : [];
    nextMap[todayStr] = [...todayList, ...movedItems];
    updateEvents(nextMap);
    setShowOverdueDetails(false);

    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr);
    resetFormInputs(todayStr);
  };

  const handleMoveSingleOverdueToToday = (
    originDate: string,
    targetItem: CalendarEventItem
  ) => {
    const todayStr = getTodayStr();
    const nextMap: Record<string, CalendarEventItem[]> = { ...eventsMap };
    const currentList = Array.isArray(nextMap[originDate])
      ? nextMap[originDate]
      : [];
    const filtered = currentList.filter((x) => x.id !== targetItem.id);
    if (filtered.length > 0) nextMap[originDate] = filtered;
    else delete nextMap[originDate];

    const todayList = Array.isArray(nextMap[todayStr]) ? nextMap[todayStr] : [];
    nextMap[todayStr] = [...todayList, { ...targetItem, completed: false }];
    updateEvents(nextMap);
  };

  const handleCompleteSingleOverdue = (
    originDate: string,
    targetItem: CalendarEventItem
  ) => {
    const nextMap: Record<string, CalendarEventItem[]> = { ...eventsMap };
    const currentList = Array.isArray(nextMap[originDate])
      ? nextMap[originDate]
      : [];
    nextMap[originDate] = currentList.map((x) =>
      x.id === targetItem.id ? { ...x, completed: true } : x
    );
    updateEvents(nextMap);
  };

  const resolveLinkedTarget = (item: CalendarEventItem) => {
    if (item.deckId) {
      const deck = validDecks.find((d) => d.id === item.deckId);
      if (!deck) return null;
      const cards = (deck.cards || []).filter((c) => !c.isSuspended);
      const newCardsCount = cards.filter(
        (c) => c.state === 0 || !c.reviews
      ).length;
      const dueCardsCount = cards.filter((c) => checkCardDue(c)).length;
      return {
        kind: 'deck' as const,
        id: deck.id,
        name: deck.name,
        totalCards: cards.length,
        newCardsCount,
        dueCardsCount,
      };
    }
    if (item.folderId) {
      const folder = folders.find((f) => f.id === item.folderId);
      if (!folder) return null;
      const folderDecks = getDecksInFolder
        ? getDecksInFolder(folder.id).filter((d) => !d.isIgnored)
        : validDecks.filter((d) => d.parentId === folder.id && !d.isIgnored);
      const cards = folderDecks
        .flatMap((d) => d.cards || [])
        .filter((c) => !c.isSuspended);
      const newCardsCount = cards.filter(
        (c) => c.state === 0 || !c.reviews
      ).length;
      const dueCardsCount = cards.filter((c) => checkCardDue(c)).length;
      return {
        kind: 'folder' as const,
        id: folder.id,
        name: folder.name,
        totalCards: cards.length,
        newCardsCount,
        dueCardsCount,
      };
    }
    return null;
  };

  const getExamMetrics = (examDateStr: string, item: CalendarEventItem) => {
    const todayStr = getTodayStr();
    const todayNoon = new Date(todayStr + 'T12:00:00');
    const examNoon = new Date(examDateStr + 'T12:00:00');
    const daysLeft = Math.round(
      (examNoon.getTime() - todayNoon.getTime()) / 86400000
    );
    const target = resolveLinkedTarget(item);
    const newCardsCount = target ? target.newCardsCount : 0;
    const newPerDay =
      daysLeft > 0 && newCardsCount > 0
        ? Math.ceil(newCardsCount / daysLeft)
        : 0;

    return { daysLeft, target, newCardsCount, newPerDay };
  };

  const renderMastery = () => {
    const gCards = activeDecksList.flatMap((d) => d.cards || []);
    const gStats = getCardStats(gCards);
    const totalC = gCards.length || 1;
    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative overflow-hidden group flex flex-col h-full justify-between animate-pop delay-300">
        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div>
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-400" /> Domínio Global
            </h3>
            <span className="text-xl font-black text-blue-400">
              {gCards.length}{' '}
              <span className="text-sm text-slate-500">cartões</span>
            </span>
          </div>
          <div className="w-full flex h-4 rounded-full overflow-hidden border border-slate-800 mb-6 relative z-10">
            <div
              title={`Novos: ${gStats.new}`}
              className="bg-blue-500"
              style={{ width: `${(gStats.new / totalC) * 100}%` }}
            ></div>
            <div
              title={`Aprender: ${gStats.learning}`}
              className="bg-rose-500"
              style={{ width: `${(gStats.learning / totalC) * 100}%` }}
            ></div>
            <div
              title={`Revisar: ${gStats.review}`}
              className="bg-emerald-400"
              style={{ width: `${(gStats.review / totalC) * 100}%` }}
            ></div>
            <div
              title={`Aprendidos: ${gStats.learned}`}
              className="bg-slate-600"
              style={{ width: `${(gStats.learned / totalC) * 100}%` }}
            ></div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center relative z-10 mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">
              Novos
            </span>
            <span className="text-sm font-semibold text-blue-400">
              {gStats.new}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">
              Aprender
            </span>
            <span className="text-sm font-semibold text-rose-400">
              {gStats.learning}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">
              Revisar
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              {gStats.review}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">
              Prontos
            </span>
            <span className="text-sm font-semibold text-slate-400">
              {gStats.learned}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const prevMonth = () => setCalendarMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarMonth(new Date(year, month + 1, 1));
    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const cells: React.ReactNode[] = [];
    let monthTotalRevisions = 0;

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    const todayStr = getTodayStr();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const nowDate = new Date();
    const isCurrentMonthView =
      year === nowDate.getFullYear() && month === nowDate.getMonth();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d, 12, 0, 0);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dy = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dy}`;

      const count = getDailyCount(dateStr);
      const forecastCount = forecastByDateStr[dateStr] || 0;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      const isSelected = dateStr === selectedDate;
      monthTotalRevisions += count;

      const isPast = dateObj < todayStart;
      const isRecovered = streakRecoveries.includes(dateStr);
      const isCompleted = count > 0 || isRecovered;

      const dayItems = getItemsForDate(dateStr);
      const tasks = dayItems.filter((i) => i.type === 'task');
      const pendingTasksCount = tasks.filter((t) => !t.isCompletedOnDate).length;
      const completedTasksCount = tasks.filter((t) => t.isCompletedOnDate).length;
      const remindersCount = dayItems.filter((i) => i.type === 'reminder').length;
      const examsCount = dayItems.filter((i) => i.type === 'exam').length;

      let bg = 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700';
      if (isCompleted) {
        if (count === 0 && isRecovered) {
          bg = 'bg-indigo-900/60 border-indigo-500/40 text-indigo-200';
        } else if (count > 0 && count < 5) {
          bg = 'bg-emerald-900/60 border-emerald-900 text-emerald-200';
        } else if (count >= 5 && count < 15) {
          bg = 'bg-emerald-700/80 border-emerald-700 text-emerald-100';
        } else if (count >= 15 && count < 30) {
          bg = 'bg-emerald-500 border-emerald-400 text-white';
        } else if (count >= 30) {
          bg =
            'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)] text-slate-900 font-bold';
        }
      } else if (examsCount > 0) {
        bg = 'bg-purple-950/50 border-purple-500/40 text-purple-200 hover:border-purple-400/60';
      }

      cells.push(
        <div
          key={d}
          tabIndex={0}
          onClick={() => {
            setSelectedDate(dateStr);
            resetFormInputs(dateStr);
          }}
          className={`relative flex flex-col items-center justify-center h-14 w-full rounded-xl border transition-all group cursor-pointer focus:outline-none hover:scale-105 hover:z-20 ${bg} ${
            isSelected
              ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 z-10'
              : ''
          }`}
        >
          <span className="text-sm pointer-events-none leading-none">{d}</span>

          {isFuture && forecastCount > 0 && (
            <span className="text-[9px] font-bold text-indigo-300/80 leading-none mt-1 pointer-events-none">
              {forecastCount}p
            </span>
          )}

          <div className="flex items-center gap-1 mt-1 pointer-events-none">
            {isToday && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                title="Hoje"
              />
            )}
            {examsCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.9)]"
                title={`${examsCount} prova(s)`}
              />
            )}
            {pendingTasksCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                title={`${pendingTasksCount} tarefa(s) pendente(s)`}
              />
            )}
            {pendingTasksCount === 0 && completedTasksCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-300"
                title="Todas as tarefas concluídas"
              />
            )}
            {remindersCount > 0 && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_4px_rgba(251,113,133,0.8)]"
                title={`${remindersCount} lembrete(s)`}
              />
            )}
          </div>

          <div className="absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 group-focus:translate-y-0 bg-slate-800/95 text-slate-200 text-[10px] font-medium px-2.5 py-1.5 rounded-lg pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700/80 flex flex-col items-center backdrop-blur-md">
            {isFuture ? (
              <span
                className={
                  forecastCount > 0
                    ? 'text-indigo-300 font-bold text-xs'
                    : 'text-slate-400'
                }
              >
                {forecastCount} {forecastCount === 1 ? 'revisão prevista' : 'revisões previstas'}
              </span>
            ) : (
              <span
                className={
                  count > 0 ? 'text-emerald-400 font-bold text-xs' : 'text-slate-400'
                }
              >
                {count} revisões
                {isToday && forecastCount > 0 ? ` • ${forecastCount} pendentes` : ''}
              </span>
            )}
            {dayItems.length > 0 && (
              <span className="text-amber-300 text-[9px] mt-0.5 font-semibold">
                {[
                  examsCount > 0 ? `${examsCount} prova(s)` : '',
                  tasks.length > 0 ? `${tasks.length} tarefa(s)` : '',
                  remindersCount > 0 ? `${remindersCount} lembrete(s)` : '',
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </span>
            )}
            {isRecovered && count === 0 && (
              <span className="text-indigo-300 text-[9px] mt-0.5 uppercase tracking-wider">
                Recuperada
              </span>
            )}
            {isPast && !isCompleted && (
              <span className="text-indigo-300 text-[9px] mt-0.5 uppercase tracking-wider">
                Clique p/ agenda ou recuperar
              </span>
            )}
          </div>
        </div>
      );
    }

    const selectedDayItems = getItemsForDate(selectedDate);
    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const selectedIsPast = selectedDateObj < todayStart;
    const selectedIsFuture = selectedDate > todayStr;
    const selectedCount = getDailyCount(selectedDate);
    const selectedForecastCount = forecastByDateStr[selectedDate] || 0;
    const selectedIsRecovered = streakRecoveries.includes(selectedDate);
    const selectedCanRecover =
      selectedIsPast && selectedCount === 0 && !selectedIsRecovered;
    const formattedSelectedDate = selectedDate.split('-').reverse().join('/');

    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl overflow-hidden flex flex-col h-full relative animate-pop delay-100">
        <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="flex justify-between items-start mb-5 relative z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-400" /> Calendário & Agenda
            </h3>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider min-w-[130px] text-center">
                {monthNames[month]} {year}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {(selectedDate !== todayStr || !isCurrentMonthView) && (
                <button
                  type="button"
                  onClick={() => {
                    const current = new Date();
                    setCalendarMonth(
                      new Date(current.getFullYear(), current.getMonth(), 1)
                    );
                    setSelectedDate(todayStr);
                    resetFormInputs(todayStr);
                  }}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Ir para Hoje
                </button>
              )}
            </div>
          </div>
          <div className="text-right bg-slate-950/50 px-4 py-2 rounded-2xl border border-slate-800/80">
            <span className="text-2xl font-black text-emerald-400">
              {monthTotalRevisions}
            </span>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Revisões no Mês
            </p>
          </div>
        </div>

        <div className="relative z-10 w-full">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">{cells}</div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-800/80 relative z-10 flex flex-col gap-4">
          {/* Aviso de tarefas atrasadas de dias anteriores */}
          {overdueTasks.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/35 rounded-2xl px-3.5 py-2.5 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {overdueTasks.length === 1
                      ? '1 tarefa pendente de dia anterior'
                      : `${overdueTasks.length} tarefas pendentes de dias anteriores`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOverdueDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-colors"
                  >
                    {showOverdueDetails ? (
                      <>
                        Ocultar <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        Ver <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveAllOverdueToToday}
                    className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg transition-all active:scale-95"
                  >
                    Mover para hoje <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {showOverdueDetails && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-amber-500/20 max-h-36 overflow-y-auto custom-scrollbar">
                  {overdueTasks.map(({ originDate, item }) => (
                    <div
                      key={`${originDate}-${item.id}`}
                      className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800/90 rounded-xl px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                          {originDate.split('-').reverse().slice(0, 2).join('/')}
                        </span>
                        <span className="text-slate-200 truncate font-medium">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleCompleteSingleOverdue(originDate, item)
                          }
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title="Marcar como concluída"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveSingleOverdueToToday(originDate, item)
                          }
                          className="text-[10px] font-bold text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-600 px-2 py-1 rounded-lg border border-indigo-500/30 transition-colors"
                        >
                          Hoje
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {nextUpcomingExam && (
            <div
              onClick={() => {
                const examDate = new Date(nextUpcomingExam.dateStr + 'T12:00:00');
                setCalendarMonth(
                  new Date(examDate.getFullYear(), examDate.getMonth(), 1)
                );
                setSelectedDate(nextUpcomingExam.dateStr);
                resetFormInputs(nextUpcomingExam.dateStr);
              }}
              className="flex flex-wrap items-center justify-between gap-2 bg-purple-950/30 hover:bg-purple-950/45 border border-purple-500/30 rounded-2xl px-3.5 py-2.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-purple-200 truncate">
                  Próxima Prova: {nextUpcomingExam.exam.title}
                </span>
                <span className="text-[11px] text-purple-300/80 font-semibold shrink-0">
                  ({nextUpcomingExam.dateStr.split('-').reverse().join('/')})
                </span>
              </div>
              {(() => {
                const { daysLeft, newPerDay, newCardsCount } = getExamMetrics(
                  nextUpcomingExam.dateStr,
                  nextUpcomingExam.exam
                );
                return (
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg">
                      {daysLeft === 0
                        ? 'É hoje!'
                        : daysLeft === 1
                        ? 'Falta 1 dia'
                        : `Faltam ${daysLeft} dias`}
                    </span>
                    {newPerDay > 0 && (
                      <span className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                        ~{newPerDay} novos/dia ({newCardsCount})
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100">
                {selectedDate === todayStr
                  ? `Hoje (${formattedSelectedDate})`
                  : `Dia ${formattedSelectedDate}`}
              </span>
              {!selectedIsFuture && (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                  {selectedCount} {selectedCount === 1 ? 'revisão' : 'revisões'}
                </span>
              )}
              {(selectedIsFuture || selectedDate === todayStr) &&
                selectedForecastCount > 0 && (
                  <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                    {selectedForecastCount}{' '}
                    {selectedDate === todayStr
                      ? 'pendentes'
                      : selectedForecastCount === 1
                      ? 'revisão prevista'
                      : 'revisões previstas'}
                  </span>
                )}
            </div>

            {selectedCanRecover && (
              <button
                type="button"
                onClick={() => setStreakRecoveryDate(selectedDate)}
                className="flex items-center gap-1.5 text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl transition-all active:scale-95"
              >
                <History className="w-3.5 h-3.5" /> Recuperar Ofensiva deste dia
              </button>
            )}
          </div>

          <form
            onSubmit={handleSaveCalendarItem}
            className="flex flex-col gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/90"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setNewItemType('task')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    newItemType === 'task'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Tarefa
                </button>
                <button
                  type="button"
                  onClick={() => setNewItemType('reminder')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    newItemType === 'reminder'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" /> Lembrete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewItemType('exam');
                    setNewItemRecurrence('none');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    newItemType === 'exam'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Prova
                </button>
              </div>

              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder={
                  newItemType === 'task'
                    ? 'Título da tarefa...'
                    : newItemType === 'reminder'
                    ? 'Título do lembrete...'
                    : 'Título da prova...'
                }
                className="flex-grow bg-slate-900 border border-slate-800 text-slate-100 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
              <select
                value={newItemLink}
                onChange={(e) => setNewItemLink(e.target.value)}
                className="flex-grow min-w-[180px] bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
                title="Vincular a um baralho ou coleção (opcional)"
              >
                <option value="">Sem vínculo com baralho/coleção</option>
                {folders.length > 0 && (
                  <optgroup label="Coleções">
                    {folders.map((f) => (
                      <option key={f.id} value={`folder:${f.id}`}>
                        Coleção: {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {activeDecksList.length > 0 && (
                  <optgroup label="Baralhos">
                    {activeDecksList.map((d) => (
                      <option key={d.id} value={`deck:${d.id}`}>
                        Baralho: {d.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {newItemType !== 'exam' && (
                <select
                  value={newItemRecurrence}
                  onChange={(e) => {
                    const val = e.target.value as CalendarRecurrence;
                    setNewItemRecurrence(val);
                    if (val === 'custom_days' && newItemRecurrenceDays.length === 0) {
                      setNewItemRecurrenceDays([
                        new Date(selectedDate + 'T12:00:00').getDay(),
                      ]);
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
                  title="Repetição automática"
                >
                  <option value="none">Não se repete</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekdays">Dias úteis (Seg–Sex)</option>
                  <option value="weekly">Semanalmente</option>
                  <option value="custom_days">Dias específicos</option>
                </select>
              )}

              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <input
                  type="time"
                  value={newItemTime}
                  onChange={(e) => setNewItemTime(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500"
                  title="Horário opcional"
                />
                {editingItemId && (
                  <button
                    type="button"
                    onClick={() => resetFormInputs(selectedDate)}
                    className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl"
                    title="Cancelar edição"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!newItemTitle.trim()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    newItemTitle.trim()
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Check className="w-4 h-4" /> Salvar
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Seletor de dias específicos da semana */}
            {newItemType !== 'exam' && newItemRecurrence === 'custom_days' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  Repetir em:
                </span>
                {WEEKDAY_SHORT.map((label, idx) => {
                  const active = newItemRecurrenceDays.includes(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleWeekdaySelection(idx)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                          : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          {selectedDayItems.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800/80">
              Nenhuma tarefa, lembrete ou prova agendada para {formattedSelectedDate}.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {selectedDayItems.map((item) => {
                const isTask = item.type === 'task';
                const isExam = item.type === 'exam';
                const hasRecurrence =
                  item.recurrence && item.recurrence !== 'none';
                const itemKey = `${item.originDate}-${item.id}`;
                const isConfirmingDelete = pendingDeleteKey === itemKey;
                const linkedTarget = resolveLinkedTarget(item);
                const examMetrics = isExam
                  ? getExamMetrics(selectedDate, item)
                  : null;

                return (
                  <div
                    key={itemKey}
                    className={`flex flex-col gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
                      isTask && item.isCompletedOnDate
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : isExam
                        ? 'bg-purple-950/25 border-purple-500/35 hover:border-purple-400/50'
                        : isTask
                        ? 'bg-slate-950/80 border-slate-800 hover:border-amber-500/30'
                        : 'bg-rose-950/20 border-rose-500/20 hover:border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-grow flex-wrap">
                        {isTask ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTask(item)}
                            className={`shrink-0 transition-colors ${
                              item.isCompletedOnDate
                                ? 'text-emerald-400'
                                : 'text-amber-400 hover:text-amber-300'
                            }`}
                            title={
                              item.isCompletedOnDate
                                ? 'Desmarcar tarefa'
                                : 'Concluir tarefa'
                            }
                          >
                            {item.isCompletedOnDate ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : isExam ? (
                          <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : (
                          <Bell className="w-4 h-4 text-rose-400 shrink-0" />
                        )}

                        <span
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            isTask && item.isCompletedOnDate
                              ? 'line-through text-slate-500'
                              : isExam
                              ? 'text-purple-100'
                              : 'text-slate-200'
                          }`}
                        >
                          {item.title}
                        </span>

                        {item.time && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md shrink-0">
                            <Clock className="w-3 h-3 text-indigo-400" />
                            {item.time}
                          </span>
                        )}

                        {hasRecurrence && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-md shrink-0">
                            <Repeat className="w-3 h-3 text-cyan-400" />
                            {formatRecurrenceBadge(item)}
                          </span>
                        )}

                        {isExam && examMetrics && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                            {examMetrics.daysLeft > 0
                              ? `Faltam ${examMetrics.daysLeft}d`
                              : examMetrics.daysLeft === 0
                              ? 'É hoje!'
                              : `Há ${Math.abs(examMetrics.daysLeft)}d`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {linkedTarget && startReview && (
                          <button
                            type="button"
                            onClick={() => {
                              if (linkedTarget.kind === 'deck') {
                                startReview(linkedTarget.id, false, null);
                              } else {
                                startReview(null, false, linkedTarget.id);
                              }
                            }}
                            disabled={linkedTarget.dueCardsCount === 0}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all mr-1 ${
                              linkedTarget.dueCardsCount > 0
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                            }`}
                            title={
                              linkedTarget.dueCardsCount > 0
                                ? `Estudar ${linkedTarget.dueCardsCount} pendentes`
                                : 'Sem cartões pendentes agora'
                            }
                          >
                            <Play className="w-3 h-3 fill-current" /> Estudar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditItem(item)}
                          className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors"
                          title={
                            item.isProjected ? 'Editar série recorrente' : 'Editar'
                          }
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteButtonClick(item)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isConfirmingDelete
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Opções de exclusão para eventos recorrentes */}
                    {isConfirmingDelete && hasRecurrence && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-950/35 border border-rose-500/30 rounded-xl px-3 py-2 text-xs">
                        <span className="text-rose-200 font-semibold">
                          Como deseja excluir este evento recorrente?
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteOnlyThisDate(item)}
                            className="px-2.5 py-1 rounded-lg font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
                          >
                            Somente dia {formattedSelectedDate.slice(0, 5)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntireSeries(item)}
                            className="px-2.5 py-1 rounded-lg font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                          >
                            Toda a série
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteKey(null)}
                            className="px-2 py-1 rounded-lg font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {(linkedTarget || (isExam && examMetrics)) && (
                      <div className="flex flex-wrap items-center gap-2 pl-6 text-[11px]">
                        {linkedTarget && (
                          <span className="inline-flex items-center gap-1 text-slate-300 bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded-md font-medium">
                            {linkedTarget.kind === 'deck' ? (
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                            ) : (
                              <FolderIcon className="w-3 h-3 text-indigo-400" />
                            )}
                            {linkedTarget.name}
                            <span className="text-slate-500 ml-1">
                              ({linkedTarget.dueCardsCount} pend.)
                            </span>
                          </span>
                        )}

                        {isExam && examMetrics && linkedTarget && examMetrics.daysLeft > 0 && (
                          <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                            <Layers className="w-3 h-3 text-emerald-400" />
                            {examMetrics.newCardsCount > 0
                              ? `Meta: ~${examMetrics.newPerDay} cartões novos/dia (${examMetrics.newCardsCount} restantes)`
                              : 'Todos os cartões novos já foram iniciados!'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderForecast = () => {
    const allCards = activeDecksList.flatMap((d) => d.cards || []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    let bucketCount = 7;
    const labels: string[] = [];
    const buckets: {
      date?: number;
      month?: number;
      year?: number;
      count: number;
      readyNow: number;
      laterToday: number;
      label: string;
    }[] = [];

    if (forecastPeriod === 'week') {
      bucketCount = 7;
      for (let i = 0; i < bucketCount; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        labels.push(
          i === 0
            ? 'Hoje'
            : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
        );
        buckets.push({
          date: d.getTime(),
          count: 0,
          readyNow: 0,
          laterToday: 0,
          label: labels[i],
        });
      }
    } else if (forecastPeriod === 'month') {
      bucketCount = 30;
      for (let i = 0; i < bucketCount; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const day = String(d.getDate()).padStart(2, '0');
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        labels.push(i === 0 ? 'Hoje' : `${day}/${mo}`);
        buckets.push({
          date: d.getTime(),
          count: 0,
          readyNow: 0,
          laterToday: 0,
          label: labels[i],
        });
      }
    } else if (forecastPeriod === 'year') {
      bucketCount = 12;
      for (let i = 0; i < bucketCount; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        labels.push(
          d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
        );
        buckets.push({
          month: d.getMonth(),
          year: d.getFullYear(),
          count: 0,
          readyNow: 0,
          laterToday: 0,
          label: labels[i],
        });
      }
    }

    allCards.forEach((c) => {
      if (c.isSuspended) return;
      const isDueNow = checkCardDue(c);
      const isDueToday =
        !isCardBuried(c) &&
        (!c.dueDate || isDueNow || c.dueDate <= endOfToday.getTime());

      if (isDueToday) {
        if (forecastPeriod === 'week' || forecastPeriod === 'month') {
          buckets[0].count++;
          if (isDueNow) buckets[0].readyNow++;
          else buckets[0].laterToday++;
        } else if (forecastPeriod === 'year') {
          const bIdx = buckets.findIndex(
            (b) => b.month === today.getMonth() && b.year === today.getFullYear()
          );
          if (bIdx !== -1) buckets[bIdx].count++;
        }
      } else if (c.dueDate) {
        const cDateStart = new Date(c.dueDate);
        cDateStart.setHours(0, 0, 0, 0);

        if (forecastPeriod === 'week' || forecastPeriod === 'month') {
          const diffTime = cDateStart.getTime() - today.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < bucketCount) {
            buckets[diffDays].count++;
          }
        } else if (forecastPeriod === 'year') {
          const bIdx = buckets.findIndex(
            (b) =>
              b.month === cDateStart.getMonth() &&
              b.year === cDateStart.getFullYear()
          );
          if (bIdx !== -1) {
            buckets[bIdx].count++;
          }
        }
      }
    });

    const max = Math.max(...buckets.map((b) => b.count), 10);

    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col h-full relative group animate-pop delay-400">
        <div className="absolute top-0 left-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-400" /> Previsão
          </h3>

          <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner text-xs">
            <button
              onClick={() => setForecastPeriod('week')}
              className={`px-3 py-1.5 font-bold transition-colors ${
                forecastPeriod === 'week'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              7 Dias
            </button>
            <div className="w-px bg-slate-700"></div>
            <button
              onClick={() => setForecastPeriod('month')}
              className={`px-3 py-1.5 font-bold transition-colors ${
                forecastPeriod === 'month'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              30 Dias
            </button>
            <div className="w-px bg-slate-700"></div>
            <button
              onClick={() => setForecastPeriod('year')}
              className={`px-3 py-1.5 font-bold transition-colors ${
                forecastPeriod === 'year'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              1 Ano
            </button>
          </div>
        </div>

        <div className="flex items-end justify-between flex-grow min-h-[200px] gap-1.5 sm:gap-2 relative z-10 mt-auto chart-scroll-container overflow-x-auto pb-2 pt-16">
          <div
            className={`flex items-end justify-between h-full w-full gap-1.5 sm:gap-2 px-3 ${
              forecastPeriod === 'month' ? 'min-w-[600px]' : 'min-w-full'
            }`}
          >
            {buckets.map((b, i) => {
              const height = Math.max((b.count / max) * 100, 4);
              const showLabel =
                forecastPeriod === 'week' ||
                forecastPeriod === 'year' ||
                (forecastPeriod === 'month' && i % 3 === 0);
              return (
                <div
                  key={i}
                  className="relative flex flex-col items-center flex-1 min-w-0 h-full justify-end group/bar"
                >
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 bg-slate-800 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-700 flex flex-col items-center origin-bottom">
                    <span className="text-indigo-300 text-sm">
                      {b.count}{' '}
                      <span className="text-xs text-slate-400 font-medium">
                        cartões
                      </span>
                    </span>
                    {i === 0 && b.laterToday > 0 && (
                      <span className="text-[10px] text-amber-400 font-medium mt-0.5">
                        {b.readyNow > 0
                          ? `${b.readyNow} agora • ${b.laterToday} mais tarde`
                          : `${b.laterToday} ainda hoje`}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">
                      {b.label}
                    </span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800"></div>
                  </div>

                  <div className="w-full max-w-[40px] relative flex items-end justify-center flex-grow bg-slate-950 rounded-t-md sm:rounded-t-xl border border-b-0 border-slate-800/80 hover:border-indigo-500/50 transition-colors overflow-hidden">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600/80 to-purple-400/80 rounded-t-md sm:rounded-t-xl transition-all duration-500 group-hover/bar:from-indigo-500 group-hover/bar:to-purple-300"
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                  <div className="relative w-full h-4 mt-2 flex items-center justify-center">
                    {showLabel && (
                      <span className="absolute text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap pointer-events-none">
                        {b.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDeckDistribution = () => {
    const allStudiedDecks = activeDecksList
      .map((d) => {
        const effort = (d.cards || []).reduce(
          (sum, c) => sum + (c.reviews || 0),
          0
        );
        const cardCount = d.cards?.length || 1;
        const intensity = effort / cardCount;
        return { name: d.name, effort: intensity, rawEffort: effort, cardCount };
      })
      .filter((d) => d.rawEffort > 0)
      .sort((a, b) => b.effort - a.effort);

    const totalStudiedDecksCount = allStudiedDecks.length;
    const totalRawReviews = allStudiedDecks.reduce(
      (sum, d) => sum + d.rawEffort,
      0
    );
    const totalStudiedCards =
      allStudiedDecks.reduce((sum, d) => sum + d.cardCount, 0) || 1;
    const globalAvgEffort = (totalRawReviews / totalStudiedCards).toFixed(1);

    let dist = [...allStudiedDecks];
    const totalEffort = dist.reduce((sum, d) => sum + d.effort, 0);

    if (dist.length > 4) {
      const top = dist.slice(0, 3);
      const othersSlice = dist.slice(3);
      const othersEffort = othersSlice.reduce((sum, d) => sum + d.effort, 0);
      const othersRaw = othersSlice.reduce((sum, d) => sum + d.rawEffort, 0);
      const othersCards =
        othersSlice.reduce((sum, d) => sum + d.cardCount, 0) || 1;
      top.push({
        name: `Outros (${othersSlice.length})`,
        effort: othersEffort,
        rawEffort: othersRaw,
        cardCount: othersCards,
      });
      dist = top;
    }

    const colors = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#94a3b8'];

    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col h-full justify-between relative group animate-pop delay-200">
        <div className="absolute bottom-0 left-0 p-32 bg-amber-500/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-4 relative z-10">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" /> Intensidade
          </h3>
          <span className="text-[11px] font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg uppercase tracking-wider">
            Média de Esforço
          </span>
        </div>

        {totalEffort === 0 ? (
          <div className="flex-grow flex items-center justify-center text-slate-500 text-sm italic relative z-10 py-12">
            Nenhum dado de estudo ainda.
          </div>
        ) : (
          <div className="flex flex-col gap-5 flex-grow justify-between relative z-10 w-full">
            <div className="flex flex-col gap-3 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/70 flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Ativos
                  </span>
                  <div className="text-base sm:text-lg font-black text-slate-100 mt-0.5">
                    {totalStudiedDecksCount}
                    <span className="text-[10px] text-slate-500 font-semibold ml-1">
                      baralhos
                    </span>
                  </div>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/70 flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Média Geral
                  </span>
                  <div className="text-base sm:text-lg font-black text-amber-400 mt-0.5">
                    {globalAvgEffort}
                    <span className="text-[10px] text-slate-500 font-semibold ml-1">
                      rev/c
                    </span>
                  </div>
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/70 flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Volume
                  </span>
                  <div className="text-base sm:text-lg font-black text-indigo-400 mt-0.5">
                    {totalRawReviews}
                    <span className="text-[10px] text-slate-500 font-semibold ml-1">
                      rev
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full flex h-3 rounded-full overflow-hidden bg-slate-900 p-0.5 gap-1 border border-slate-800">
                {dist.map((item, i) => {
                  const pct = Math.max((item.effort / totalEffort) * 100, 4);
                  return (
                    <div
                      key={i}
                      title={`${item.name}: ${item.effort.toFixed(
                        1
                      )} rev/cartão (${Math.round(
                        (item.effort / totalEffort) * 100
                      )}%)`}
                      className="h-full rounded-full transition-all duration-700 hover:brightness-125"
                      style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full my-auto">
              {dist.map((item, i) => {
                const pct = Math.round((item.effort / totalEffort) * 100);
                return (
                  <div key={i} className="flex flex-col gap-1.5 group/item w-full">
                    <div className="flex items-center justify-between text-xs sm:text-sm gap-2 w-full">
                      <div className="flex items-center gap-2 min-w-0 flex-grow">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_8px_currentColor]"
                          style={{ backgroundColor: colors[i], color: colors[i] }}
                        ></div>
                        <span
                          className="text-slate-200 font-semibold truncate group-hover/item:text-white transition-colors"
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.effort.toFixed(1)} rev/c
                        </span>
                        <span className="font-black text-slate-300 w-9 text-right bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 text-xs">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAnnualHeatmap = () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const totalDays = 365;
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - (totalDays - 1));

    const startDayOfWeek = startDay.getDay();
    const cells: {
      empty: boolean;
      key: string;
      dateStr?: string;
      labelDate?: string;
      count?: number;
      isRecovered?: boolean;
      month?: number;
      dayOfMonth?: number;
    }[] = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ empty: true, key: `pad-${i}` });
    }

    let studiedDaysYear = 0;
    let totalYearRevisions = 0;
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    const weekdayActiveCounts = [0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dy}`;
      const count = getDailyCount(dateStr);
      const isRecovered = streakRecoveries.includes(dateStr);
      const dow = d.getDay();

      if (count > 0 || isRecovered) {
        studiedDaysYear++;
      }
      if (count > 0) {
        totalYearRevisions += count;
        weekdayTotals[dow] += count;
        weekdayActiveCounts[dow]++;
      }

      cells.push({
        empty: false,
        key: dateStr,
        dateStr,
        labelDate: `${dy}/${m}/${y}`,
        count,
        isRecovered,
        month: d.getMonth(),
        dayOfMonth: d.getDate(),
      });
    }

    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    const weekdayNamesFull = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    let bestDowIndex = -1;
    let bestDowTotal = 0;
    for (let d = 0; d < 7; d++) {
      if (weekdayTotals[d] > bestDowTotal) {
        bestDowTotal = weekdayTotals[d];
        bestDowIndex = d;
      }
    }
    const bestDayName =
      bestDowIndex !== -1 ? weekdayNamesFull[bestDowIndex] : 'Sem dados ainda';
    const bestDayAvg =
      bestDowIndex !== -1 && weekdayActiveCounts[bestDowIndex] > 0
        ? Math.round(weekdayTotals[bestDowIndex] / weekdayActiveCounts[bestDowIndex])
        : 0;

    const currentStreak = calculateStreak();
    const longestStreak = calculateLongestStreak();
    const annualConsistencyPct = Math.round((studiedDaysYear / totalDays) * 100);
    const shortMonths = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    return (
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-col gap-5 relative overflow-hidden animate-pop delay-300">
        <div className="absolute -top-20 right-1/4 p-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between gap-3 relative z-10">
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Atividade Anual
          </h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-800">
            {totalYearRevisions} revisões no ano
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 relative z-10">
          <div className="bg-slate-950/70 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Ofensiva
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-black text-amber-400">
                  {currentStreak}d
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  Recorde:{' '}
                  <strong className="text-slate-300">{longestStreak}d</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Melhor Dia
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base sm:text-lg font-black text-indigo-300 truncate">
                  {bestDayName}
                </span>
                {bestDowIndex !== -1 && (
                  <span className="text-xs text-slate-500 font-semibold">
                    ~{bestDayAvg}/dia
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Consistência
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-black text-emerald-400">
                  {studiedDaysYear}d
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {annualConsistencyPct}% do ano
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto custom-scrollbar pb-2 pt-4 relative z-10">
          <div className="min-w-[740px] flex flex-col gap-1.5">
            <div className="flex items-center gap-1 pl-8 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {weeks.map((week, wIdx) => {
                const firstOfMonth = week.find(
                  (c) =>
                    !c.empty &&
                    c.dayOfMonth! <= 7 &&
                    (wIdx === 0 ||
                      weeks[wIdx - 1].every(
                        (prev) => prev.empty || prev.month !== c.month
                      ))
                );
                return (
                  <div key={wIdx} className="w-3 shrink-0 relative h-3">
                    {firstOfMonth && firstOfMonth.month !== undefined && (
                      <span className="absolute left-0 top-0 whitespace-nowrap">
                        {shortMonths[firstOfMonth.month]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-1">
              <div className="flex flex-col gap-1 pr-2 text-[9px] font-bold text-slate-500 uppercase leading-3 select-none">
                <span className="h-3 flex items-center">Dom</span>
                <span className="h-3 flex items-center opacity-0">Seg</span>
                <span className="h-3 flex items-center">Ter</span>
                <span className="h-3 flex items-center opacity-0">Qua</span>
                <span className="h-3 flex items-center">Qui</span>
                <span className="h-3 flex items-center opacity-0">Sex</span>
                <span className="h-3 flex items-center">Sáb</span>
              </div>

              <div className="flex items-center gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {Array.from({ length: 7 }).map((_, dIdx) => {
                      const cell = week[dIdx];
                      if (!cell || cell.empty) {
                        return (
                          <div
                            key={`empty-${wIdx}-${dIdx}`}
                            className="w-3 h-3 rounded-[3px] bg-transparent"
                          />
                        );
                      }
                      const cCount = cell.count || 0;
                      let cellColor = 'bg-slate-950 border border-slate-800/80';
                      if (cCount === 0 && cell.isRecovered) {
                        cellColor = 'bg-indigo-600/70 border border-indigo-400/50';
                      } else if (cCount > 0 && cCount < 5) {
                        cellColor = 'bg-emerald-900/80 border border-emerald-800';
                      } else if (cCount >= 5 && cCount < 15) {
                        cellColor = 'bg-emerald-700 border border-emerald-600';
                      } else if (cCount >= 15 && cCount < 30) {
                        cellColor = 'bg-emerald-500 border border-emerald-400';
                      } else if (cCount >= 30) {
                        cellColor =
                          'bg-emerald-300 border border-emerald-200 shadow-[0_0_6px_rgba(52,211,153,0.5)]';
                      }

                      return (
                        <div
                          key={cell.key}
                          className={`w-3 h-3 rounded-[3px] transition-transform hover:scale-150 hover:z-30 relative group/hcell cursor-default ${cellColor}`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/hcell:opacity-100 pointer-events-none transition-opacity bg-slate-800 text-slate-100 text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap shadow-xl border border-slate-700 z-50">
                            <span className="text-emerald-400 font-bold">
                              {cCount} rev
                            </span>{' '}
                            em {cell.labelDate}
                            {cell.isRecovered && cCount === 0 && (
                              <span className="text-indigo-300 ml-1">
                                (Recuperada)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-slate-500 font-semibold">
              <span>Menos</span>
              <span className="w-3 h-3 rounded-[3px] bg-slate-950 border border-slate-800"></span>
              <span className="w-3 h-3 rounded-[3px] bg-emerald-900/80 border border-emerald-800"></span>
              <span className="w-3 h-3 rounded-[3px] bg-emerald-700 border border-emerald-600"></span>
              <span className="w-3 h-3 rounded-[3px] bg-emerald-500 border border-emerald-400"></span>
              <span className="w-3 h-3 rounded-[3px] bg-emerald-300 border border-emerald-200"></span>
              <span>Mais</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 mb-8 pb-10">
      <div className="lg:col-span-2 xl:col-span-2">{renderCalendar()}</div>
      <div className="lg:col-span-1 xl:col-span-1">{renderMastery()}</div>
      <div className="lg:col-span-1 xl:col-span-1">{renderDeckDistribution()}</div>
      <div className="lg:col-span-2 xl:col-span-2">{renderForecast()}</div>
      <div className="lg:col-span-2 xl:col-span-3">{renderAnnualHeatmap()}</div>
    </div>
  );
};