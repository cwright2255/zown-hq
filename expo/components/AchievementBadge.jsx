// The badge on an achievement's screen: a bronze, silver or gold ring frame with a black disc and the achievement's sports icon in the same
// metal, which turns in 3D about its vertical axis. lib/achievementBadge.js has the maths and explains how: the thickness is a stack of
// slices cut to the frame's outline, and the turn is two numbers per slice read off a table for the angle. The icon on the front and the Z
// of the Zown logo on the back stand out of their faces (each as a short stack of layers, the relief, with the shadow it throws on the
// face under it), so they seem to rise from the face as the badge turns. It draws no more than that; the parent
// (app/achievement/[id].jsx) decides when and how far it turns, by moving `theta`, and when it lights up, by moving `lit`.
//
//   frame, metal, icon   which badge it is: a frame id, 'bronze' | 'silver' | 'gold', and a sports icon id (the same as components/BadgeMedal.jsx)
//   theta  an Animated.Value, in degrees. 0 faces the viewer; 180 shows the back (the Z). Any number is fine (3 turns is 1080).
//   lit    an Animated.Value from 0 (dim, as a badge that has not been earned looks) to 1 (shining).
//   bob    optional, an Animated.Value from 0 to 1: the float up and down, with the shadow following it.
import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  badgeSize, faceScaleTable, faceVisibleTable, glossTable, iconBox, layerDepths, reliefLayers, reliefShiftTable, shadowScaleTable,
  shiftTable, sliceColor, sliceScaleTable, sliceThickness, spineBox, spineScaleTable, zMarkBox,
} from '@/lib/achievementBadge';
import { BLACK, BLACK_TOP, FRAME_GRID, corePath, getFrame, getMetal, innerLinePath } from '@/lib/badgeFrames';
import { getSportIcon } from '@/lib/sportIcons';
import { Z_MARK_HEIGHT, Z_MARK_PATH, Z_MARK_WIDTH } from '@/lib/zownMark';

export const UNLIT_OPACITY = 0.3; // how dim the badge is before it lights up, and for good when it has not been earned
const FLOAT_PX = 8; // how far the badge floats up
const SHADOW_ROOM = 34; // the space under the badge for its shadow
const GRID = `0 0 ${FRAME_GRID} ${FRAME_GRID}`;

// Gradients are named once per metal; every badge of a metal draws the same ones.
function FaceArt({ width, height, frame, metal }) {
  return (
    <Svg width={width} height={height} viewBox={GRID}>
      <Defs>
        <LinearGradient id={`zbRing-${metal.id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={metal.light} />
          <Stop offset="0.5" stopColor={metal.mid} />
          <Stop offset="1" stopColor={metal.dark} />
        </LinearGradient>
        <LinearGradient id="zbCore" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BLACK_TOP} />
          <Stop offset="1" stopColor={BLACK} />
        </LinearGradient>
      </Defs>
      <Path d={frame.outline} fill={`url(#zbRing-${metal.id})`} />
      <Path d={corePath(frame)} fill="url(#zbCore)" />
      <Path d={innerLinePath(frame)} fill="none" stroke={metal.light} strokeOpacity={0.5} strokeWidth={0.8} />
      {frame.marks.map((mark, i) => {
        if (mark.kind === 'groove') return <Path key={i} d={mark.d} fill="none" stroke={BLACK} strokeWidth={mark.width} strokeLinecap="round" />;
        return <Path key={i} d={mark.d} fill={mark.kind === 'gem' ? metal.light : BLACK} />;
      })}
    </Svg>
  );
}

// The pale diagonal band that makes the face look polished. Its strength is moved with the angle by the parent view's opacity.
function GlossArt({ width, height, frame }) {
  return (
    <Svg width={width} height={height} viewBox={GRID}>
      <Defs>
        <LinearGradient id="zbGloss" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity={0.55} />
          <Stop offset="0.52" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={corePath(frame)} fill="url(#zbGloss)" />
    </Svg>
  );
}

// The full-height rectangle in the middle of the rim (see lib/achievementBadge.js spineScaleTable), shaded from the back's dark metal to the
// front's light metal across its width, like the slices around it.
function SpineArt({ width, height, metal }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`zbSpine-${metal.id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={metal.rimDark} />
          <Stop offset="1" stopColor={metal.rimLight} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#zbSpine-${metal.id})`} />
    </Svg>
  );
}

// The badge's shadow on the ground: a soft ellipse in the metal, brightest in the middle.
function ShadowArt({ width, height, metal }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={`zbShadow-${metal.id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={metal.mid} stopOpacity={0.4} />
          <Stop offset="1" stopColor={metal.mid} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#zbShadow-${metal.id})`} />
    </Svg>
  );
}

function SliceArt({ width, height, frame, color }) {
  return (
    <Svg width={width} height={height} viewBox={GRID}>
      <Path d={frame.outline} fill={color} />
    </Svg>
  );
}

// ---- the relief ------------------------------------------------------------------------------------------------------------------
// The icon and the Z are each drawn in a box of their own shape plus this much on every side (in their own units), so the lit and shaded
// edges of the top are not cut off at the box.
const Z_PAD = 24;
const Z_VIEW = `${-Z_PAD} ${-Z_PAD} ${Z_MARK_WIDTH + 2 * Z_PAD} ${Z_MARK_HEIGHT + 2 * Z_PAD}`;
const ICON_PAD = 6;
const ICON_VIEW = `${-ICON_PAD} ${-ICON_PAD} ${FRAME_GRID + 2 * ICON_PAD} ${FRAME_GRID + 2 * ICON_PAD}`;
const EDGE_PX = 1.1; // how far the lit and shaded edges of a top are from the top itself

// One layer of the icon or the Z. The top has a pale edge on the top left, a dark one on the bottom right and a face of the metal, which is
// what makes it look pressed up and bevelled; a wall or a shadow is the plain shape in one colour.
function ReliefArt({ d, viewBox, width, height, unit, kind, color, alpha, metal, fillRule }) {
  const edge = EDGE_PX / unit;
  const grad = `zbTop-${metal.id}`;
  return (
    <Svg width={width} height={height} viewBox={viewBox}>
      {kind === 'top' ? (
        <>
          <Defs>
            <LinearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={metal.shine} />
              <Stop offset="0.38" stopColor={metal.light} />
              <Stop offset="0.6" stopColor={metal.mid} />
              <Stop offset="1" stopColor={metal.dark} />
            </LinearGradient>
          </Defs>
          <Path d={d} fill={metal.wallDark} fillOpacity={0.95} fillRule={fillRule} transform={`translate(${edge} ${edge})`} />
          <Path d={d} fill={metal.shine} fillRule={fillRule} transform={`translate(${-edge} ${-edge})`} />
          <Path d={d} fill={`url(#${grad})`} fillRule={fillRule} />
        </>
      ) : (
        <Path d={d} fill={kind === 'shadow' ? '#000000' : color} fillOpacity={kind === 'shadow' ? alpha : 1} fillRule={fillRule} />
      )}
    </Svg>
  );
}

export default function AchievementBadge({ frame: frameId, metal: metalId = 'gold', icon, size = 200, theta, lit, bob, locked = false }) {
  const { width, height, depth } = badgeSize(size);
  const frame = getFrame(frameId);
  const metal = getMetal(metalId);
  const sportIcon = getSportIcon(icon);

  // Every number the animation moves is read off the angle (0 to 360) with Animated's own interpolate, so it all runs without the
  // JavaScript thread once it has started.
  const rig = useMemo(() => {
    const angle = Animated.modulo(theta, 360);
    const read = (t) => angle.interpolate({ inputRange: t.input, outputRange: t.output, extrapolate: 'clamp' });
    const thickness = sliceThickness(depth);
    const sliceScale = read(sliceScaleTable(thickness, width));
    const reliefOf = (front) => reliefLayers(width, height, depth, front, metal.id).map((layer) => ({ ...layer, translateX: read(reliefShiftTable(layer.z, layer.leanX)) }));
    return {
      slices: layerDepths(depth).map((z, i, all) => ({
        key: i,
        color: sliceColor(i, all.length, metal.id),
        translateX: read(shiftTable(z)),
        scaleX: sliceScale,
      })),
      front: {
        translateX: read(shiftTable(depth / 2)),
        scaleX: read(faceScaleTable(true)),
        opacity: read(faceVisibleTable(true)),
        gloss: read(glossTable(true)),
        relief: reliefOf(true),
      },
      back: {
        translateX: read(shiftTable(-depth / 2)),
        scaleX: read(faceScaleTable(false)),
        opacity: read(faceVisibleTable(false)),
        gloss: read(glossTable(false)),
        relief: reliefOf(false),
      },
      spineScale: read(spineScaleTable()),
      shadowScale: read(shadowScaleTable(depth, width)),
    };
  }, [theta, width, height, depth, metal.id]);

  const groupOpacity = lit.interpolate({ inputRange: [0, 1], outputRange: [UNLIT_OPACITY, 1] });
  const groupScale = lit.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const lift = bob ? bob.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_PX] }) : 0;
  const shadowFade = bob ? bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) : 1;
  const absolute = { position: 'absolute', left: 0, top: 0, width, height };
  const iconPlace = iconBox(width, height, frame.id);
  const zMark = zMarkBox(width, height, frame.id);
  const spine = spineBox(height, frame.id);

  // What a relief layer draws, and where: a box centred across the badge (so it narrows about the badge's middle, like the faces do) and,
  // up and down, on the middle of the icon or the Z.
  const artOf = (front) => {
    if (front) {
      const unit = iconPlace.size / FRAME_GRID;
      const w = (FRAME_GRID + 2 * ICON_PAD) * unit;
      return { d: sportIcon ? sportIcon.d : '', viewBox: ICON_VIEW, unit, width: w, height: w, cy: iconPlace.cy, fillRule: 'evenodd' };
    }
    const unit = zMark.width / Z_MARK_WIDTH;
    return { d: Z_MARK_PATH, viewBox: Z_VIEW, unit, width: (Z_MARK_WIDTH + 2 * Z_PAD) * unit, height: (Z_MARK_HEIGHT + 2 * Z_PAD) * unit, cy: zMark.cy, fillRule: 'nonzero' };
  };

  const renderRelief = (face, front) => {
    const art = artOf(front);
    if (!art.d) return null;
    return face.relief.map((layer) => (
      <Animated.View
        key={layer.key}
        testID={`badge-${front ? 'front' : 'back'}-relief-${layer.key}`}
        style={{ position: 'absolute', left: (width - art.width) / 2, top: art.cy - art.height / 2 + layer.leanY, width: art.width, height: art.height, opacity: face.opacity, transform: [{ translateX: layer.translateX }, { scaleX: face.scaleX }] }}
      >
        <ReliefArt d={art.d} viewBox={art.viewBox} width={art.width} height={art.height} unit={art.unit} kind={layer.kind} color={layer.color} alpha={layer.alpha} metal={metal} fillRule={art.fillRule} />
      </Animated.View>
    ));
  };

  const chip = Math.round(width * 0.2);

  return (
    <View style={{ width, height: height + SHADOW_ROOM }} pointerEvents="none" testID="achievement-badge">
      <Animated.View
        style={[styles.shadow, { top: height - 6, width: width * 0.9, left: width * 0.05, opacity: Animated.multiply(groupOpacity, shadowFade), transform: [{ scaleX: rig.shadowScale }] }]}
        testID="badge-shadow"
      >
        <ShadowArt width={width * 0.9} height={SHADOW_ROOM} metal={metal} />
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
            <SliceArt width={width} height={height} frame={frame} color={slice.color} />
          </Animated.View>
        ))}

        <Animated.View
          testID="badge-spine"
          style={[absolute, { left: (width - depth) / 2, top: spine.top, width: depth, height: spine.height, transform: [{ scaleX: rig.spineScale }] }]}
        >
          <SpineArt width={depth} height={spine.height} metal={metal} />
        </Animated.View>

        <Animated.View
          testID="badge-front"
          style={[absolute, { opacity: rig.front.opacity, transform: [{ translateX: rig.front.translateX }, { scaleX: rig.front.scaleX }] }]}
        >
          <FaceArt width={width} height={height} frame={frame} metal={metal} />
          <Animated.View style={[absolute, { opacity: rig.front.gloss }]}>
            <GlossArt width={width} height={height} frame={frame} />
          </Animated.View>
          {locked ? (
            <View style={[styles.lock, { borderColor: metal.light, top: height * 0.66, left: width * 0.66, width: chip, height: chip, borderRadius: chip / 2 }]}>
              <Ionicons name="lock-closed" size={Math.round(width * 0.1)} color={metal.light} />
            </View>
          ) : null}
        </Animated.View>
        {renderRelief(rig.front, true)}

        <Animated.View
          testID="badge-back"
          style={[absolute, { opacity: rig.back.opacity, transform: [{ translateX: rig.back.translateX }, { scaleX: rig.back.scaleX }] }]}
        >
          <FaceArt width={width} height={height} frame={frame} metal={metal} />
          <Animated.View style={[absolute, { opacity: rig.back.gloss }]}>
            <GlossArt width={width} height={height} frame={frame} />
          </Animated.View>
        </Animated.View>
        {renderRelief(rig.back, false)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', height: SHADOW_ROOM },
  lock: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1 },
});
