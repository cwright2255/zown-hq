// The badge on an achievement's screen: a gold-rimmed black shield with the achievement's icon on it, which turns in 3D about its vertical
// axis. lib/achievementBadge.js has the maths and explains how: the thickness is a stack of slices, and the turn is two numbers per
// slice read off a table for the angle. It draws no more than that; the parent (app/achievement/[id].jsx) decides when and how far it
// turns, by moving `theta`, and when it lights up, by moving `lit`.
//
//   theta  an Animated.Value, in degrees. 0 faces the viewer; 180 shows the back (the ZOWN mark). Any number is fine (3 turns is 1080).
//   lit    an Animated.Value from 0 (dim, as a badge that has not been earned looks) to 1 (shining).
//   bob    optional, an Animated.Value from 0 to 1: the float up and down, with the shadow following it.
import React, { useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  RIM_DARK, RIM_LIGHT, badgeSize, faceScaleTable, faceVisibleTable, glossTable, layerDepths, shadowScaleTable, shieldPath, shiftTable,
  sliceColor, sliceScaleTable, sliceThickness, spineScaleTable,
} from '@/lib/achievementBadge';

export const UNLIT_OPACITY = 0.3; // how dim the badge is before it lights up, and for good when it has not been earned
const FLOAT_PX = 8; // how far the badge floats up
const SHADOW_ROOM = 34; // the space under the badge for its shadow

// Gradients are named once; every badge draws the same ones.
function FaceArt({ width, height }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="zbRim" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF3B0" />
          <Stop offset="0.5" stopColor="#FFD700" />
          <Stop offset="1" stopColor="#A87400" />
        </LinearGradient>
        <LinearGradient id="zbFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A2A2A" />
          <Stop offset="1" stopColor="#050505" />
        </LinearGradient>
      </Defs>
      <Path d={shieldPath(width, height, 0)} fill="url(#zbRim)" />
      <Path d={shieldPath(width, height, 0.07)} fill="url(#zbFace)" />
      <Path d={shieldPath(width, height, 0.115)} fill="none" stroke="#FFD700" strokeOpacity={0.55} strokeWidth={1.5} />
    </Svg>
  );
}

// The pale diagonal band that makes the face look polished. Its strength is moved with the angle by the parent view's opacity.
function GlossArt({ width, height }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="zbGloss" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={shieldPath(width, height, 0.07)} fill="url(#zbGloss)" />
    </Svg>
  );
}

// The full-height rectangle in the middle of the rim (see lib/achievementBadge.js spineScaleTable), shaded from the back's dark gold to the
// front's light gold across its width, like the slices around it.
function SpineArt({ width, height }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="zbSpine" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={RIM_DARK} />
          <Stop offset="1" stopColor={RIM_LIGHT} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#zbSpine)" />
    </Svg>
  );
}

// The badge's shadow on the ground: a soft gold ellipse, brightest in the middle.
function ShadowArt({ width, height }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="zbShadow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFD700" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#FFD700" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#zbShadow)" />
    </Svg>
  );
}

function SliceArt({ width, height, color }) {
  return (
    <Svg width={width} height={height}>
      <Path d={shieldPath(width, height, 0)} fill={color} />
    </Svg>
  );
}

export default function AchievementBadge({ icon, size = 200, theta, lit, bob, locked = false }) {
  const { width, height, depth } = badgeSize(size);

  // Every number the animation moves is read off the angle (0 to 360) with Animated's own interpolate, so it all runs without the
  // JavaScript thread once it has started.
  const rig = useMemo(() => {
    const angle = Animated.modulo(theta, 360);
    const read = (t) => angle.interpolate({ inputRange: t.input, outputRange: t.output, extrapolate: 'clamp' });
    const thickness = sliceThickness(depth);
    const sliceScale = read(sliceScaleTable(thickness, width));
    return {
      slices: layerDepths(depth).map((z, i, all) => ({
        key: i,
        color: sliceColor(i, all.length),
        translateX: read(shiftTable(z)),
        scaleX: sliceScale,
      })),
      front: {
        translateX: read(shiftTable(depth / 2)),
        scaleX: read(faceScaleTable(true)),
        opacity: read(faceVisibleTable(true)),
        gloss: read(glossTable(true)),
      },
      back: {
        translateX: read(shiftTable(-depth / 2)),
        scaleX: read(faceScaleTable(false)),
        opacity: read(faceVisibleTable(false)),
        gloss: read(glossTable(false)),
      },
      spineScale: read(spineScaleTable()),
      shadowScale: read(shadowScaleTable(depth, width)),
    };
  }, [theta, width, depth]);

  const groupOpacity = lit.interpolate({ inputRange: [0, 1], outputRange: [UNLIT_OPACITY, 1] });
  const groupScale = lit.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const lift = bob ? bob.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_PX] }) : 0;
  const shadowFade = bob ? bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) : 1;
  const absolute = { position: 'absolute', left: 0, top: 0, width, height };
  const iconSize = Math.round(width * 0.34);

  return (
    <View style={{ width, height: height + SHADOW_ROOM }} pointerEvents="none" testID="achievement-badge">
      <Animated.View
        style={[styles.shadow, { top: height - 6, width: width * 0.9, left: width * 0.05, opacity: Animated.multiply(groupOpacity, shadowFade), transform: [{ scaleX: rig.shadowScale }] }]}
        testID="badge-shadow"
      >
        <ShadowArt width={width * 0.9} height={SHADOW_ROOM} />
      </Animated.View>

      <Animated.View
        testID="badge-group"
        needsOffscreenAlphaCompositing
        style={[absolute, { opacity: groupOpacity, transform: [{ translateY: lift }, { scale: groupScale }] }]}
      >
        {rig.slices.map((slice) => (
          <Animated.View
            key={slice.key}
            testID={`badge-slice-${slice.key}`}
            style={[absolute, { transform: [{ translateX: slice.translateX }, { scaleX: slice.scaleX }] }]}
          >
            <SliceArt width={width} height={height} color={slice.color} />
          </Animated.View>
        ))}

        <Animated.View
          testID="badge-spine"
          style={[absolute, { left: (width - depth) / 2, width: depth, transform: [{ scaleX: rig.spineScale }] }]}
        >
          <SpineArt width={depth} height={height} />
        </Animated.View>

        <Animated.View
          testID="badge-front"
          style={[absolute, { opacity: rig.front.opacity, transform: [{ translateX: rig.front.translateX }, { scaleX: rig.front.scaleX }] }]}
        >
          <FaceArt width={width} height={height} />
          <Animated.View style={[absolute, { opacity: rig.front.gloss }]}>
            <GlossArt width={width} height={height} />
          </Animated.View>
          <View style={[absolute, styles.center, { paddingBottom: height * 0.06 }]}>
            <Text style={{ fontSize: iconSize, lineHeight: Math.round(iconSize * 1.2) }} allowFontScaling={false}>{icon}</Text>
          </View>
          {locked ? (
            <View style={[styles.lock, { top: height * 0.7, left: width / 2 - width * 0.085, width: width * 0.17, height: width * 0.17, borderRadius: width * 0.085 }]}>
              <Ionicons name="lock-closed" size={Math.round(width * 0.09)} color="#FFD700" />
            </View>
          ) : null}
        </Animated.View>

        <Animated.View
          testID="badge-back"
          style={[absolute, { opacity: rig.back.opacity, transform: [{ translateX: rig.back.translateX }, { scaleX: rig.back.scaleX }] }]}
        >
          <FaceArt width={width} height={height} />
          <Animated.View style={[absolute, { opacity: rig.back.gloss }]}>
            <GlossArt width={width} height={height} />
          </Animated.View>
          <View style={[absolute, styles.center, { paddingBottom: height * 0.06 }]}>
            <Text style={[styles.mark, { fontSize: Math.round(width * 0.2) }]} allowFontScaling={false}>ZOWN</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  shadow: { position: 'absolute', height: SHADOW_ROOM },
  lock: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: RIM_LIGHT },
  mark: { fontWeight: '900', fontStyle: 'italic', letterSpacing: 2, color: RIM_LIGHT },
});
