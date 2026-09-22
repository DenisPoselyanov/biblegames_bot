import { describe, expect, it } from 'vitest';
import { diffFields } from '../revisionDiff';

interface Fixture {
  id: string;
  title: string;
  options: string[];
  createdAt: string;
}

describe('diffFields', () => {
  it('reports no diff when every listed field is unchanged', () => {
    const before: Fixture = { id: '1', title: 'a', options: ['x', 'y'], createdAt: 't0' };
    const after: Fixture = { id: '1', title: 'a', options: ['x', 'y'], createdAt: 't1' };
    const result = diffFields(before, after, ['title', 'options']);
    expect(result.changed).toBe(false);
    expect(result.fields).toEqual([]);
  });

  it('reports a changed scalar field with before/after values', () => {
    const before: Fixture = { id: '1', title: 'a', options: ['x'], createdAt: 't0' };
    const after: Fixture = { id: '1', title: 'b', options: ['x'], createdAt: 't1' };
    const result = diffFields(before, after, ['title']);
    expect(result.changed).toBe(true);
    expect(result.fields).toEqual([{ field: 'title', before: 'a', after: 'b' }]);
  });

  it('diffs array fields as a whole, ignoring order-preserving no-ops', () => {
    const before: Fixture = { id: '1', title: 'a', options: ['x', 'y'], createdAt: 't0' };
    const after: Fixture = { id: '1', title: 'a', options: ['x', 'z'], createdAt: 't0' };
    const result = diffFields(before, after, ['options']);
    expect(result.changed).toBe(true);
    expect(result.fields[0]).toEqual({ field: 'options', before: ['x', 'y'], after: ['x', 'z'] });
  });

  it('treats before: null as every field being new', () => {
    const after: Fixture = { id: '1', title: 'a', options: ['x'], createdAt: 't0' };
    const result = diffFields(null, after, ['title', 'options']);
    expect(result.changed).toBe(true);
    expect(result.fields).toEqual([
      { field: 'title', before: null, after: 'a' },
      { field: 'options', before: null, after: ['x'] },
    ]);
  });
});
