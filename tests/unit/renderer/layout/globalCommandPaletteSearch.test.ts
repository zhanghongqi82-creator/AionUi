/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  COMMAND_PALETTE_RECENT_KEY,
  getFuzzyMatchIndices,
  getSuggestedCommandPaletteItems,
  readRecentCommandPaletteEntries,
  recordRecentCommandPaletteEntry,
  searchCommandPaletteItems,
} from '@/renderer/components/layout/GlobalCommandPalette/commandPaletteSearch';
import type { CommandPaletteItem } from '@/renderer/components/layout/GlobalCommandPalette/types';
import { describe, expect, it, vi } from 'vitest';

const item = (id: string, label: string, defaultRank: number, keywords: string[] = []): CommandPaletteItem => ({
  id,
  label,
  defaultRank,
  keywords,
  kind: 'action',
  icon: 'newConversation',
  execute: vi.fn(),
});

const createStorage = (initialValue?: string): Storage => {
  const values = new Map<string, string>();
  if (initialValue !== undefined) values.set(COMMAND_PALETTE_RECENT_KEY, initialValue);
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

describe('global command palette search', () => {
  it('orders exact matches before prefix and fuzzy matches', () => {
    const results = searchCommandPaletteItems(
      [item('fuzzy', 'Open Agent Settings', 0), item('prefix', 'Agent Guide', 1), item('exact', 'Agent', 2)],
      'agent'
    );

    expect(results.map((result) => result.id)).toEqual(['exact', 'prefix', 'fuzzy']);
  });

  it('uses recent usage to break equally relevant matches', () => {
    const older = { ...item('older', 'Open Project One', 0), lastUsedAt: 10 };
    const newer = { ...item('newer', 'Open Project Two', 1), lastUsedAt: 20 };

    expect(searchCommandPaletteItems([older, newer], 'open project').map((result) => result.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('limits empty-query suggestions to five items with recent entries first', () => {
    const items = Array.from({ length: 7 }, (_, index) => ({
      ...item(`item-${index}`, `Item ${index}`, index),
      suggested: true,
      lastUsedAt: index === 6 ? 100 : undefined,
    }));

    const results = getSuggestedCommandPaletteItems(items);

    expect(results).toHaveLength(5);
    expect(results[0].id).toBe('item-6');
  });

  it('falls back to an empty recent list when storage is malformed', () => {
    expect(readRecentCommandPaletteEntries(createStorage('{bad json'))).toEqual([]);
  });

  it('records unique recent commands and keeps the newest five', () => {
    const storage = createStorage();
    for (let index = 0; index < 6; index += 1) {
      recordRecentCommandPaletteEntry(`item-${index}`, index, storage);
    }

    expect(readRecentCommandPaletteEntries(storage).map((entry) => entry.id)).toEqual([
      'item-5',
      'item-4',
      'item-3',
      'item-2',
      'item-1',
    ]);
  });

  it('returns fuzzy character positions for highlighted labels', () => {
    expect(getFuzzyMatchIndices('Scheduled Tasks', 'sct')).toEqual([0, 1, 10]);
  });
});
