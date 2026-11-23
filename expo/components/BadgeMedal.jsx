// A flat badge: a metal ring frame, a black disc, and a sports icon in the same metal. It is what the achievement lists and the Battle Pass
// tiers show; the one on an achievement's own screen (components/AchievementBadge.jsx) is the same badge turning in 3D.
// lib/badgeFrames.js draws the shapes; this only puts them in an Svg.
//
//   frame  one of the eight frame ids (lib/badgeFrames.js FRAME_IDS)
//   metal  'bronze' | 'silver' | 'gold'
//   icon   an id from lib/sportIcons.js
//   size   the badge's width and height in pixels
//   dim    draws it faded, for a badge that has not been earned
import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { BLACK, BLACK_TOP, FRAME_GRID, corePath, getFrame, getMetal, iconPlacement, innerLinePath } from '@/lib/badgeFrames';
import { getSportIcon } from '@/lib/sportIcons';

export const DIM_OPACITY = 0.38;

function MedalArt({ frameId, metalId, iconId }) {
  const frame = getFrame(frameId);
  const metal = getMetal(metalId);
  const icon = getSportIcon(iconId);
  const place = iconPlacement(frame);
  const ring = `bmRing-${metal.id}`;
  const glyph = `bmIcon-${metal.id}`;
  return (
    <>
      <Defs>
        <LinearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={metal.light} />
          <Stop offset="0.5" stopColor={metal.mid} />
          <Stop offset="1" stopColor={metal.dark} />
        </LinearGradient>
        <LinearGradient id={glyph} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={metal.shine} />
          <Stop offset="0.45" stopColor={metal.light} />
          <Stop offset="1" stopColor={metal.mid} />
        </LinearGradient>
        <LinearGradient id="bmCore" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BLACK_TOP} />
          <Stop offset="1" stopColor={BLACK} />
        </LinearGradient>
      </Defs>
      <Path d={frame.outline} fill={`url(#${ring})`} />
      <Path d={corePath(frame)} fill="url(#bmCore)" />
      <Path d={innerLinePath(frame)} fill="none" stroke={metal.light} strokeOpacity={0.5} strokeWidth={0.8} />
      {frame.marks.map((mark, i) => {
        if (mark.kind === 'groove') return <Path key={i} d={mark.d} fill="none" stroke={BLACK} strokeWidth={mark.width} strokeLinecap="round" />;
        return <Path key={i} d={mark.d} fill={mark.kind === 'gem' ? metal.light : BLACK} />;
      })}
      {icon ? (
        <G transform={place.transform}>
          <Path d={icon.d} transform="translate(1.2 1.6)" fill="#000000" fillOpacity={0.6} fillRule="evenodd" />
          <Path d={icon.d} fill={`url(#${glyph})`} fillRule="evenodd" />
        </G>
      ) : null}
    </>
  );
}

function BadgeMedal({ frame, metal, icon, size = 64, dim = false, testID }) {
  return (
    <View style={{ width: size, height: size, opacity: dim ? DIM_OPACITY : 1 }} testID={testID} pointerEvents="none">
      <Svg width={size} height={size} viewBox={`0 0 ${FRAME_GRID} ${FRAME_GRID}`}>
        <MedalArt frameId={frame} metalId={metal} iconId={icon} />
      </Svg>
    </View>
  );
}

export default memo(BadgeMedal);
