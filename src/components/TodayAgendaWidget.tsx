import React, { useMemo } from 'react';
import {
  CalendarDays,
  CheckSquare,
  Square,
  Bell,
  GraduationCap,
  Clock,
  Play,
  AlertCircle,
  ArrowRight,
  Repeat,
  Layers,
} from 'lucide-react';
import type {
  CalendarEventItem,
  CalendarRecurrence,
  Deck,
  Folder,
} from '../types';
import { checkCardDue } from '../utils/fsrs';
import { getTodayStr } from '../utils/helpers';

interface TodayDisplayItem extends CalendarEventItem {
  originDate: string;
  isCompletedToday: boolean;
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const formatRecurrenceLabel = (item: CalendarEventItem): string => {
  if (!item.recurrence || item.recurrence === 'none') return '';
  if (item.recurrence === 'daily') return 'Diário';
  if (item.recurrence === 'weekdays') return 'Seg–Sex';
  if (item.recurrence === 'weekly') return 'Semanal';
  if (item.recurrence === 'custom_days') {
    const days = [...(item.recurrenceDays || [])].sort((a, b) => a - b);
    if (days.length === 0) return 'Dias específicos';
    if (days.length === 7) return 'Todos os dias';
    return days.map((d) => WEEKDAY_SHORT[d]).join(', ');
  }
  return '';
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

interface TodayAgendaWidgetProps {
  calendarEvents?: Record<string, CalendarEventItem[]>;
  onUpdateCalendarEvents?: (newEvents: Record<string, CalendarEventItem[]>) => void;
  validDecks: Deck[];
  folders: Folder[];
  getDecksInFolder: (folderId: string | null) => Deck[];
  startReview: (
    deckId: string | null,
    forceAll?: boolean,
    folderId?: string | null
  ) => void;
  onOpenCalendarTab: () => void;
}

export const TodayAgendaWidget: React.FC<TodayAgendaWidgetProps> = ({
  calendarEvents = {},
  onUpdateCalendarEvents,
  validDecks,
  folders,
  getDecksInFolder,
  startReview,
  onOpenCalendarTab,
}) => {
  const todayStr = getTodayStr();
  const eventsMap =
    calendarEvents &&
    typeof calendarEvents === 'object' &&
    !Array.isArray(calendarEvents)
      ? calendarEvents
      : {};

  const todayItems = useMemo(() => {
    const list: TodayDisplayItem[] = [];

    const rawDirect = Array.isArray(eventsMap[todayStr])
      ? eventsMap[todayStr]
      : [];
    rawDirect.forEach((item) => {
      if ((item.excludedDates || []).includes(todayStr)) return;
      const isRec = item.recurrence && item.recurrence !== 'none';
      const isCompletedToday = isRec
        ? (item.completedDates || []).includes(todayStr) || !!item.completed
        : !!item.completed;
      list.push({
        ...item,
        originDate: todayStr,
        isCompletedToday,
      });
    });

    Object.entries(eventsMap).forEach(([originDate, items]) => {
      if (originDate >= todayStr || !Array.isArray(items)) return;
      items.forEach((item) => {
        if ((item.excludedDates || []).includes(todayStr)) return;
        if (
          matchesRecurrenceOnDate(
            originDate,
            todayStr,
            item.recurrence,
            item.recurrenceDays
          )
        ) {
          list.push({
            ...item,
            originDate,
            isCompletedToday: (item.completedDates || []).includes(todayStr),
          });
        }
      });
    });

    return list.sort((a, b) =>
      (a.time || '99:99').localeCompare(b.time || '99:99')
    );
  }, [eventsMap, todayStr]);

  const overdueCount = useMemo(() => {
    let count = 0;
    Object.entries(eventsMap).forEach(([dateStr, items]) => {
      if (dateStr >= todayStr || !Array.isArray(items)) return;
      items.forEach((item) => {
        const isOneOff = !item.recurrence || item.recurrence === 'none';
        if (item.type === 'task' && !item.completed && isOneOff) {
          count++;
        }
      });
    });
    return count;
  }, [eventsMap, todayStr]);

  const nextExamInfo = useMemo(() => {
    const futureDates = Object.keys(eventsMap)
      .filter((d) => d >= todayStr)
      .sort();

    for (const dateStr of futureDates) {
      const items = Array.isArray(eventsMap[dateStr]) ? eventsMap[dateStr] : [];
      const exam = items.find(
        (i) => i.type === 'exam' && !(i.excludedDates || []).includes(dateStr)
      );
      if (exam) {
        const todayNoon = new Date(todayStr + 'T12:00:00');
        const examNoon = new Date(dateStr + 'T12:00:00');
        const daysLeft = Math.round(
          (examNoon.getTime() - todayNoon.getTime()) / 86400000
        );

        let newCardsCount = 0;
        if (exam.deckId) {
          const deck = validDecks.find((d) => d.id === exam.deckId);
          if (deck) {
            newCardsCount = (deck.cards || []).filter(
              (c) => !c.isSuspended && (c.state === 0 || !c.reviews)
            ).length;
          }
        } else if (exam.folderId) {
          const fDecks = getDecksInFolder(exam.folderId).filter(
            (d) => !d.isIgnored
          );
          newCardsCount = fDecks
            .flatMap((d) => d.cards || [])
            .filter(
              (c) => !c.isSuspended && (c.state === 0 || !c.reviews)
            ).length;
        }

        const newPerDay =
          daysLeft > 0 && newCardsCount > 0
            ? Math.ceil(newCardsCount / daysLeft)
            : 0;

        return { dateStr, exam, daysLeft, newCardsCount, newPerDay };
      }
    }
    return null;
  }, [eventsMap, todayStr, validDecks, getDecksInFolder]);

  const handleToggleTodayTask = (targetItem: TodayDisplayItem) => {
    if (!onUpdateCalendarEvents) return;
    const originDate = targetItem.originDate;
    const originItems = Array.isArray(eventsMap[originDate])
      ? eventsMap[originDate]
      : [];
    const isRec = targetItem.recurrence && targetItem.recurrence !== 'none';

    const updated = originItems.map((item) => {
      if (item.id !== targetItem.id) return item;
      if (isRec) {
        const prevDates = new Set(item.completedDates || []);
        if (prevDates.has(todayStr)) prevDates.delete(todayStr);
        else prevDates.add(todayStr);
        return {
          ...item,
          completedDates: Array.from(prevDates),
          completed:
            originDate === todayStr
              ? prevDates.has(todayStr)
              : item.completed,
        };
      }
      return { ...item, completed: !item.completed };
    });

    onUpdateCalendarEvents({ ...eventsMap, [originDate]: updated });
  };

  const resolveLinkedStudyTarget = (item: CalendarEventItem) => {
    if (item.deckId) {
      const deck = validDecks.find((d) => d.id === item.deckId);
      if (!deck) return null;
      const dueCount = (deck.cards || []).filter((c) => checkCardDue(c)).length;
      return {
        kind: 'deck' as const,
        id: deck.id,
        name: deck.name,
        dueCount,
      };
    }
    if (item.folderId) {
      const folder = folders.find((f) => f.id === item.folderId);
      if (!folder) return null;
      const fDecks = getDecksInFolder(folder.id).filter((d) => !d.isIgnored);
      const dueCount = fDecks
        .flatMap((d) => d.cards || [])
        .filter((c) => checkCardDue(c)).length;
      return {
        kind: 'folder' as const,
        id: folder.id,
        name: folder.name,
        dueCount,
      };
    }
    return null;
  };

  const hasAnyHighlight =
    todayItems.length > 0 || overdueCount > 0 || nextExamInfo !== null;

  if (!hasAnyHighlight) {
    return (
      <div className="rounded-2xl px-4 py-3 border border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-400">
          <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Nenhum compromisso agendado para hoje.</span>
        </div>
        <button
          type="button"
          onClick={onOpenCalendarTab}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-xl transition-colors shrink-0"
        >
          Abrir Agenda <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 sm:p-5 border border-slate-800/80 bg-slate-900/50 shadow-lg flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-slate-100">
            Agenda de Hoje
          </h3>
          {todayItems.length > 0 && (
            <span className="text-xs font-semibold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg">
              {todayItems.filter((i) => i.type === 'task' && i.isCompletedToday).length}
              /{todayItems.length}
            </span>
          )}
          {overdueCount > 0 && (
            <button
              type="button"
              onClick={onOpenCalendarTab}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2.5 py-0.5 rounded-lg transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              {overdueCount === 1
                ? '1 tarefa atrasada'
                : `${overdueCount} tarefas atrasadas`}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCalendarTab}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl transition-colors"
        >
          Calendário completo <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {nextExamInfo && (
        <div
          onClick={onOpenCalendarTab}
          className="flex flex-wrap items-center justify-between gap-2 bg-purple-950/30 hover:bg-purple-950/45 border border-purple-500/30 rounded-xl px-3.5 py-2 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-purple-200 truncate">
              {nextExamInfo.exam.title}
            </span>
            <span className="text-[11px] text-purple-300/80 font-medium shrink-0">
              ({nextExamInfo.dateStr.split('-').reverse().join('/')})
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
              {nextExamInfo.daysLeft === 0
                ? 'É hoje!'
                : nextExamInfo.daysLeft === 1
                ? 'Falta 1 dia'
                : `Faltam ${nextExamInfo.daysLeft} dias`}
            </span>
            {nextExamInfo.newPerDay > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <Layers className="w-3 h-3 text-emerald-400" />~
                {nextExamInfo.newPerDay} novos/dia
              </span>
            )}
          </div>
        </div>
      )}

      {todayItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {todayItems.map((item) => {
            const isTask = item.type === 'task';
            const isExam = item.type === 'exam';
            const hasRecurrence =
              item.recurrence && item.recurrence !== 'none';
            const linkedTarget = resolveLinkedStudyTarget(item);

            return (
              <div
                key={`${item.originDate}-${item.id}`}
                className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all ${
                  isTask && item.isCompletedToday
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : isExam
                    ? 'bg-purple-950/25 border-purple-500/30'
                    : isTask
                    ? 'bg-slate-950/80 border-slate-800'
                    : 'bg-rose-950/20 border-rose-500/25'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-grow">
                  {isTask ? (
                    <button
                      type="button"
                      onClick={() => handleToggleTodayTask(item)}
                      className={`shrink-0 transition-colors ${
                        item.isCompletedToday
                          ? 'text-emerald-400'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      {item.isCompletedToday ? (
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

                  <div className="min-w-0 flex-grow">
                    <span
                      className={`text-xs sm:text-sm font-semibold block truncate ${
                        isTask && item.isCompletedToday
                          ? 'line-through text-slate-500'
                          : 'text-slate-200'
                      }`}
                    >
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {item.time && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          {item.time}
                        </span>
                      )}
                      {hasRecurrence && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400">
                          <Repeat className="w-3 h-3" />
                          {formatRecurrenceLabel(item)}
                        </span>
                      )}
                      {linkedTarget && (
                        <span className="text-[10px] font-medium text-slate-400 truncate">
                          • {linkedTarget.name} ({linkedTarget.dueCount} pend.)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {linkedTarget && (
                  <button
                    type="button"
                    onClick={() => {
                      if (linkedTarget.kind === 'deck') {
                        startReview(linkedTarget.id, false, null);
                      } else {
                        startReview(null, false, linkedTarget.id);
                      }
                    }}
                    disabled={linkedTarget.dueCount === 0}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                      linkedTarget.dueCount > 0
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                        : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" /> Estudar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};