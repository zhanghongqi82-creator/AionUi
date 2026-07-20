import type { IMessageText, IMessageToolCall, TMessage } from '@/common/chat/chatLib';
import NextActionBar, {
  buildNextActionIds,
  getLatestUserTopic,
} from '@/renderer/components/chat/SendBox/NextActionBar';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

const translations: Record<string, string> = {
  'messages.nextActions.title': 'Suggested next steps',
  'messages.nextActions.undo': 'Undo',
  'messages.nextActions.hint': 'Suggestions only fill the input',
  'messages.nextActions.analyzeFailure': 'Analyze failure',
  'messages.nextActions.retryChecks': 'Retry checks',
  'messages.nextActions.viewChanges': 'View changes',
  'messages.nextActions.runChecks': 'Run checks',
  'messages.nextActions.openPreview': 'Open preview',
  'messages.nextActions.adjustStyle': 'Adjust styling',
  'messages.nextActions.continueRefine': 'Keep refining',
  'messages.nextActions.generateChecklist': 'Generate checklist',
  'messages.nextActions.promptAnalyzeFailure':
    'Analyze the failed checks for "{{topic}}". Identify the root cause, affected scope, supporting evidence, and recommended fix.',
  'messages.nextActions.promptRetryChecks':
    'Retry the relevant checks for "{{topic}}". Report passed and failed items, remaining risks, and the next step.',
  'messages.nextActions.promptViewChanges':
    'Review the changes made for "{{topic}}". Summarize each affected file, the purpose of the change, key differences, and impact.',
  'messages.nextActions.promptRunChecks':
    'Run the necessary type, format, test, and UI checks for "{{topic}}". Summarize the results and any unresolved issues.',
  'messages.nextActions.promptOpenPreview':
    'Open the latest preview for "{{topic}}". Check layout, hierarchy, spacing, responsive behavior, and interaction states.',
  'messages.nextActions.promptAdjustStyle':
    'Continue refining the visual style for "{{topic}}". Focus on hierarchy, spacing, alignment, feedback states, and consistency.',
  'messages.nextActions.promptContinueRefine':
    'Continue refining "{{topic}}". Expand the core approach, key steps, important details, edge cases, and actionable recommendations.',
  'messages.nextActions.promptGenerateChecklist':
    'Create an actionable checklist for "{{topic}}". Organize the steps by priority and include deliverables and acceptance criteria.',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, variables?: Record<string, string>) =>
      Object.entries(variables ?? {}).reduce(
        (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, replacement),
        translations[key] ?? key
      ),
  }),
}));

const textMessage = (id: string, content: string, position: 'left' | 'right'): IMessageText => ({
  id,
  conversation_id: 'conversation-1',
  type: 'text',
  position,
  status: 'finish',
  content: { content },
});

const toolMessage = (
  id: string,
  name: string,
  status: 'running' | 'completed' | 'error',
  input: Record<string, unknown>
): IMessageToolCall =>
  ({
    id,
    conversation_id: 'conversation-1',
    type: 'tool_call',
    position: 'left',
    content: { call_id: id, name, status, input, args: {} },
  }) as IMessageToolCall;

const ControlledBar: React.FC<{ messages: TMessage[]; initialDraft?: string; isProcessing?: boolean }> = ({
  messages,
  initialDraft = '',
  isProcessing = false,
}) => {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <>
      <NextActionBar
        messages={messages}
        isProcessing={isProcessing}
        hasPreview={false}
        draft={draft}
        onDraftChange={setDraft}
      />
      <textarea data-testid='sendbox-input' value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>
  );
};

describe('NextActionBar', () => {
  it('uses failure, file-change, and preview rules in priority order with a three-action limit', () => {
    const messages: TMessage[] = [
      textMessage('user-1', 'Update the interface', 'right'),
      toolMessage('edit-1', 'Edit', 'completed', { file_path: 'MessageList.tsx' }),
      toolMessage('test-1', 'ExecCommand', 'error', { cmd: 'bun run test' }),
      textMessage('assistant-1', 'The interface is updated, but one test failed.', 'left'),
    ];

    expect(buildNextActionIds(messages, true)).toEqual(['analyzeFailure', 'retryChecks', 'viewChanges']);
  });

  it('combines file-change and preview actions without exceeding three suggestions', () => {
    const messages: TMessage[] = [
      textMessage('user-1', 'Update the interface', 'right'),
      toolMessage('edit-1', 'Edit', 'completed', { file_path: 'MessageList.tsx' }),
      textMessage('assistant-1', 'The interface and preview are ready.', 'left'),
    ];

    expect(buildNextActionIds(messages, true)).toEqual(['viewChanges', 'runChecks', 'openPreview']);
  });

  it('falls back to two refinement actions after a plain-text answer', () => {
    const messages = [
      textMessage('user-1', 'Explain this component', 'right'),
      textMessage('assistant-1', 'This component manages the conversation input.', 'left'),
    ];

    render(<ControlledBar messages={messages} />);

    expect(screen.getByTestId('next-action-bar')).toBeInTheDocument();
    expect(screen.getByText('Keep refining')).toBeInTheDocument();
    expect(screen.getByText('Generate checklist')).toBeInTheDocument();
    expect(screen.queryByText('Suggested next steps')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggestions only fill the input')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('extracts and caps the latest user topic for contextual prompts', () => {
    const longTopic = `  Improve   the action bar ${'with more context '.repeat(8)}  `;
    const messages = [
      textMessage('user-1', 'Old topic', 'right'),
      textMessage('assistant-1', 'Old answer', 'left'),
      textMessage('user-2', longTopic, 'right'),
      textMessage('assistant-2', 'Latest answer', 'left'),
    ];

    const topic = getLatestUserTopic(messages);

    expect(topic).not.toContain('  ');
    expect(topic).toHaveLength(97);
    expect(topic.endsWith('…')).toBe(true);
    expect(topic).not.toContain('Old topic');
  });

  it('fills the draft without sending and can restore the previous draft', () => {
    const messages = [
      textMessage('user-1', 'Explain this component', 'right'),
      textMessage('assistant-1', 'This component manages the conversation input.', 'left'),
    ];

    render(<ControlledBar messages={messages} initialDraft='My existing draft' />);

    fireEvent.click(screen.getByTestId('next-action-continueRefine'));
    expect(screen.getByTestId('sendbox-input')).toHaveValue(
      'Continue refining "Explain this component". Expand the core approach, key steps, important details, edge cases, and actionable recommendations.'
    );
    expect(screen.getByTestId('next-action-undo')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('next-action-undo'));
    expect(screen.getByTestId('sendbox-input')).toHaveValue('My existing draft');
  });

  it('uses a distinct contextual prompt for each action', () => {
    const messages = [
      textMessage('user-1', 'Improve the action bar', 'right'),
      textMessage('assistant-1', 'The action bar is ready.', 'left'),
    ];

    render(<ControlledBar messages={messages} />);

    fireEvent.click(screen.getByTestId('next-action-continueRefine'));
    const refinePrompt = (screen.getByTestId('sendbox-input') as HTMLTextAreaElement).value;

    fireEvent.click(screen.getByTestId('next-action-generateChecklist'));
    const checklistPrompt = (screen.getByTestId('sendbox-input') as HTMLTextAreaElement).value;

    expect(refinePrompt).toContain('Expand the core approach');
    expect(checklistPrompt).toContain('Organize the steps by priority');
    expect(checklistPrompt).not.toBe(refinePrompt);
  });

  it('becomes a weak hint when the user starts typing manually', () => {
    const messages = [
      textMessage('user-1', 'Explain this component', 'right'),
      textMessage('assistant-1', 'This component manages the conversation input.', 'left'),
    ];

    render(<ControlledBar messages={messages} initialDraft='Manual follow-up' />);

    expect(screen.getByTestId('next-action-bar')).toHaveAttribute('data-weak', 'true');
  });

  it('stays hidden while processing or when the user owns the latest message', () => {
    const completeMessages = [
      textMessage('user-1', 'Explain this component', 'right'),
      textMessage('assistant-1', 'This component manages the conversation input.', 'left'),
    ];
    const { rerender } = render(<ControlledBar messages={completeMessages} isProcessing />);

    expect(screen.queryByTestId('next-action-bar')).not.toBeInTheDocument();

    rerender(<ControlledBar messages={[...completeMessages, textMessage('user-2', 'Continue', 'right')]} />);
    expect(screen.queryByTestId('next-action-bar')).not.toBeInTheDocument();
  });
});
