import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import type { ToolMessage } from '@/common/chat/normalizeToolCall';
import MessageToolGroupSummary from '@/renderer/pages/conversation/Messages/components/MessageToolGroupSummary';

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getConversationMessage: {
        invoke: vi.fn(),
      },
    },
  },
}));

const createToolMessage = (
  id: string,
  status: 'pending' | 'running' | 'completed' | 'error',
  name: string,
  description?: string
): ToolMessage =>
  ({
    id,
    type: 'tool_call',
    position: 'left',
    content: { call_id: id, name, status, description },
  }) as unknown as ToolMessage;

describe('MessageToolGroupSummary', () => {
  it('derives scan-friendly file and command summaries from existing tool input', () => {
    render(
      <MessageToolGroupSummary
        messages={[
          {
            id: 'read-1',
            type: 'tool_call',
            position: 'left',
            content: {
              call_id: 'read-1',
              name: 'Read',
              status: 'completed',
              input: { file_path: '/project/MessageList.tsx' },
            },
          } as unknown as ToolMessage,
          {
            id: 'exec-1',
            type: 'tool_call',
            position: 'left',
            content: {
              call_id: 'exec-1',
              name: 'ExecCommand',
              status: 'running',
              input: { cmd: 'bun run test' },
            },
          } as unknown as ToolMessage,
        ]}
      />
    );

    expect(screen.getByText('/project/MessageList.tsx')).toBeInTheDocument();
    expect(screen.getAllByText('bun run test')).toHaveLength(2);
  });

  it('shows the current activity and progress while running, then collapses when complete', async () => {
    const { rerender } = render(
      <MessageToolGroupSummary
        messages={[
          createToolMessage('read-1', 'completed', 'Read', 'GuidPage.tsx'),
          createToolMessage('exec-1', 'running', 'ExecCommand', 'bun run test'),
        ]}
      />
    );

    expect(screen.getByTestId('tool-activity-stack')).toHaveAttribute('data-running', 'true');
    expect(screen.getByTestId('tool-activity-stack-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getAllByText('bun run test')).toHaveLength(2);

    rerender(
      <MessageToolGroupSummary
        messages={[
          createToolMessage('read-1', 'completed', 'Read', 'GuidPage.tsx'),
          createToolMessage('exec-1', 'completed', 'ExecCommand', 'bun run test'),
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tool-activity-stack-toggle')).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.queryByText('GuidPage.tsx')).not.toBeInTheDocument();
  });

  it('keeps failed and canceled activities visible while the completed stack is collapsed', () => {
    render(
      <MessageToolGroupSummary
        messages={[
          createToolMessage('read-1', 'completed', 'Read', 'GuidPage.tsx'),
          createToolMessage('exec-1', 'error', 'ExecCommand', 'bun run test timed out'),
          {
            id: 'search-group',
            type: 'tool_group',
            position: 'left',
            content: [{ call_id: 'search-1', name: 'Search', status: 'Canceled', description: 'components' }],
          } as unknown as ToolMessage,
        ]}
      />
    );

    expect(screen.getByTestId('tool-activity-stack-toggle')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('bun run test timed out')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.queryByText('GuidPage.tsx')).not.toBeInTheDocument();
  });

  it('loads full tool content when expanding a compact history item', async () => {
    const invoke = vi.mocked(ipcBridge.database.getConversationMessage.invoke);
    invoke.mockResolvedValue({
      id: 'message-1',
      conversation_id: 'conversation-1',
      type: 'acp_tool_call',
      content: {
        update: {
          session_update: 'tool_call',
          tool_call_id: 'tool-1',
          status: 'completed',
          title: 'rg',
          kind: 'search',
          raw_input: { pattern: 'needle', path: '.' },
          content: [{ type: 'content', content: { type: 'text', text: 'full output' } }],
        },
      },
    } as unknown as TMessage);

    render(
      <MessageToolGroupSummary
        messages={[
          {
            id: 'message-1',
            conversation_id: 'conversation-1',
            type: 'acp_tool_call',
            content: {
              _compact: {
                truncated: true,
                original_size: 90000,
                preview_chars: 4096,
              },
              update: {
                session_update: 'tool_call',
                tool_call_id: 'tool-1',
                status: 'completed',
                title: 'rg',
                kind: 'search',
                raw_input: { pattern: 'needle', path: '.' },
                content: [{ type: 'content', content: { type: 'text', text: 'preview' } }],
              },
            },
          } as unknown as ToolMessage,
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('tool-activity-stack-toggle'));
    fireEvent.click(screen.getByText('rg'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith({
        conversation_id: 'conversation-1',
        message_id: 'message-1',
      });
    });
    expect(await screen.findByText('full output')).toBeInTheDocument();
  });
});
