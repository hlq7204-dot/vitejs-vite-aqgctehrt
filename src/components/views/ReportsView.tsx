import React from 'react';
import {
  TrendingUp,
  Filter,
  BarChart2,
  Target,
  CalendarDays,
  PieChart,
} from 'lucide-react';
import type { ActivityMap, Card, Deck } from '../../types';
import { forgetting_curve, getCardRatingBreakdown } from '../../utils/fsrs';

interface ReportsViewProps {
  validDecks: Deck[];
  activityMap: ActivityMap;
  reportPeriod: string;
  setReportPeriod: (period: string) => void;
  reportDeckId: string;
  setReportDeckId: (deckId: string) => void;
  desiredRetention: number;
  getDailyCountFiltered: (dateStr: string, deckId: string) => number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  validDecks,
  activityMap,
  reportPeriod,
  setReportPeriod,
  reportDeckId,
  setReportDeckId,
  desiredRetention,
  getDailyCountFiltered,
}) => {
  let daysCount = 7;
  const days: Date[] = [];
  const today = new Date();

  if (reportPeriod === 'all') {
    const dates = Object.keys(activityMap).sort();
    if (dates.length > 0) {
      const firstDate = new Date(dates[0] + 'T12:00:00');
      const diffTime = Math.abs(today.getTime() - firstDate.getTime());
      daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(firstDate);
        d.setDate(firstDate.getDate() + i);
        days.push(d);
      }
    } else {
      days.push(today);
      daysCount = 1;
    }
  } else {
    daysCount = reportPeriod === 'week' ? 7 : 30;
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
  }

  let totalReviewsPeriod = 0;
  const activityData = days.map((d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dy}`;
    const count = getDailyCountFiltered(dateStr, reportDeckId);
    totalReviewsPeriod += count;
    return {
      label:
        reportPeriod === 'week'
          ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
          : `${dy}/${m}`,
      count,
      date: d,
    };
  });

  let targetCards: Card[] = [];
  if (reportDeckId === 'all') {
    targetCards = validDecks
      .filter((d) => !d.isIgnored)
      .flatMap((d) => d.cards || []);
  } else {
    const deck = validDecks.find((d) => d.id === reportDeckId);
    if (deck && !deck.isIgnored) targetCards = deck.cards || [];
  }

  let totalR = 0;
  let revCardsCount = 0;
  const retentionBuckets = { exc: 0, good: 0, fair: 0, poor: 0 };
  let matureCount = 0;
  const now = Date.now();

  let totalStabilitySum = 0;
  let maxStabilityDays = 0;
  let stabilityCardsCount = 0;

  let totalDifficultySum = 0;
  const difficultyBuckets = { easy: 0, mod: 0, hard: 0, extreme: 0 };
  let difficultyCardsCount = 0;

  const periodStartMs = reportPeriod === 'all' ? 0 : now - daysCount * 86400000;
  const periodRatedCards = targetCards.filter(
    (c) => (c.reviews || 0) > 0 && (!c.last_review || c.last_review >= periodStartMs)
  );
  const cardsForRatings =
    periodRatedCards.length > 0
      ? periodRatedCards
      : targetCards.filter((c) => (c.reviews || 0) > 0);

  const buttonTotals = { again: 0, hard: 0, good: 0, easy: 0 };
  let interactiveAttemptsTotal = 0;
  let interactiveCorrectTotal = 0;

  cardsForRatings.forEach((c) => {
    const breakdown = getCardRatingBreakdown(c);
    buttonTotals.again += breakdown.again;
    buttonTotals.hard += breakdown.hard;
    buttonTotals.good += breakdown.good;
    buttonTotals.easy += breakdown.easy;

    if (c.interactiveStats) {
      interactiveAttemptsTotal += c.interactiveStats.attempts || 0;
      interactiveCorrectTotal += c.interactiveStats.correct || 0;
    }
  });

  targetCards.forEach((c) => {
    if (c.isSuspended) return;
    const state = c.state !== undefined ? c.state : c.reviews > 0 ? 2 : 0;

    if (c.stability && (c.reviews || 0) > 0) {
      const sVal = Number(c.stability);
      totalStabilitySum += sVal;
      if (sVal > maxStabilityDays) maxStabilityDays = sVal;
      stabilityCardsCount++;
    }

    if (c.difficulty !== undefined && (c.reviews || 0) > 0) {
      difficultyCardsCount++;
      const d = Number(c.difficulty);
      totalDifficultySum += d;
      if (d < 3.5) difficultyBuckets.easy++;
      else if (d < 6.5) difficultyBuckets.mod++;
      else if (d < 8.5) difficultyBuckets.hard++;
      else difficultyBuckets.extreme++;
    }

    if (state === 2 && c.stability) {
      revCardsCount++;
      const elapsed = Math.max((now - (c.last_review || now)) / 86400000, 0);
      const r = forgetting_curve(elapsed, c.stability);
      totalR += r;
      if (r >= 0.9) retentionBuckets.exc++;
      else if (r >= 0.8) retentionBuckets.good++;
      else if (r >= 0.7) retentionBuckets.fair++;
      else retentionBuckets.poor++;
      if (c.interval >= 21) matureCount++;
    }
  });

  const avgRetention =
    revCardsCount > 0 ? ((totalR / revCardsCount) * 100).toFixed(1) : 'N/A';
  const totalButtonPresses =
    buttonTotals.again +
    buttonTotals.hard +
    buttonTotals.good +
    buttonTotals.easy;
  const totalPassPresses =
    buttonTotals.hard + buttonTotals.good + buttonTotals.easy;
  const trueRetention =
    totalButtonPresses > 0
      ? ((totalPassPresses / totalButtonPresses) * 100).toFixed(1)
      : 'N/A';
  const avgStabilityDays =
    stabilityCardsCount > 0
      ? Math.round(totalStabilitySum / stabilityCardsCount)
      : 0;
  const avgStabilityExact =
    stabilityCardsCount > 0
      ? (totalStabilitySum / stabilityCardsCount).toFixed(1)
      : '0.0';
  const avgDifficulty =
    difficultyCardsCount > 0
      ? (totalDifficultySum / difficultyCardsCount).toFixed(1)
      : 'N/A';
  const interactiveAccuracyPct =
    interactiveAttemptsTotal > 0
      ? Math.round((interactiveCorrectTotal / interactiveAttemptsTotal) * 100)
      : null;
  const maturePercent =
    targetCards.length > 0
      ? Math.round((matureCount / targetCards.length) * 100)
      : 0;

  let calibrationLabel: string | null = null;
  let calibrationColor = 'text-slate-400 bg-slate-800/80 border-slate-700';
  if (trueRetention !== 'N/A' && avgRetention !== 'N/A') {
    const diff = parseFloat(trueRetention) - parseFloat(avgRetention);
    if (Math.abs(diff) <= 4.0) {
      calibrationLabel = 'Calibrado';
      calibrationColor =
        'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
    } else if (diff > 4.0) {
      calibrationLabel = `+${diff.toFixed(0)}% acima`;
      calibrationColor = 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30';
    } else {
      calibrationLabel = `${diff.toFixed(0)}% abaixo`;
      calibrationColor = 'text-amber-300 bg-amber-500/15 border-amber-500/30';
    }
  }

  const maxActivity = Math.max(...activityData.map((a) => a.count), 5);
  const n = activityData.length;
  const points = activityData.map((data, i) => {
    const showLabel =
      reportPeriod === 'week' ||
      (reportPeriod === 'month' && i % 3 === 0) ||
      (reportPeriod === 'all' &&
        i % Math.max(1, Math.floor(daysCount / 10)) === 0);
    const x = n <= 1 ? 50 : (i / (n - 1)) * 100;
    const y = maxActivity === 0 ? 0 : (data.count / maxActivity) * 75;
    return { ...data, x, y, showLabel };
  });

  const smoothLinePath =
    points.length > 1
      ? `M ${points[0].x} ${100 - points[0].y}` +
        points
          .slice(1)
          .map((p, i) => {
            const p0 = points[i];
            const cpX = (p0.x + p.x) / 2;
            return ` C ${cpX} ${100 - p0.y}, ${cpX} ${100 - p.y}, ${p.x} ${
              100 - p.y
            }`;
          })
          .join('')
      : '';

  return (
    <div className="animate-in fade-in duration-300 pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg">
        <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" /> Desempenho FSRS
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <select
              value={reportDeckId}
              onChange={(e) => setReportDeckId(e.target.value)}
              className="w-full appearance-none bg-slate-950 border border-slate-700 text-slate-300 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
            >
              <option value="all">Todos os Baralhos Ativos</option>
              {validDecks
                .filter((d) => !d.isIgnored)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            <Filter className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex-wrap">
            <button
              onClick={() => setReportPeriod('week')}
              className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                reportPeriod === 'week'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              7 Dias
            </button>
            <div className="w-px bg-slate-700"></div>
            <button
              onClick={() => setReportPeriod('month')}
              className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                reportPeriod === 'month'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              30 Dias
            </button>
            <div className="w-px bg-slate-700"></div>
            <button
              onClick={() => setReportPeriod('all')}
              className={`flex-1 sm:flex-none px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                reportPeriod === 'all'
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              Tudo
            </button>
          </div>
        </div>
      </div>

      {/* TOPO: 4 KPIs LIMPOS E DIRETOS */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-100">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Revisões
          </span>
          <div className="text-3xl sm:text-5xl font-black text-indigo-400 my-2">
            {totalReviewsPeriod}
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {reportPeriod === 'all' ? 'Total acumulado' : `Últimos ${daysCount} dias`}
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Retenção
            </span>
            {calibrationLabel && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${calibrationColor}`}
              >
                {calibrationLabel}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 my-2">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                {trueRetention === 'N/A' ? '--' : `${trueRetention}%`}
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Real
              </span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400">
                {avgRetention === 'N/A' ? '--' : `${avgRetention}%`}
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Curva FSRS
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            Meta configurada: {Math.round(desiredRetention * 100)}%
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              Estabilidade Média
            </span>
            {maxStabilityDays > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Máx: {Math.round(maxStabilityDays)}d
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl sm:text-5xl font-black text-purple-400">
              {avgStabilityDays}
            </span>
            <span className="text-base font-bold text-slate-400">dias</span>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            Duração da memória ({avgStabilityExact}d)
          </span>
        </div>

        <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group animate-pop delay-300">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Cartões Maduros
          </span>
          <div className="flex items-baseline gap-2 my-2">
            <span className="text-3xl sm:text-5xl font-black text-amber-400">
              {maturePercent}%
            </span>
            <span className="text-slate-500 font-bold text-sm">
              / {matureCount}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            Intervalo acima de 21 dias
          </span>
        </div>
      </div>

      {/* MEIO: DIFICULDADE E RESPOSTAS (VISUAL LIMPO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between gap-5 animate-pop delay-300">
          <div className="flex justify-between items-center gap-2">
            <h3 className="text-slate-100 font-bold flex items-center gap-2 text-lg">
              <BarChart2 className="w-5 h-5 text-purple-400" /> Dificuldade
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">
                Média: {avgDifficulty}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {difficultyCardsCount} cartões
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 my-auto">
            {[
              {
                label: 'Fácil (1–3)',
                count: difficultyBuckets.easy,
                color: 'bg-emerald-400',
                text: 'text-emerald-400',
              },
              {
                label: 'Moderado (4–6)',
                count: difficultyBuckets.mod,
                color: 'bg-blue-400',
                text: 'text-blue-400',
              },
              {
                label: 'Difícil (7–8)',
                count: difficultyBuckets.hard,
                color: 'bg-amber-400',
                text: 'text-amber-400',
              },
              {
                label: 'Extremo (9–10)',
                count: difficultyBuckets.extreme,
                color: 'bg-rose-500',
                text: 'text-rose-400',
              },
            ].map((b, idx) => {
              const pct =
                difficultyCardsCount > 0
                  ? Math.round((b.count / difficultyCardsCount) * 100)
                  : 0;
              return (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-300 font-semibold">{b.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {b.count}
                      </span>
                      <span className={`font-black w-10 text-right ${b.text}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full ${b.color} rounded-full transition-all duration-700`}
                      style={{
                        width: `${Math.max(pct, b.count > 0 ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between gap-5 animate-pop delay-300">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-100 font-bold flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-rose-400" /> Respostas
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {totalButtonPresses} avaliações
            </span>
          </div>

          <div className="flex flex-col gap-5 my-auto">
            <div className="w-full flex h-3.5 rounded-full overflow-hidden bg-slate-950 p-0.5 gap-1 border border-slate-800">
              {[
                {
                  count: buttonTotals.again,
                  color: 'bg-rose-500',
                  label: 'Errei',
                },
                {
                  count: buttonTotals.hard,
                  color: 'bg-orange-400',
                  label: 'Difícil',
                },
                {
                  count: buttonTotals.good,
                  color: 'bg-emerald-400',
                  label: 'Bom',
                },
                {
                  count: buttonTotals.easy,
                  color: 'bg-blue-400',
                  label: 'Fácil',
                },
              ].map((btn, i) => {
                const pct =
                  totalButtonPresses > 0
                    ? (btn.count / totalButtonPresses) * 100
                    : 25;
                if (pct <= 0) return null;
                return (
                  <div
                    key={i}
                    title={`${btn.label}: ${btn.count} (${Math.round(pct)}%)`}
                    className={`h-full ${btn.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(pct, 3)}%` }}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Errei',
                  count: buttonTotals.again,
                  text: 'text-rose-400',
                  border: 'border-rose-500/20',
                },
                {
                  label: 'Difícil',
                  count: buttonTotals.hard,
                  text: 'text-orange-400',
                  border: 'border-orange-500/20',
                },
                {
                  label: 'Bom',
                  count: buttonTotals.good,
                  text: 'text-emerald-400',
                  border: 'border-emerald-500/20',
                },
                {
                  label: 'Fácil',
                  count: buttonTotals.easy,
                  text: 'text-blue-400',
                  border: 'border-blue-500/20',
                },
              ].map((item, idx) => {
                const pct =
                  totalButtonPresses > 0
                    ? Math.round((item.count / totalButtonPresses) * 100)
                    : 0;
                return (
                  <div
                    key={idx}
                    className={`bg-slate-950/70 border ${item.border} rounded-2xl p-3.5 flex flex-col items-center text-center`}
                  >
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      {item.label}
                    </span>
                    <span className={`text-2xl font-black mt-1 ${item.text}`}>
                      {pct}%
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>

            {interactiveAccuracyPct !== null && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Acerto em Questões Interativas
                </span>
                <span className="text-xs font-black text-indigo-400">
                  {interactiveAccuracyPct}% ({interactiveCorrectTotal}/
                  {interactiveAttemptsTotal})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BASE: HISTÓRICO DE VOLUME & SAÚDE DA MEMÓRIA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col min-h-[320px] animate-pop delay-400">
          <h3 className="text-slate-100 font-bold flex items-center gap-2 text-lg mb-4">
            <CalendarDays className="w-5 h-5 text-blue-400" /> Histórico de
            Volume
          </h3>

          <div className="flex-grow w-full chart-scroll-container overflow-x-auto relative pb-2 px-4 sm:px-6">
            <div
              className="relative h-full min-h-[230px]"
              style={{
                minWidth:
                  reportPeriod === 'all'
                    ? `${Math.max(100, points.length * 30)}px`
                    : '100%',
              }}
            >
              <div className="absolute inset-x-2 top-14 bottom-[30px]">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient
                      id="line-gradient"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
                      <stop
                        offset="100%"
                        stopColor="#818cf8"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>
                  {points.length > 1 ? (
                    <>
                      <path
                        d={`${smoothLinePath} L 100 100 L 0 100 Z`}
                        fill="url(#line-gradient)"
                      />
                      <path
                        d={smoothLinePath}
                        fill="none"
                        stroke="#818cf8"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                      />
                    </>
                  ) : points.length === 1 ? (
                    <circle
                      cx={points[0].x}
                      cy={100 - points[0].y}
                      r="3"
                      fill="#818cf8"
                    />
                  ) : null}
                </svg>

                {points.map((p, i) => (
                  <div
                    key={i}
                    className="absolute flex flex-col items-center group cursor-pointer"
                    style={{
                      left: `${p.x}%`,
                      top: `${100 - p.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10,
                    }}
                  >
                    <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-800 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl pointer-events-none whitespace-nowrap z-20 shadow-xl border border-slate-700 flex flex-col items-center gap-0.5">
                      <span className="text-indigo-300 text-sm">{p.count}</span>
                      <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                        {p.label}
                      </span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800"></div>
                    </div>
                    <div className="w-3 h-3 bg-slate-900 border-2 border-indigo-400 rounded-full transition-all duration-300 group-hover:scale-150 group-hover:bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <div className="absolute -inset-4 z-0"></div>
                  </div>
                ))}
              </div>

              <div className="absolute bottom-0 inset-x-2 h-[24px]">
                {points.map(
                  (p, i) =>
                    p.showLabel && (
                      <span
                        key={`label-${i}`}
                        className="absolute bottom-0 text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap"
                        style={{
                          left: `${p.x}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {p.label}
                      </span>
                    )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-3xl p-6 border border-slate-800 flex flex-col justify-between min-h-[320px] animate-pop delay-400">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-100 font-bold flex items-center gap-2 text-lg">
              <PieChart className="w-5 h-5 text-emerald-400" /> Saúde da Memória
            </h3>
            <span className="text-xs font-bold text-slate-500">
              {revCardsCount} em revisão
            </span>
          </div>
          <div className="flex-grow flex flex-col justify-center gap-4">
            {[
              {
                label: 'Excelente (90–100%)',
                count: retentionBuckets.exc,
                color: 'bg-emerald-400',
                text: 'text-emerald-400',
              },
              {
                label: 'Boa (80–89%)',
                count: retentionBuckets.good,
                color: 'bg-blue-400',
                text: 'text-blue-400',
              },
              {
                label: 'Razoável (70–79%)',
                count: retentionBuckets.fair,
                color: 'bg-amber-400',
                text: 'text-amber-400',
              },
              {
                label: 'Crítica (<70%)',
                count: retentionBuckets.poor,
                color: 'bg-rose-400',
                text: 'text-rose-400',
              },
            ].map((tier, i) => {
              const pct =
                revCardsCount === 0
                  ? 0
                  : Math.round((tier.count / revCardsCount) * 100);
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-300 font-semibold">
                      {tier.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {tier.count}
                      </span>
                      <span className={`font-black w-10 text-right ${tier.text}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full ${tier.color} rounded-full transition-all duration-1000`}
                      style={{
                        width: `${Math.max(pct, tier.count > 0 ? 4 : 0)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};