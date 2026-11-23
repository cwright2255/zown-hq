// components/BadgeMedal.jsx: the flat badge in the lists: a metal ring frame, a black disc, and a sports icon in the same metal.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import BadgeMedal, { DIM_OPACITY } from '../components/BadgeMedal';
import { BLACK, BLACK_TOP, FRAME_GRID, FRAME_IDS, METAL_IDS, corePath, getFrame, getMetal } from '../lib/badgeFrames';
import { getSportIcon } from '../lib/sportIcons';

const flat = (el) => StyleSheet.flatten(el.props.style) || {};
// Every gradient stop colour the badge draws with, once each.
const stopColours = (utils) => [...new Set(utils.UNSAFE_root.findAll((n) => n.props && typeof n.props.stopColor === 'string').map((n) => n.props.stopColor.toLowerCase()))];

describe('the medal', () => {
  it('is a square of the size it is given, 64 if none is', () => {
    const a = render(<BadgeMedal frame="crest" metal="gold" icon="sp001" size={48} testID="m" />);
    expect(flat(a.getByTestId('m'))).toMatchObject({ width: 48, height: 48 });
    const b = render(<BadgeMedal frame="crest" metal="gold" icon="sp001" testID="m2" />);
    expect(flat(b.getByTestId('m2'))).toMatchObject({ width: 64, height: 64 });
  });

  it('draws on the 100 x 100 grid, whatever its size', () => {
    const utils = render(<BadgeMedal frame="band" metal="silver" icon="sp010" size={72} />);
    const svg = utils.UNSAFE_queryAllByProps({ viewBox: `0 0 ${FRAME_GRID} ${FRAME_GRID}` });
    expect(svg.length).toBeGreaterThan(0);
  });

  it('is not touched: a press goes to what it is in', () => {
    const utils = render(<BadgeMedal frame="band" metal="silver" icon="sp010" testID="m" />);
    expect(utils.getByTestId('m').props.pointerEvents).toBe('none');
  });
});

describe('the drawing', () => {
  it.each(FRAME_IDS.flatMap((frame) => METAL_IDS.map((metal) => [frame, metal])))('draws the %s frame in %s: its outline, the black disc and the icon', (frame, metal) => {
    const icon = getSportIcon('sp020');
    const utils = render(<BadgeMedal frame={frame} metal={metal} icon={icon.id} />);
    expect(utils.UNSAFE_queryAllByProps({ d: getFrame(frame).outline }).length).toBeGreaterThan(0);
    expect(utils.UNSAFE_queryAllByProps({ d: corePath(getFrame(frame)) }).length).toBeGreaterThan(0);
    // the icon is drawn twice: its dark shadow, then the metal
    expect(utils.UNSAFE_queryAllByProps({ d: icon.d }).filter((n) => n.props.fill === '#000000' || String(n.props.fill).startsWith('url(#bmIcon-'))).toHaveLength(2);
  });

  it('fills the ring and the icon with gradients of the metal, and the disc with a black one', () => {
    for (const metal of METAL_IDS) {
      const utils = render(<BadgeMedal frame="stone" metal={metal} icon="sp005" />);
      expect(utils.UNSAFE_queryAllByProps({ d: getFrame('stone').outline }).some((n) => n.props.fill === `url(#bmRing-${metal})`)).toBe(true);
      expect(utils.UNSAFE_queryAllByProps({ fill: `url(#bmIcon-${metal})` }).length).toBeGreaterThan(0);
      expect(utils.UNSAFE_queryAllByProps({ d: corePath(getFrame('stone')) }).some((n) => n.props.fill === 'url(#bmCore)')).toBe(true);
    }
  });

  it('uses only the metal and black: every colour in the badge is one of the metal\'s, or black', () => {
    for (const metal of METAL_IDS) {
      const m = getMetal(metal);
      const ok = new Set([m.light, m.mid, m.dark, m.shine, BLACK, BLACK_TOP].map((c) => c.toLowerCase()));
      const utils = render(<BadgeMedal frame="gem" metal={metal} icon="sp030" />);
      const colours = stopColours(utils);
      expect(colours).toHaveLength(6); // the metal's light, mid, dark and shine, and the two blacks
      colours.forEach((c) => expect(ok.has(c)).toBe(true));
    }
  });

  it('gives gold, silver and bronze badges different colours: no colour but black is in two of them', () => {
    const sets = METAL_IDS.map((metal) => stopColours(render(<BadgeMedal frame="stone" metal={metal} icon="sp005" />)).filter((c) => c !== BLACK.toLowerCase() && c !== BLACK_TOP.toLowerCase()));
    sets.forEach((set) => expect(set.length).toBeGreaterThan(0));
    const all = sets.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('draws the marks on the ring: grooves as lines, gems in the light colour, sockets in black', () => {
    const frame = getFrame('gem');
    const utils = render(<BadgeMedal frame="gem" metal="gold" icon="sp005" />);
    const metal = getMetal('gold');
    frame.marks.forEach((mark) => {
      const found = utils.UNSAFE_queryAllByProps({ d: mark.d });
      expect(found.length).toBeGreaterThan(0);
      if (mark.kind === 'gem') expect(found.some((n) => n.props.fill === metal.light)).toBe(true);
      if (mark.kind === 'socket') expect(found.some((n) => n.props.fill === BLACK)).toBe(true);
      if (mark.kind === 'groove') expect(found.some((n) => n.props.stroke === BLACK && n.props.fill === 'none')).toBe(true);
    });
  });

  it('draws the ring and the disc without an icon when the icon is not one it has', () => {
    const utils = render(<BadgeMedal frame="crest" metal="gold" icon="nope" testID="m" />);
    expect(utils.UNSAFE_queryAllByProps({ d: getFrame('crest').outline }).length).toBeGreaterThan(0);
    expect(utils.UNSAFE_queryAllByProps({ fillRule: 'evenodd' })).toHaveLength(0);
  });

  it('draws the first frame in bronze for a frame and a metal it does not know', () => {
    const utils = render(<BadgeMedal frame="round" metal="platinum" icon="sp001" />);
    expect(utils.UNSAFE_queryAllByProps({ d: getFrame('stone').outline }).length).toBeGreaterThan(0);
    expect(utils.UNSAFE_queryAllByProps({ fill: 'url(#bmRing-bronze)' }).length).toBeGreaterThan(0);
  });
});

describe('dim', () => {
  it('is full strength by default, and faded to 0.38 for a badge not earned', () => {
    expect(DIM_OPACITY).toBe(0.38);
    const on = render(<BadgeMedal frame="crest" metal="gold" icon="sp001" testID="m" />);
    expect(flat(on.getByTestId('m')).opacity).toBe(1);
    const off = render(<BadgeMedal frame="crest" metal="gold" icon="sp001" testID="m" dim />);
    expect(flat(off.getByTestId('m')).opacity).toBe(DIM_OPACITY);
  });
});
