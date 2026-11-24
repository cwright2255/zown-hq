// components/ProgressWeightChart.jsx
//
// The weight chart on the Progress tab, in the style of the app's other charts (TrendChart, PaceLineChart): a plain black line, grey dots
// for the weigh-ins with a ringed black one for the latest, hairline grid and quiet numbers at the edges. The line is the 7-day trend, so
// it shows the direction and not the day's noise. A dashed green line marks the target. The line is drawn in SVG and the dots are plain
// views, so each one can be found. Everything it draws is worked out by lib/progressInsights.js weightChartModel; this file only scales it.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { monthDay } from '../lib/progressInsights';
import { GOOD, INK } from './progressStyles';

export const GUTTER = 34; // room for the pounds at the left
export const TOP = 8;
export const RIGHT = 8;
export const LABEL_ROOM = 22; // room for the dates underneath
const DOT = 10; // 6px of grey inside a 2px white ring
const DOT_LATEST = 14;
const MAX_DOTS = 30; // with more weigh-ins than this the dots would run together, so only the line and the latest are drawn

/** Where everything goes for a chart `width` x `height`. */
export function chartLayout(model, width, height) {
  const plotW = Math.max(1, width - GUTTER - RIGHT);
  const plotH = Math.max(1, height - TOP - LABEL_ROOM);
  const at = (point) => ({ x: GUTTER + point.x * plotW, y: TOP + point.y * plotH });
  const trend = model.trend.map(at);
  return {
    plotW,
    plotH,
    left: GUTTER,
    right: GUTTER + plotW,
    top: TOP,
    bottom: TOP + plotH,
    middle: TOP + plotH / 2,
    path: trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join(' '),
    dots: model.points.map((point) => ({ id: point.id, lbs: point.lbs, ...at(point) })),
    targetY: model.target ? TOP + model.target.y * plotH : null,
  };
}

/** What a screen reader reads for the chart. */
export function chartSummary(model, now = new Date()) {
  const first = model.points[0];
  const last = model.points[model.points.length - 1];
  const target = model.target ? ` Target ${model.target.lbs} lbs.` : '';
  return `Weight chart. ${first.lbs} lbs on ${monthDay(first.ms, now)}, ${last.lbs} lbs on ${monthDay(last.ms, now)}, ${model.points.length} weigh-ins.${target}`;
}

export default function ProgressWeightChart({ model, width = 300, height = 150, now = new Date() }) {
  if (!model) return null;
  const layout = chartLayout(model, width, height);
  const showDots = layout.dots.length <= MAX_DOTS;
  const latest = layout.dots[layout.dots.length - 1];
  return (
    <View testID="weight-chart" accessible accessibilityRole="image" accessibilityLabel={chartSummary(model, now)} style={{ width, height }}>
      <Svg width={width} height={height} style={s.svg}>
        {[layout.top, layout.middle, layout.bottom].map((y) => (
          <Line key={y} x1={layout.left} x2={layout.right} y1={y} y2={y} stroke="#E2E2E2" strokeWidth={1} />
        ))}
        {layout.targetY !== null ? (
          <Line testID="weight-chart-target" x1={layout.left} x2={layout.right} y1={layout.targetY} y2={layout.targetY} stroke={GOOD} strokeWidth={1.5} strokeDasharray="5,4" />
        ) : null}
        <Path d={layout.path} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>

      <Text style={[s.tick, { top: layout.top - 7 }]}>{model.maxLbs}</Text>
      <Text style={[s.tick, { top: layout.bottom - 7 }]}>{model.minLbs}</Text>
      {layout.targetY !== null ? (
        <Text style={[s.targetLabel, { top: Math.max(0, layout.targetY - 15) }]}>{`Target ${model.target.lbs}`}</Text>
      ) : null}

      {showDots ? layout.dots.slice(0, -1).map((dot, i) => (
        <View key={dot.id || i} testID={`weight-dot-${i}`} style={[s.dot, { width: DOT, height: DOT, borderRadius: DOT / 2, left: dot.x - DOT / 2, top: dot.y - DOT / 2 }]} />
      )) : null}
      <View
        testID="weight-dot-latest"
        style={[s.dot, s.dotLatest, { width: DOT_LATEST, height: DOT_LATEST, borderRadius: DOT_LATEST / 2, left: latest.x - DOT_LATEST / 2, top: latest.y - DOT_LATEST / 2 }]}
      />

      <Text style={[s.date, { left: layout.left, top: layout.bottom + 5 }]}>{monthDay(model.startMs, now)}</Text>
      <Text style={[s.date, { right: RIGHT, top: layout.bottom + 5 }]}>Today</Text>
    </View>
  );
}

const s = StyleSheet.create({
  svg: { position: 'absolute', left: 0, top: 0 },
  tick: { position: 'absolute', left: 0, width: GUTTER - 6, textAlign: 'right', fontSize: 10, color: '#8A8A8A' },
  targetLabel: { position: 'absolute', right: RIGHT, fontSize: 10, fontWeight: '600', color: GOOD },
  dot: { position: 'absolute', backgroundColor: '#B5B5B5', borderWidth: 2, borderColor: '#FFFFFF' },
  dotLatest: { backgroundColor: INK },
  date: { position: 'absolute', fontSize: 11, color: '#8A8A8A' },
});
