import type { ActivityMap, Card, CardStats, Deck } from '../types';
import { checkCardDue } from './fsrs';

export const cleanupData = (
  map: ActivityMap,
  recs: string[]
): { cleanMap: ActivityMap; cleanRecoveries: string[]; hasChanges: boolean } => {
  let mapChanged = false;
  const newMap: ActivityMap = { ...map };
  const safeRecs = Array.isArray(recs) ? recs : [];
  const newRecSet = new Set<string>(safeRecs);

  for (const date in newMap) {
    if (Array.isArray(newMap[date])) {
      const ids = newMap[date];
      const realIds: string[] = [];
      const idCounts: Record<string, number> = {};
      let hadFakeOrBug = false;

      for (const id of ids) {
        const strId = String(id);
        if (
          strId.startsWith('recovered-') ||
          strId === 'dummy' ||
          strId === 'phantom' ||
          strId === 'ghost'
        ) {
          hadFakeOrBug = true;
          newRecSet.add(date);
        } else {
          idCounts[strId] = (idCounts[strId] || 0) + 1;
          if (idCounts[strId] <= 10) {
            realIds.push(id);
          } else {
            hadFakeOrBug = true;
          }
        }
      }

      if (hadFakeOrBug || realIds.length !== ids.length) {
        newMap[date] = realIds;
        mapChanged = true;
      }
    }
  }

  return {
    cleanMap: newMap,
    cleanRecoveries: Array.from(newRecSet),
    hasChanges: mapChanged || newRecSet.size !== safeRecs.length,
  };
};

export const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });

export const getTodayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export const parseTagsString = (str?: string): string[] => {
  if (!str || typeof str !== 'string') return [];
  return Array.from(
    new Set(
      str
        .split(/[\s,;]+/)
        .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

export const getAllGlobalTags = (sourceDecks: Deck[] = []): string[] => {
  const tagSet = new Set<string>();
  sourceDecks.forEach((d) => {
    if (d.isIgnored) return;
    (d.cards || []).forEach((c) => {
      (c.tags || []).forEach((t) => tagSet.add(t));
    });
  });
  return Array.from(tagSet).sort();
};

export const getCardStats = (cards?: Card[]): CardStats => {
  return (cards || []).reduce<CardStats>(
    (acc, card) => {
      if (card.isSuspended) {
        acc.suspended = (acc.suspended || 0) + 1;
        return acc;
      }
      const state = card.state !== undefined ? card.state : card.reviews > 0 ? 2 : 0;
      const r = card.reviews || 0;
      const isDue = checkCardDue(card);

      if (state === 0 || r === 0) {
        if (isDue) acc.new++;
      } else if (state === 1 || state === 3 || card.interval < 1) {
        acc.learning++;
      } else {
        if (isDue) acc.review++;
        else acc.learned++;
      }
      return acc;
    },
    { new: 0, learning: 0, review: 0, learned: 0, suspended: 0 }
  );
};

export const calculateTotalDue = (stats: CardStats): number =>
  stats.new + stats.learning + stats.review;