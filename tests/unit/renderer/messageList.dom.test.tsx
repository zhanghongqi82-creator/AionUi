/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageText } from '@/common/chat/chatLib';
import {
  MessageListLoadingProvider,
  MessageListProvider,
  MessagePaginationProvider,
} from '@/renderer/pages/conversation/Messages/hooks';
import MessageList from '@/renderer/pages/conversation/Messages/MessageList';

const { useTeamPermissionMock } = vi.hoisted(() => ({
  useTeamPermissionMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    key: 'location-key',
    state: {},
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Image: {
    PreviewGroup: ({ children }: PropsWithChildren) => <>{children}</>,
  },
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => ({ conversation_id: 'conversation-1', type: 'aionrs' }),
}));

vi.mock('@/renderer/pages/team/hooks/TeamPermissionContext', () => ({
  useTeamPermission: useTeamPermissionMock,
}));

let mockIsProcessing = false;
vi.mock('@/renderer/pages/conversation/runtime/useConversationRuntimeView', () => ({
  useConversationRuntimeView: () => ({ isProcessing: mockIsProcessing }),
}));

vi.mock('@/renderer/hooks/file/useAutoPreviewOfficeFiles', () => ({
  useAutoPreviewOfficeFiles: () => {},
}));

vi.mock('@/renderer/pages/conversation/Messages/artifacts', () => ({
  useConversationArtifacts: () => [],
}));

vi.mock('@/renderer/pages/conversation/Messages/useAutoScroll', () => ({
  useAutoScroll: () => ({
    handleScrollerRef: () => {},
    handleContentRef: () => {},
    handleScroll: () => {},
    handleWheel: () => {},
    handlePointerDown: () => {},
    showScrollButton: false,
    scrollToBottom: () => {},
    scrollElementIntoView: () => {},
    hideScrollButton: () => {},
  }),
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageText', () => ({
  default: ({ message, showCopyRow }: { message: IMessageText; showCopyRow?: boolean }) => (
    <div data-testid={`msgtext-${message.id}`} data-copy-row={String(showCopyRow ?? true)}>
      {message.content.content}
    </div>
  ),
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageTips', () => ({
  default: () => <div>tips</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolCall', () => ({
  default: () => <div>tool_call</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolGroup', () => ({
  default: () => <div>tool_group</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageAgentStatus', () => ({
  default: () => <div>agent_status</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessagePermission', () => ({
  default: () => <div>permission</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/acp/MessageAcpPermission', () => ({
  default: () => <div>acp_permission</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/acp/MessageAcpToolCall', () => ({
  default: () => <div>acp_tool_call</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessagePlan', () => ({
  default: () => <div>plan</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageThinking', () => ({
  default: () => <div>thinking</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageCronTrigger', () => ({
  default: () => <div>cron_trigger</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageSkillSuggest', () => ({
  default: () => <div>skill_suggest</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolGroupSummary', () => ({
  default: () => <div>tool_summary</div>,
}));

vi.mock('@/renderer/pages/conversation/Messages/MessageFileChanges', () => ({
  __esModule: true,
  default: ({ isProcessing, failedFiles }: { isProcessing?: boolean; failedFiles?: number }) => (
    <div
      data-testid='file-changes'
      data-processing={String(Boolean(isProcessing))}
      data-failed-files={String(failedFiles ?? 0)}
    >
      file_changes
    </div>
  ),
  parseDiff: vi.fn((_diff: string, fileName: string) => ({
    file_name: fileName,
    fullPath: fileName,
    insertions: 1,
    deletions: 0,
    diff: 'diff',
    status: 'modified',
  })),
}));

vi.mock('@/renderer/pages/conversation/Messages/components/SelectionReplyButton', () => ({
  default: () => null,
}));

vi.mock('@icon-park/react', () => ({
  Down: () => <span>down</span>,
}));

function createTextMessage(): IMessageText {
  return {
    id: 'message-1',
    msg_id: 'msg-1',
    conversation_id: 'conversation-1',
    type: 'text',
    position: 'left',
    content: {
      content: 'streaming reply',
    },
    created_at: 1,
  };
}

function Wrapper({
  children,
  messages = [createTextMessage()],
  loading = false,
}: PropsWithChildren<{ messages?: IMessageText[]; loading?: boolean }>): JSX.Element {
  return (
    <MessageListLoadingProvider value={loading}>
      <MessagePaginationProvider
        value={{ hasMoreBefore: false, hasMoreAfter: false, isLoadingBefore: false, isLoadingAnchor: false }}
      >
        <MessageListProvider value={messages}>{children}</MessageListProvider>
      </MessagePaginationProvider>
    </MessageListLoadingProvider>
  );
}

describe('MessageList', () => {
  beforeEach(() => {
    mockIsProcessing = false;
    useTeamPermissionMock.mockReturnValue(null);
  });

  it('renders message rows with external margin spacing in the plain scroll list', () => {
    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    expect(screen.getByTestId('message-list-scroller')).toBeInTheDocument();
    expect(screen.getByTestId('message-list-content')).toBeInTheDocument();

    const messageRow = screen.getByTestId('message-text-left');
    expect(messageRow.className).toContain('m-t-10px');
    expect(messageRow.className).not.toContain('pt-10px');
  });

  it('uses container-responsive fluid width for standalone message rows', () => {
    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    const messageRow = screen.getByTestId('message-text-left');
    expect(messageRow.className).toContain('chat-surface-fluid');
    expect(messageRow.className).not.toContain('w-[calc(100%-24px)]');
    expect(messageRow.className).not.toContain('md:w-[calc(100%-clamp(80px,10vw,240px))]');
    expect(messageRow.className).not.toContain('max-w-780px');
  });

  it('uses the full available row width in team mode', () => {
    useTeamPermissionMock.mockReturnValue({
      isTeamMode: true,
      isLeaderAgent: true,
      leaderConversationId: 'conversation-1',
      allConversationIds: ['conversation-1'],
      propagateMode: vi.fn(),
      warmupSession: vi.fn().mockResolvedValue(undefined),
    });

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });

    const messageRow = screen.getByTestId('message-text-left');
    expect(messageRow.className).toContain('w-full');
    expect(messageRow.className).toContain('max-w-full');
    expect(messageRow.className).not.toContain('w-[calc(100%-24px)]');
    expect(messageRow.className).not.toContain('md:w-[calc(100%-clamp(80px,10vw,240px))]');
  });

  it('shows the copy row only on the last AI text of each turn', () => {
    // Turn 1: thinking + text(a) + tool + text(b) -> row only on text(b).
    // A user message ends the turn. Turn 2: text(c) -> row on text(c).
    const messages = [
      { id: 'think-1', type: 'thinking', position: 'left', content: { content: 'thinking' }, created_at: 1 },
      { id: 'text-a', type: 'text', position: 'left', content: { content: 'a' }, created_at: 2 },
      { id: 'tool-1', type: 'tool_call', position: 'left', content: { content: 't' }, created_at: 3 },
      { id: 'text-b', type: 'text', position: 'left', content: { content: 'b' }, created_at: 4 },
      { id: 'user-1', type: 'text', position: 'right', content: { content: 'q' }, created_at: 5 },
      { id: 'text-c', type: 'text', position: 'left', content: { content: 'c' }, created_at: 6 },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    // Intermediate AI text (followed by a tool then another text) hides the row.
    expect(screen.getByTestId('msgtext-text-a').getAttribute('data-copy-row')).toBe('false');
    // Last AI text of turn 1 (after the tool block) keeps the row — fallback strategy.
    expect(screen.getByTestId('msgtext-text-b').getAttribute('data-copy-row')).toBe('true');
    // User message always keeps its own row.
    expect(screen.getByTestId('msgtext-user-1').getAttribute('data-copy-row')).toBe('true');
    // Turn 2's only/last text keeps the row.
    expect(screen.getByTestId('msgtext-text-c').getAttribute('data-copy-row')).toBe('true');
  });

  it('withholds the streaming turn copy row but keeps earlier finished turns', () => {
    mockIsProcessing = true;
    // Turn 1 finished (text-a), then a user message, then turn 2 still streaming (text-b).
    const messages = [
      { id: 'text-a', type: 'text', position: 'left', content: { content: 'a' }, created_at: 1 },
      { id: 'user-1', type: 'text', position: 'right', content: { content: 'q' }, created_at: 2 },
      { id: 'text-b', type: 'text', position: 'left', content: { content: 'b' }, created_at: 3 },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    // Earlier finished turn keeps its row even while a later turn streams.
    expect(screen.getByTestId('msgtext-text-a').getAttribute('data-copy-row')).toBe('true');
    // The in-progress final turn withholds its row until streaming ends.
    expect(screen.getByTestId('msgtext-text-b').getAttribute('data-copy-row')).toBe('false');
  });

  it('binds file changes to the bottom of the Agent turn that produced them', () => {
    const messages = [
      {
        id: 'write-1',
        type: 'tool_group',
        position: 'left',
        content: [
          {
            call_id: 'call-1',
            name: 'WriteFile',
            description: 'write file',
            render_output_as_markdown: false,
            status: 'Success',
            result_display: { file_name: 'src/app.ts', file_diff: '+new line' },
          },
          {
            call_id: 'call-2',
            name: 'WriteFile',
            description: 'write failed',
            render_output_as_markdown: false,
            status: 'Error',
          },
        ],
        created_at: 1,
      },
      { id: 'final-1', type: 'text', position: 'left', content: { content: 'final answer' }, created_at: 2 },
      { id: 'user-2', type: 'text', position: 'right', content: { content: 'next question' }, created_at: 3 },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    const finalAnswer = screen.getByText('final answer');
    const summary = screen.getByTestId('file-changes');
    const nextQuestion = screen.getByText('next question');
    expect(finalAnswer.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(nextQuestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary).toHaveAttribute('data-processing', 'false');
    expect(summary).toHaveAttribute('data-failed-files', '1');
  });

  it('marks the final turn summary as processing while the Agent is running', () => {
    mockIsProcessing = true;
    const messages = [
      {
        id: 'write-1',
        type: 'tool_group',
        position: 'left',
        content: [
          {
            call_id: 'call-1',
            name: 'WriteFile',
            description: 'write file',
            render_output_as_markdown: false,
            status: 'Success',
            result_display: { file_name: 'src/app.ts', file_diff: '+new line' },
          },
        ],
        created_at: 1,
      },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    expect(screen.getByTestId('file-changes')).toHaveAttribute('data-processing', 'true');
  });

  it('summarizes AionRs Edit tool calls that carry old and new strings', () => {
    const messages = [
      {
        id: 'edit-1',
        type: 'tool_call',
        position: 'left',
        content: {
          call_id: 'call-1',
          name: 'Edit',
          status: 'completed',
          input: {
            file_path: '/tmp/preview.txt',
            old_string: 'before',
            new_string: 'before\nafter',
          },
        },
        created_at: 1,
      },
      { id: 'final-1', type: 'text', position: 'left', content: { content: 'done' }, created_at: 2 },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    expect(screen.getByTestId('file-changes')).toHaveAttribute('data-processing', 'false');
    expect(screen.getByText('done').compareDocumentPosition(screen.getByTestId('file-changes'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('summarizes successful Office CLI mutations without treating read commands as changes', () => {
    const messages = [
      {
        id: 'office-view',
        type: 'tool_call',
        position: 'left',
        content: {
          call_id: 'call-view',
          name: 'ExecCommand',
          status: 'completed',
          input: { cmd: 'officecli view "/tmp/resume.docx" text' },
        },
        created_at: 1,
      },
      {
        id: 'office-add',
        type: 'tool_call',
        position: 'left',
        content: {
          call_id: 'call-add',
          name: 'ExecCommand',
          status: 'completed',
          input: { cmd: 'export PATH="$HOME/.local/bin:$PATH" && officecli add "/tmp/resume.docx" /body' },
        },
        created_at: 2,
      },
      { id: 'final-1', type: 'text', position: 'left', content: { content: 'office done' }, created_at: 3 },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    expect(screen.getAllByTestId('file-changes')).toHaveLength(1);
    expect(screen.getByText('office done').compareDocumentPosition(screen.getByTestId('file-changes'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('renders one tool event directly and folds two consecutive tool events into an activity stack', () => {
    const singleTool = [
      {
        id: 'tool-1',
        type: 'tool_call',
        position: 'left',
        content: { call_id: 'call-1', name: 'Read', status: 'completed', input: { file_path: 'GuidPage.tsx' } },
        created_at: 1,
      },
      { id: 'final-1', type: 'text', position: 'left', content: { content: 'done' }, created_at: 2 },
    ] as unknown as IMessageText[];

    const { unmount } = render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={singleTool}>{children}</Wrapper>,
    });

    expect(screen.getByText('tool_call')).toBeInTheDocument();
    expect(screen.queryByText('tool_summary')).not.toBeInTheDocument();

    const groupedTools = [
      singleTool[0],
      {
        id: 'tool-2',
        type: 'tool_call',
        position: 'left',
        content: { call_id: 'call-2', name: 'Search', status: 'running', input: { pattern: 'SendBox' } },
        created_at: 2,
      },
      { id: 'final-2', type: 'text', position: 'left', content: { content: 'done' }, created_at: 3 },
    ] as unknown as IMessageText[];

    unmount();
    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={groupedTools}>{children}</Wrapper>,
    });

    expect(screen.getByText('tool_summary')).toBeInTheDocument();
    expect(screen.queryByText('tool_call')).not.toBeInTheDocument();
  });

  it('keeps tool confirmation requests outside the folded activity stack', () => {
    const messages = [
      {
        id: 'tool-confirm',
        type: 'tool_group',
        position: 'left',
        content: [
          {
            call_id: 'call-confirm',
            name: 'ExecCommand',
            status: 'Confirming',
            confirmationDetails: { type: 'exec', command: 'bun run test' },
          },
        ],
        created_at: 1,
      },
      {
        id: 'tool-2',
        type: 'tool_call',
        position: 'left',
        content: { call_id: 'call-2', name: 'Read', status: 'completed' },
        created_at: 2,
      },
    ] as unknown as IMessageText[];

    render(<MessageList />, {
      wrapper: ({ children }) => <Wrapper messages={messages}>{children}</Wrapper>,
    });

    expect(screen.getByText('tool_group')).toBeInTheDocument();
    expect(screen.getByText('tool_call')).toBeInTheDocument();
    expect(screen.queryByText('tool_summary')).not.toBeInTheDocument();
  });

  it('renders the empty slot when there are no messages', () => {
    render(<MessageList emptySlot={<div>empty state</div>} />, {
      wrapper: ({ children }) => <Wrapper messages={[]}>{children}</Wrapper>,
    });

    expect(screen.getByText('empty state')).toBeInTheDocument();
  });

  it('renders a skeleton while the initial message batch is loading', () => {
    render(<MessageList emptySlot={<div>empty state</div>} />, {
      wrapper: ({ children }) => (
        <Wrapper messages={[]} loading>
          {children}
        </Wrapper>
      ),
    });

    expect(screen.getByTestId('message-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('empty state')).not.toBeInTheDocument();
  });
});
