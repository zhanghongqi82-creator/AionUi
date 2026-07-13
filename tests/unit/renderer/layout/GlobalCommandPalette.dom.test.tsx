/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigateMock, showOpenMock, catalogMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  showOpenMock: vi.fn(),
  catalogMock: {
    assistants: [
      {
        id: 'codex',
        source: 'generated',
        name: 'Codex CLI',
        name_i18n: {},
        description_i18n: {},
        enabled: true,
        sort_order: 1,
        agent_id: 'codex',
        enabled_skills: [],
        custom_skill_names: [],
        disabled_builtin_skills: [],
        context_i18n: {},
        prompts: [],
        prompts_i18n: {},
        models: ['gpt-test'],
        agent_status: 'missing',
        agent_status_message: 'Codex CLI is not installed',
        team_selectable: true,
        deletable: false,
      },
    ],
    conversations: [],
  },
}));

const translations: Record<string, string> = {
  'common.commandPalette.placeholder': 'Search commands',
  'common.commandPalette.suggestions': 'Suggestions',
  'common.commandPalette.results': 'Results',
  'common.commandPalette.noResults': 'No results',
  'common.commandPalette.tryScheduledTasks': 'Try scheduled tasks',
  'common.commandPalette.selectHint': 'Select',
  'common.commandPalette.openHint': 'Open',
  'common.commandPalette.closeHint': 'Open or close',
  'common.commandPalette.openProject': 'Open project',
  'common.commandPalette.openProjectDescription': 'Choose workspace',
  'common.commandPalette.createScheduledTask': 'Create scheduled task',
  'common.commandPalette.newConversationDescription': 'Start a new task',
  'common.commandPalette.navigationDescription': 'Open page',
  'common.commandPalette.modelSettings': 'Model settings',
  'common.commandPalette.switchAssistant': 'Switch assistant',
  'common.commandPalette.switchModel': 'Switch model',
  'common.commandPalette.recentWorkspace': 'Recent project',
  'common.commandPalette.recentConversation': 'Recent conversation',
  'common.commandPalette.assistantUnavailable': 'Agent unavailable',
  'common.commandPalette.viewSetup': 'View setup',
  'common.commandPalette.operationFailed': 'Action failed',
  'common.commandPalette.actionKeyword': 'Action',
  'common.commandPalette.assistantKeyword': 'Assistant Agent',
  'conversation.welcome.newConversation': 'New chat',
  'conversation.historySearch.untitled': 'Untitled',
  'settings.assistants': 'Assistants',
  'settings.skills': 'Skills',
  'settings.tools': 'Tools',
  'settings.title': 'Settings',
  'common.skills': 'Skills',
  'common.settings': 'Settings',
  'common.workspace': 'Project',
  'common.folder': 'Folder',
  'common.model': 'Model',
  'cron.scheduledTasks': 'Scheduled tasks',
  'mcp.tools': 'Tools',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] || key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    assistants: { list: { invoke: vi.fn() } },
    database: { getUserConversations: { invoke: vi.fn() } },
    dialog: { showOpen: { invoke: showOpenMock } },
  },
}));

vi.mock('swr', () => ({
  default: (key: string | null) => ({ data: key ? catalogMock : undefined, isLoading: false }),
}));

vi.mock('@/renderer/components/base/AionModal', () => ({
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <div role='dialog'>{children}</div> : null,
}));

import GlobalCommandPalette from '@/renderer/components/layout/GlobalCommandPalette';

describe('GlobalCommandPalette', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    showOpenMock.mockReset();
    localStorage.clear();
  });

  it('opens with the global shortcut, limits suggestions, and closes with Escape', () => {
    render(<GlobalCommandPalette />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(5);

    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses arrow keys and Enter to execute the active result without auto-selecting a folder', async () => {
    showOpenMock.mockResolvedValue(['/tmp/project']);
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    const input = screen.getByLabelText('Search commands');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(showOpenMock).toHaveBeenCalledOnce());
    expect(navigateMock).toHaveBeenCalledWith('/guid', { state: { workspace: '/tmp/project' } });
  });

  it('keeps unavailable assistants searchable and opens their setup', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await user.type(screen.getByLabelText('Search commands'), 'Codex');
    const result = screen.getByTestId('command-palette-item-assistant:codex');
    expect(result).toHaveTextContent('Codex CLI is not installed');
    expect(result).toHaveTextContent('View setup');
    await user.click(result);

    expect(navigateMock).toHaveBeenCalledWith('/assistants', {
      state: { openAssistantId: 'codex', openAssistantEditor: true },
    });
  });

  it('shows a recoverable no-results state without rewriting the query', async () => {
    const user = userEvent.setup();
    render(<GlobalCommandPalette />);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getByLabelText('Search commands');
    await user.type(input, 'deploy production');

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(input).toHaveValue('deploy production');
    expect(screen.getByRole('button', { name: 'Try scheduled tasks' })).toBeInTheDocument();
  });
});
