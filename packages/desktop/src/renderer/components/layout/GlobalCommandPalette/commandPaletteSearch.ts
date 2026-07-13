/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandPaletteItem, CommandPaletteRecentEntry } from './types';

export const COMMAND_PALETTE_RECENT_KEY = 'aionui:global-command-palette:recent';
export const MAX_EMPTY_RESULTS = 5;
export const MAX_SEARCH_RESULTS = 8;

const normalize = (value: string): string => value.trim().toLocaleLowerCase();

function fuzzyScore(candidate: string, query: string): number | null {
  let candidateIndex = 0;
  let previousMatchIndex = -1;
  let gapPenalty = 0;

  for (const queryChar of query) {
    const matchIndex = candidate.indexOf(queryChar, candidateIndex);
    if (matchIndex < 0) return null;
    if (previousMatchIndex >= 0) {
      gapPenalty += matchIndex - previousMatchIndex - 1;
    }
    previousMatchIndex = matchIndex;
    candidateIndex = matchIndex + 1;
  }

  return gapPenalty + Math.max(0, candidate.length - query.length) / 100;
}

function matchScore(item: CommandPaletteItem, normalizedQuery: string): number | null {
  const candidates = [item.label, ...item.keywords].map(normalize).filter(Boolean);
  let bestScore: number | null = null;

  candidates.forEach((candidate, index) => {
    let score: number | null = null;
    if (candidate === normalizedQuery) {
      score = index === 0 ? 0 : 1;
    } else if (candidate.startsWith(normalizedQuery)) {
      score = index === 0 ? 10 : 11;
    } else if (candidate.includes(normalizedQuery)) {
      score = index === 0 ? 20 : 21;
    } else {
      const fuzzy = fuzzyScore(candidate, normalizedQuery);
      if (fuzzy !== null) {
        score = 30 + fuzzy + (index === 0 ? 0 : 1);
      }
    }

    if (score !== null && (bestScore === null || score < bestScore)) {
      bestScore = score;
    }
  });

  return bestScore;
}

export function searchCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string,
  limit = MAX_SEARCH_RESULTS
): CommandPaletteItem[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  return items
    .map((item) => ({ item, score: matchScore(item, normalizedQuery) }))
    .filter((entry): entry is { item: CommandPaletteItem; score: number } => entry.score !== null)
    .toSorted(
      (left, right) =>
        left.score - right.score ||
        (right.item.lastUsedAt ?? 0) - (left.item.lastUsedAt ?? 0) ||
        left.item.defaultRank - right.item.defaultRank ||
        left.item.label.localeCompare(right.item.label)
    )
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getSuggestedCommandPaletteItems(
  items: CommandPaletteItem[],
  limit = MAX_EMPTY_RESULTS
): CommandPaletteItem[] {
  return items
    .filter((item) => item.suggested || item.lastUsedAt)
    .toSorted(
      (left, right) =>
        (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0) ||
        left.defaultRank - right.defaultRank ||
        left.label.localeCompare(right.label)
    )
    .slice(0, limit);
}

export function readRecentCommandPaletteEntries(storage: Storage = localStorage): CommandPaletteRecentEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(COMMAND_PALETTE_RECENT_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is CommandPaletteRecentEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as CommandPaletteRecentEntry).id === 'string' &&
          typeof (entry as CommandPaletteRecentEntry).usedAt === 'number'
      )
      .slice(0, MAX_EMPTY_RESULTS);
  } catch {
    return [];
  }
}

export function recordRecentCommandPaletteEntry(
  id: string,
  usedAt = Date.now(),
  storage: Storage = localStorage
): CommandPaletteRecentEntry[] {
  const next = [{ id, usedAt }, ...readRecentCommandPaletteEntries(storage).filter((entry) => entry.id !== id)].slice(
    0,
    MAX_EMPTY_RESULTS
  );
  try {
    storage.setItem(COMMAND_PALETTE_RECENT_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function getFuzzyMatchIndices(text: string, query: string): number[] {
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const directIndex = normalizedText.indexOf(normalizedQuery);
  if (directIndex >= 0) {
    return Array.from({ length: normalizedQuery.length }, (_, index) => directIndex + index);
  }

  const indices: number[] = [];
  let textIndex = 0;
  for (const queryChar of normalizedQuery) {
    const matchIndex = normalizedText.indexOf(queryChar, textIndex);
    if (matchIndex < 0) return [];
    indices.push(matchIndex);
    textIndex = matchIndex + 1;
  }
  return indices;
}
