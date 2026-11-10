import { describe, expect, it } from 'vitest';
import { isMakingView, panelOpen, panelUsable } from '../panels';

describe('side panels', () => {
  it('uses the brief panel where a thumbnail is made, the history in the image view only', () => {
    expect(['image', 'sketch', 'feed', 'channel', 'compare'].filter((v) => panelUsable('brief', v as never))).toEqual(['image', 'sketch']);
    expect(['image', 'sketch', 'feed', 'channel', 'compare'].filter((v) => panelUsable('history', v as never))).toEqual(['image']);
    expect(isMakingView('sketch')).toBe(true);
    expect(isMakingView('compare')).toBe(false);
  });

  it('opens a usable panel unless the user closed it, and folds it elsewhere whatever they chose', () => {
    const none = { brief: false, history: false };
    expect(panelOpen('brief', 'image', none)).toBe(true);
    expect(panelOpen('brief', 'image', { ...none, brief: true })).toBe(false);
    expect(panelOpen('brief', 'feed', none)).toBe(false);
    expect(panelOpen('history', 'sketch', none)).toBe(false);
    expect(panelOpen('history', 'image', { ...none, brief: true })).toBe(true);
  });
});
