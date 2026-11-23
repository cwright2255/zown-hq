// The Open Source Licenses screen (app/profile/licenses.jsx), reached from Settings. At the bottom it credits the artist of the sports icons
// the badges are made with, as Vecteezy's free licence asks.
import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });

import OpenSourceLicenses from '../app/profile/licenses';

let openURL;
beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => openURL.mockRestore());

describe('the sports icon credit', () => {
  it('names the artist, the site and the licence', () => {
    const utils = render(<OpenSourceLicenses />);
    expect(utils.getByText('Artwork')).toBeTruthy();
    expect(utils.getByText('Sports icons')).toBeTruthy();
    expect(utils.getByText('Vecteezy Free License')).toBeTruthy();
    expect(utils.getByText('By M. M Afzal Baky (saz digital) on Vecteezy.com')).toBeTruthy();
  });

  it('links to Vecteezy, and says so', () => {
    const utils = render(<OpenSourceLicenses />);
    fireEvent.press(utils.getByText('View on Vecteezy.com'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://www.vecteezy.com');
  });

  it('is the last thing on the screen, after every open source package', () => {
    const utils = render(<OpenSourceLicenses />);
    const titles = utils.UNSAFE_root.findAll((n) => n.type === 'Text' && typeof n.props.children === 'string').map((n) => n.props.children);
    expect(titles.indexOf('Hono')).toBeGreaterThan(-1);
    expect(titles.indexOf('Sports icons')).toBeGreaterThan(titles.indexOf('Hono'));
    expect(titles[titles.length - 1]).toBe('View on Vecteezy.com');
  });

  it('is in a section of its own, and the sections can still be folded', () => {
    const utils = render(<OpenSourceLicenses />);
    fireEvent.press(utils.getByText('Artwork'));
    expect(utils.queryByText('Sports icons')).toBeNull();
    fireEvent.press(utils.getByText('Artwork'));
    expect(utils.getByText('Sports icons')).toBeTruthy();
  });
});

describe('the packages', () => {
  it('still say View on GitHub and open their repository', () => {
    const utils = render(<OpenSourceLicenses />);
    expect(utils.getAllByText('View on GitHub').length).toBeGreaterThan(20);
    fireEvent.press(utils.getAllByText('View on GitHub')[0]);
    expect(openURL).toHaveBeenCalledWith('https://github.com/facebook/react');
  });

  it('say the software and artwork they are about', () => {
    expect(render(<OpenSourceLicenses />).getByText(/open source software and artwork/)).toBeTruthy();
  });
});
