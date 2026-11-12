import { describe, expect, it } from 'vitest';
import { readLaunch, sharedBody, sharedTitle } from './share';

describe('launch parameters', () => {
  it('reads a share and finds the link Android puts in the text', () => {
    const { shared } = readLaunch('?title=Great+page&text=Look+at+this+https%3A%2F%2Fexample.com%2Fa');
    expect(shared).toEqual({ title: 'Great page', text: 'Look at this', url: 'https://example.com/a' });
    expect(sharedBody(shared!)).toBe('Look at this\n\nhttps://example.com/a');
  });
  it('titles by title, first line, then host', () => {
    expect(sharedTitle({ title: '', text: 'first\nsecond', url: '' })).toBe('first');
    expect(sharedTitle({ title: '', text: '', url: 'https://www.example.com/x' })).toBe('example.com');
  });
  it('reads shortcuts and ignores nonsense', () => {
    expect(readLaunch('?action=new-note').action).toBe('new-note');
    expect(readLaunch('?action=rm-rf').action).toBeNull();
    expect(readLaunch('').shared).toBeNull();
  });
});
