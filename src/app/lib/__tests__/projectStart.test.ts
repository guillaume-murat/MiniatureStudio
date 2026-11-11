import { describe, expect, it } from 'vitest';
import { startInputs, startName } from '../projectStart';

const logo = new Blob(['logo'], { type: 'image/png' });
const banner = new Blob(['banner'], { type: 'image/jpeg' });
const thumbnail = new Blob(['thumb'], { type: 'image/jpeg' });
const channel = { name: 'Les Gourmandises d’Ornella', logo, banner };

describe('a project started from a YouTube URL', () => {
  it('is named as typed, else after the video, else after the channel', () => {
    expect(startName('Gâteau', { channel, video: { title: '3 ans d’aventures' } })).toBe('Gâteau');
    expect(startName('  ', { channel, video: { title: '3 ans d’aventures' } })).toBe('3 ans d’aventures');
    expect(startName('', { channel })).toBe('Les Gourmandises d’Ornella');
    expect(startName('', null)).toBeUndefined();
  });

  it('starts with the channel, the video title and its current thumbnail as a reference', () => {
    const inputs = startInputs({ channel, video: { title: '3 ans d’aventures', thumbnail } });
    expect(inputs.brand).toEqual({ channelName: channel.name, logo, banner });
    expect(inputs.videoTitle).toBe('3 ans d’aventures');
    expect(inputs.refs).toEqual([{ blob: thumbnail, source: 'youtube', label: 'YouTube: 3 ans d’aventures' }]);
  });

  it('brings only the channel from a channel URL, and nothing without one', () => {
    expect(startInputs({ channel: { name: 'Chaîne' } })).toEqual({ brand: { channelName: 'Chaîne' }, videoTitle: '', refs: [] });
    expect(startInputs(null)).toEqual({ brand: {}, videoTitle: '', refs: [] });
  });
});
