/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageFileChanges, {
  mergeFileChanges,
  parseDiff,
  summarizeFileChanges,
} from '@/renderer/pages/conversation/Messages/MessageFileChanges';
import { WORKSPACE_OPEN_CHANGES_EVENT } from '@/renderer/utils/workspace/workspaceEvents';
import type { FileChangeInfo } from '@/renderer/utils/file/diffUtils';
import { useWorkspaceCollapse } from '@/renderer/pages/conversation/hooks/useWorkspaceCollapse';

const launchPreview = vi.fn();

vi.mock('@/renderer/hooks/file/usePreviewLauncher', () => ({
  usePreviewLauncher: () => ({ launchPreview }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const labels: Record<string, string> = {
        'messages.fileChangeSummary.viewChanges': 'View changes',
        'messages.fileChangeSummary.expand': 'Expand file list',
        'messages.fileChangeSummary.collapse': 'Collapse file list',
        'messages.fileChangeSummary.organizing': 'Organizing file changes...',
      };
      if (key === 'messages.fileChangeSummary.title') return `${options?.count} files changed`;
      if (key === 'messages.fileChangeSummary.partialFailure') {
        return `${options?.changed} files changed, ${options?.failed} failed`;
      }
      if (key === 'messages.fileChangeSummary.fileLimit') {
        return `${options?.total} files changed · showing first ${options?.visible}`;
      }
      if (key.startsWith('messages.fileChangeSummary.distribution.')) {
        return `${key.split('.').at(-1)} ${options?.count}`;
      }
      if (key.startsWith('messages.fileChangeSummary.status.')) return key.split('.').at(-1);
      if (key === 'messages.fileChangeSummary.openDiff') return `Open diff for ${options?.file}`;
      if (key === 'messages.fileChangeSummary.previewFile') return `Preview ${options?.file}`;
      return labels[key] ?? key;
    },
  }),
}));

const change = (index: number, overrides: Partial<FileChangeInfo> = {}): FileChangeInfo => ({
  file_name: `file-${index}.ts`,
  fullPath: `src/file-${index}.ts`,
  insertions: index + 1,
  deletions: index,
  diff: `diff-${index}`,
  status: 'modified',
  ...overrides,
});

describe('MessageFileChanges', () => {
  beforeEach(() => launchPreview.mockReset());

  it('shows a compact summary and limits the expanded list to five files', () => {
    render(<MessageFileChanges diffsChanges={Array.from({ length: 6 }, (_, index) => change(index))} />);

    expect(screen.getByText('6 files changed')).toBeInTheDocument();
    expect(screen.queryByLabelText('Open diff for file-0.ts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Expand file list'));

    expect(screen.getAllByLabelText(/Open diff for file-/)).toHaveLength(5);
    expect(screen.getByText('6 files changed · showing first 5')).toBeInTheDocument();
  });

  it('opens the workspace changes tab from the primary action', () => {
    const listener = vi.fn();
    window.addEventListener(WORKSPACE_OPEN_CHANGES_EVENT, listener);
    render(<MessageFileChanges diffsChanges={[change(0)]} />);

    fireEvent.click(screen.getByText('View changes'));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(WORKSPACE_OPEN_CHANGES_EVENT, listener);
  });

  it('shows the organizing state while the current turn is still running', () => {
    render(<MessageFileChanges diffsChanges={[change(0)]} isProcessing />);

    expect(screen.getByText('Organizing file changes...')).toBeInTheDocument();
    expect(screen.queryByText('View changes')).not.toBeInTheDocument();
  });

  it('reports partial file failures alongside successful changes', () => {
    render(<MessageFileChanges diffsChanges={[change(0), change(1)]} failedFiles={1} />);
    expect(screen.getByText('2 files changed, 1 failed')).toBeInTheDocument();
  });

  it('previews binary Office changes without showing fake line counts', () => {
    render(
      <MessageFileChanges
        diffsChanges={[
          change(0, {
            file_name: 'resume.docx',
            fullPath: '/tmp/resume.docx',
            insertions: 0,
            deletions: 0,
            diff: '',
          }),
        ]}
      />
    );

    expect(screen.queryByText('+0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Expand file list'));
    fireEvent.click(screen.getByLabelText('Preview resume.docx'));
    expect(launchPreview).toHaveBeenCalledOnce();
  });

  it('renders nothing when the turn has no file changes', () => {
    const { container } = render(<MessageFileChanges />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('file change summary data', () => {
  it('recognizes added, deleted, and conflicted diffs', () => {
    const added = parseDiff('--- /dev/null\n+++ b/new.ts\n+new line', 'new.ts');
    const deleted = parseDiff('--- a/old.ts\n+++ /dev/null\n-old line', 'old.ts');
    const conflicted = parseDiff('<<<<<<< HEAD\na\n=======\nb\n>>>>>>> branch', 'conflict.ts');

    expect([added.status, deleted.status, conflicted.status]).toEqual(['added', 'deleted', 'conflicted']);
  });

  it('merges repeated edits and totals their line changes', () => {
    const files = mergeFileChanges([
      change(0, { insertions: 2, deletions: 1 }),
      change(0, { insertions: 3, deletions: 4 }),
    ]);

    expect(files).toHaveLength(1);
    expect(summarizeFileChanges(files)).toMatchObject({ insertions: 5, deletions: 5 });
  });

  it('returns zero totals for an empty change list', () => {
    expect(summarizeFileChanges([])).toEqual({
      insertions: 0,
      deletions: 0,
      counts: { added: 0, modified: 0, deleted: 0, conflicted: 0 },
    });
  });
});

describe('workspace review action', () => {
  it('expands a collapsed workspace panel', () => {
    const { result } = renderHook(() =>
      useWorkspaceCollapse({
        workspaceEnabled: true,
        isMobile: false,
        conversation_id: 'conversation-1',
      })
    );
    expect(result.current.rightSiderCollapsed).toBe(true);

    act(() => window.dispatchEvent(new CustomEvent(WORKSPACE_OPEN_CHANGES_EVENT)));

    expect(result.current.rightSiderCollapsed).toBe(false);
  });
});
