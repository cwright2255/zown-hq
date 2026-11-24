// components/ProgressMonthCard.jsx
//
// The month on the Progress tab: this month's workouts, runs and calories against last month's, the person's level and what is left to the
// next one (it replaces the XP box, which only repeated a total), and a bar chart of the last six months. The bars are plain views in the
// style of the Fasting chart (black for this month, grey for the months before, hairline grid, quiet numbers). The numbers come from
// lib/progressInsights.js monthlyTotals; this file only draws.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { bestMonth, niceMax, versusLastMonth } from '../lib/progressInsights';
import { GOOD, INK, MID, QUIET, WORSE, p } from './progressStyles';

const GUTTER = 34;
const PLOT_HEIGHT = 110;
const LABEL_ROOM = 22;
const VALUE_ROOM = 16; // above the tallest bar, for its number
const SHORT = '#B5B5B5';
const MEASURES = [
  { key: 'sessions', label: 'Sessions', noun: ['session', 'sessions'] },
  { key: 'calories', label: 'Calories', noun: ['calorie', 'calories'] },
];

const trim = (n) => String(Math.round(n * 10) / 10);
/** 950, 1.5k, 12k: a number short enough for the narrow column at the left of the chart. */
export function compact(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${trim(n / 1000)}k`;
  return String(n);
}

/** Where every bar goes for a plot `width` wide: { x, w, h, top, center }. `max` is the top of the scale. */
export function barLayout(values, max, width, height = PLOT_HEIGHT) {
  const plotW = Math.max(0, width - GUTTER);
  const slot = values.length ? plotW / values.length : 0;
  const barW = Math.max(6, Math.min(34, slot * 0.58));
  return values.map((value, i) => {
    const h = value > 0 ? Math.max(3, Math.min(height, (value / max) * height)) : 0;
    return { x: GUTTER + i * slot + (slot - barW) / 2, w: barW, h, top: VALUE_ROOM + height - h, center: GUTTER + i * slot + slot / 2 };
  });
}

function Tile({ id, value, label, line, delta }) {
  const color = delta === undefined || delta === 0 ? QUIET : delta > 0 ? GOOD : WORSE;
  return (
    <View style={s.tile} accessible accessibilityLabel={`${label}: ${value}. ${line}`}>
      <Text testID={`month-${id}`} style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      <Text testID={`month-${id}-line`} style={[s.tileLine, { color }]}>{line}</Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {Array} props.totals       lib/progressInsights.js monthlyTotals: six months, oldest first, this month last
 * @param {string} props.monthName   "November"
 * @param {number} props.level
 * @param {string} props.levelLine   "1,245 XP to Level 25"
 */
export default function ProgressMonthCard({ totals, monthName, level, levelLine }) {
  const [measure, setMeasure] = useState('sessions');
  const [width, setWidth] = useState(280);
  const now = totals[totals.length - 1];
  const before = totals.length > 1 ? totals[totals.length - 2] : { workouts: 0, runs: 0, calories: 0 };
  const picked = MEASURES.find((m) => m.key === measure);
  const values = totals.map((b) => b[measure]);
  const max = niceMax(Math.max(0, ...values));
  const bars = barLayout(values, max, width);
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const best = bestMonth(totals, measure);
  const summary = `${picked.label} by month: ${totals.map((b) => `${b.label} ${b[measure]}`).join(', ')}.`;

  return (
    <View testID="progress-month">
      <View style={p.sectionRow}><Text style={p.sectionTitle}>{`${monthName} Summary`}</Text></View>
      <View style={[p.card, s.tiles]}>
        <Tile id="workouts" value={String(now.workouts)} label="Workouts" line={versusLastMonth(now.workouts, before.workouts)} delta={now.workouts - before.workouts} />
        <Tile id="runs" value={String(now.runs)} label="Runs" line={versusLastMonth(now.runs, before.runs)} delta={now.runs - before.runs} />
        <Tile id="calories" value={now.calories.toLocaleString('en-US')} label="Calories" line={versusLastMonth(now.calories, before.calories)} delta={now.calories - before.calories} />
        <Tile id="level" value={String(level)} label="Level" line={levelLine} />
      </View>

      <View style={p.sectionRow}><Text style={p.sectionTitle}>Last 6 Months</Text></View>
      <View style={p.card}>
        <View style={[p.chipRow, s.chips]}>
          {MEASURES.map((m) => {
            const on = m.key === measure;
            return (
              <Pressable
                key={m.key}
                testID={`month-measure-${m.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[p.chip, on && p.chipOn]}
                onPress={() => setMeasure(m.key)}
              >
                <Text style={[p.chipText, on && p.chipTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View onLayout={(e) => setWidth(Math.max(200, Math.round(e.nativeEvent.layout.width)))}>
          <View testID="month-chart" accessible accessibilityRole="image" accessibilityLabel={summary} style={{ width, height: PLOT_HEIGHT + VALUE_ROOM + LABEL_ROOM }}>
            {ticks.map((t) => {
              const y = VALUE_ROOM + PLOT_HEIGHT - (t / max) * PLOT_HEIGHT;
              return (
                <React.Fragment key={t}>
                  <View style={[s.grid, { left: GUTTER, width: width - GUTTER, top: y }]} />
                  <Text testID={`month-tick-${t}`} style={[s.tick, { top: y - 7 }]}>{compact(t)}</Text>
                </React.Fragment>
              );
            })}
            {totals.map((b, i) => {
              const bar = bars[i];
              return (
                <React.Fragment key={b.key}>
                  {bar.h > 0 ? (
                    <>
                      <View testID={`month-bar-${i}`} style={[s.bar, { left: bar.x, width: bar.w, height: bar.h, top: bar.top }, b.current ? s.barNow : s.barBefore]} />
                      <Text testID={`month-value-${i}`} style={[s.value, { left: bar.center - 20, top: bar.top - 14 }]}>{compact(values[i])}</Text>
                    </>
                  ) : null}
                  <Text testID={`month-label-${i}`} style={[s.label, b.current && s.labelNow, { left: bar.center - 20, top: VALUE_ROOM + PLOT_HEIGHT + 6 }]}>{b.label}</Text>
                </React.Fragment>
              );
            })}
          </View>
        </View>
        <Text testID="month-best" style={s.best}>
          {best
            ? `Best month: ${best.label} · ${best[measure].toLocaleString('en-US')} ${picked.noun[best[measure] === 1 ? 0 : 1]}`
            : `No ${picked.noun[1]} in the last 6 months yet.`}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 },
  tile: { width: '50%', paddingVertical: 8, alignItems: 'center' },
  tileValue: { fontSize: 22, fontWeight: '800', color: INK },
  tileLabel: { fontSize: 11, color: QUIET, marginTop: 2 },
  tileLine: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  chips: { marginBottom: 12 },
  grid: { position: 'absolute', height: StyleSheet.hairlineWidth, backgroundColor: '#E2E2E2' },
  tick: { position: 'absolute', left: 0, width: GUTTER - 6, textAlign: 'right', fontSize: 10, color: '#8A8A8A' },
  bar: { position: 'absolute', borderRadius: 3 },
  barNow: { backgroundColor: INK },
  barBefore: { backgroundColor: SHORT },
  value: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 10, color: MID },
  label: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 10, color: '#8A8A8A' },
  labelNow: { color: INK, fontWeight: '700' },
  best: { fontSize: 12, color: MID, marginTop: 8 },
});
