/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { FileChangeInfo } from '@/renderer/utils/file/diffUtils';

export type FileChangeSummary = {
  insertions: number;
  deletions: number;
  counts: Record<FileChangeInfo['status'], number>;
};

const mergeStatus = (current: FileChangeInfo['status'], next: FileChangeInfo['status']): FileChangeInfo['status'] => {
  if (current === 'conflicted' || next === 'conflicted') return 'conflicted';
  if (next === 'deleted') return 'deleted';
  if (current === 'added' && next === 'modified') return 'added';
  if (current === 'deleted' && next === 'added') return 'modified';
  return next;
};

/** Combine repeated edits to the same path into one per-turn file entry. */
export const mergeFileChanges = (changes: FileChangeInfo[]): FileChangeInfo[] => {
  const byPath = new Map<string, FileChangeInfo>();

  for (const change of changes) {
    const current = byPath.get(change.fullPath);
    if (!current) {
      byPath.set(change.fullPath, change);
      continue;
    }
    byPath.set(change.fullPath, {
      ...change,
      insertions: current.insertions + change.insertions,
      deletions: current.deletions + change.deletions,
      status: mergeStatus(current.status, change.status),
    });
  }

  return [...byPath.values()];
};

export const summarizeFileChanges = (files: FileChangeInfo[]): FileChangeSummary => {
  const counts: FileChangeSummary['counts'] = {
    added: 0,
    modified: 0,
    deleted: 0,
    conflicted: 0,
  };
  let insertions = 0;
  let deletions = 0;

  for (const file of files) {
    insertions += file.insertions;
    deletions += file.deletions;
    counts[file.status] += 1;
  }

  return { insertions, deletions, counts };
};
