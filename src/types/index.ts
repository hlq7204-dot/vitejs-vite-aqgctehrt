import type { LucideIcon } from 'lucide-react';

export type CardType = 'standard' | 'choice' | 'tf' | 'typing';

export type CardState = 0 | 1 | 2 | 3; // 0: Novo, 1: Aprendizagem, 2: Revisão, 3: Reaprendizagem

export interface ReviewRatingCounts {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface InteractiveStats {
  attempts: number;
  correct: number;
}

export interface Card {
  id: string;
  type?: CardType;
  front: string;
  back?: string;
  options?: string[];
  correctOption?: number;
  isTrue?: boolean;
  typeAnswer?: string;
  tags?: string[];
  state?: CardState;
  stepIndex?: number;
  difficulty?: number;
  stability?: number;
  interval: number;
  last_review?: number;
  dueDate?: number;
  reviews: number;
  lapses?: number;
  reviewLapses?: number;
  reviewRatingCounts?: ReviewRatingCounts;
  learningReviews?: number;
  interactiveStats?: InteractiveStats;
  buriedUntil?: number | null;
  isSuspended?: boolean;
  isIgnored?: boolean;
  _deckId?: string;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  parentId: string | null;
  color?: string;
  isIgnored?: boolean;
  cards: Card[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
}

export interface ThemeOption {
  id: string;
  label: string;
  color: string;
}

export interface CardTypeOption {
  id: CardType;
  label: string;
  Icon: LucideIcon;
}

export interface CardStats {
  new: number;
  learning: number;
  review: number;
  learned: number;
  suspended: number;
}

export type ActivityMap = Record<string, string[]>;

export interface SessionStats {
  reviewed: number;
  correct: number;
}

export interface ReviewHistoryItem {
  card: Card;
  index: number;
  queue: Card[];
  quality: number;
  sessionStats: SessionStats;
}

export interface CustomStudyConfig {
  sourceType: 'all' | 'folder' | 'deck';
  sourceId: string | null;
  preset: 'cram' | 'leeches' | 'unlearned' | 'new_only' | 'interactive' | 'due_only';
  cardType: string;
  tag: string;
  limit: number;
}

export interface ItemToDelete {
  id: string;
  type: 'folder' | 'deck';
  name: string;
}

export interface ItemToMove {
  id: string;
  type: 'folder' | 'deck';
  name: string;
  parentId: string | null;
}

export interface FolderPathOption {
  id: string | null;
  path: string;
}