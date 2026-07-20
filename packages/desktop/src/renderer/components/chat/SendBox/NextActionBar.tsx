import type { TMessage } from '@/common/chat/chatLib';
import { Button } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './NextActionBar.module.css';

export type NextActionId =
  | 'analyzeFailure'
  | 'retryChecks'
  | 'viewChanges'
  | 'runChecks'
  | 'openPreview'
  | 'adjustStyle'
  | 'continueRefine'
  | 'generateChecklist';

type AppliedAction = {
  id: NextActionId;
  prompt: string;
  previousDraft: string;
};

type NextActionBarProps = {
  messages: TMessage[];
  isProcessing: boolean;
  hasPreview: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
};

const CHECK_PATTERN = /(?:test|check|lint|typecheck|tsc|vitest|jest|playwright|build)/i;
const FILE_CHANGE_PATTERN = /(?:edit|write|replace|patch|apply_patch)/i;
const PREVIEW_PATTERN = /\.(?:html?|md|markdown|png|jpe?g|gif|webp|svg|pdf)(?:\b|$)/i;

const serializeValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const getMessageSearchText = (message: TMessage): string => {
  if (message.type === 'tips' || message.type === 'text') return message.content.content;
  if (message.type === 'tool_call') {
    return [
      message.content.name,
      message.content.description,
      message.content.input,
      message.content.args,
      message.content.error,
    ]
      .map(serializeValue)
      .join(' ');
  }
  if (message.type === 'tool_group') {
    return message.content
      .flatMap((item) => [item.name, item.description, item.confirmationDetails, item.result_display])
      .map(serializeValue)
      .join(' ');
  }
  if (message.type === 'acp_tool_call') {
    const update = message.content?.update;
    return [update?.title, update?.kind, update?.rawInput, update?.content].map(serializeValue).join(' ');
  }
  return '';
};

const hasFailedCheck = (messages: TMessage[]): boolean =>
  messages.some((message) => {
    const searchText = getMessageSearchText(message);
    if (!CHECK_PATTERN.test(searchText)) return false;
    if (message.type === 'tips') return message.content.type === 'error';
    if (message.type === 'tool_call') return message.content.status === 'error';
    if (message.type === 'tool_group') return message.content.some((item) => item.status === 'Error');
    if (message.type === 'acp_tool_call') return message.content?.update?.status === 'failed';
    return false;
  });

const hasFileChanges = (messages: TMessage[]): boolean =>
  messages.some((message) => {
    if (message.type === 'tool_call') {
      return message.content.status === 'completed' && FILE_CHANGE_PATTERN.test(message.content.name);
    }
    if (message.type === 'tool_group') {
      return message.content.some(
        (item) =>
          item.status === 'Success' &&
          (FILE_CHANGE_PATTERN.test(item.name) || serializeValue(item.result_display).includes('file_diff'))
      );
    }
    if (message.type === 'acp_tool_call') {
      const update = message.content?.update;
      return (
        update?.status === 'completed' &&
        (FILE_CHANGE_PATTERN.test(update.kind) || update.content?.some((item) => item.type === 'diff') === true)
      );
    }
    return false;
  });

const hasPreviewArtifact = (messages: TMessage[]): boolean =>
  messages.some((message) => {
    if (message.type === 'tool_group') {
      return message.content.some((item) => {
        const result = item.result_display;
        return (
          Boolean(result && typeof result === 'object' && 'img_url' in result) ||
          PREVIEW_PATTERN.test(getMessageSearchText(message))
        );
      });
    }
    if (message.type === 'tool_call' || message.type === 'acp_tool_call') {
      return PREVIEW_PATTERN.test(getMessageSearchText(message));
    }
    return false;
  });

const getCurrentTurn = (messages: TMessage[]): TMessage[] => {
  const latestUserIndex = messages.findLastIndex((message) => !message.hidden && message.position === 'right');
  return messages
    .slice(latestUserIndex + 1)
    .filter((message) => !message.hidden && message.type !== 'available_commands');
};

const CONTEXT_TOPIC_LIMIT = 96;

export const getLatestUserTopic = (messages: TMessage[]): string => {
  const userMessage = messages.findLast(
    (message) => !message.hidden && message.position === 'right' && message.type === 'text'
  );
  if (!userMessage || userMessage.type !== 'text') return '';

  const topic = userMessage.content.content.replace(/\s+/g, ' ').trim();
  if (topic.length <= CONTEXT_TOPIC_LIMIT) return topic;
  return `${topic.slice(0, CONTEXT_TOPIC_LIMIT).trimEnd()}…`;
};

export const buildNextActionIds = (messages: TMessage[], hasPreview: boolean): NextActionId[] => {
  const visibleMessages = messages.filter((message) => !message.hidden && message.type !== 'available_commands');
  const finalMessage = visibleMessages.at(-1);
  if (
    !finalMessage ||
    finalMessage.type !== 'text' ||
    finalMessage.position !== 'left' ||
    !finalMessage.content.content.trim()
  ) {
    return [];
  }

  const turn = getCurrentTurn(messages);
  const actions: NextActionId[] = [];
  const add = (...ids: NextActionId[]) => {
    for (const id of ids) {
      if (!actions.includes(id)) actions.push(id);
      if (actions.length === 3) return;
    }
  };

  if (hasFailedCheck(turn)) add('analyzeFailure', 'retryChecks');
  if (actions.length < 3 && hasFileChanges(turn)) add('viewChanges', 'runChecks');
  if (actions.length < 3 && (hasPreview || hasPreviewArtifact(turn))) add('openPreview', 'adjustStyle');
  if (actions.length === 0) add('continueRefine', 'generateChecklist');

  return actions.slice(0, 3);
};

const focusSendBox = () => {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLTextAreaElement>('[data-testid="sendbox-input"]');
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
};

const NextActionBar: React.FC<NextActionBarProps> = ({ messages, isProcessing, hasPreview, draft, onDraftChange }) => {
  const { t } = useTranslation();
  const actionIds = useMemo(() => buildNextActionIds(messages, hasPreview), [hasPreview, messages]);
  const userTopic = useMemo(() => getLatestUserTopic(messages), [messages]);
  const finalAnswerId = messages.findLast(
    (message) => !message.hidden && message.type === 'text' && message.position === 'left'
  )?.id;
  const [appliedAction, setAppliedAction] = useState<AppliedAction | null>(null);

  useEffect(() => {
    setAppliedAction(null);
  }, [finalAnswerId]);

  const copyById = useMemo<Record<NextActionId, string>>(
    () => ({
      analyzeFailure: t('messages.nextActions.analyzeFailure'),
      retryChecks: t('messages.nextActions.retryChecks'),
      viewChanges: t('messages.nextActions.viewChanges'),
      runChecks: t('messages.nextActions.runChecks'),
      openPreview: t('messages.nextActions.openPreview'),
      adjustStyle: t('messages.nextActions.adjustStyle'),
      continueRefine: t('messages.nextActions.continueRefine'),
      generateChecklist: t('messages.nextActions.generateChecklist'),
    }),
    [t]
  );

  const promptById = useMemo<Record<NextActionId, string>>(
    () => ({
      analyzeFailure: t('messages.nextActions.promptAnalyzeFailure', { topic: userTopic }),
      retryChecks: t('messages.nextActions.promptRetryChecks', { topic: userTopic }),
      viewChanges: t('messages.nextActions.promptViewChanges', { topic: userTopic }),
      runChecks: t('messages.nextActions.promptRunChecks', { topic: userTopic }),
      openPreview: t('messages.nextActions.promptOpenPreview', { topic: userTopic }),
      adjustStyle: t('messages.nextActions.promptAdjustStyle', { topic: userTopic }),
      continueRefine: t('messages.nextActions.promptContinueRefine', { topic: userTopic }),
      generateChecklist: t('messages.nextActions.promptGenerateChecklist', { topic: userTopic }),
    }),
    [t, userTopic]
  );

  const handleSelect = useCallback(
    (id: NextActionId) => {
      const prompt = userTopic ? promptById[id] : copyById[id];
      setAppliedAction({ id, prompt, previousDraft: draft });
      onDraftChange(prompt);
      focusSendBox();
    },
    [copyById, draft, onDraftChange, promptById, userTopic]
  );

  const handleUndo = useCallback(() => {
    if (!appliedAction) return;
    onDraftChange(appliedAction.previousDraft);
    setAppliedAction(null);
    focusSendBox();
  }, [appliedAction, onDraftChange]);

  if (isProcessing || actionIds.length === 0) return null;

  const isWeak = Boolean(draft.trim()) && draft !== appliedAction?.prompt;

  return (
    <section
      className={`${styles.bar}${isWeak ? ` ${styles.weak}` : ''}`}
      data-testid='next-action-bar'
      data-weak={isWeak}
      aria-label={t('messages.nextActions.title')}
    >
      <div className={styles.actions} aria-label={t('messages.nextActions.title')}>
        {actionIds.map((id) => (
          <Button
            key={id}
            type='secondary'
            size='small'
            shape='round'
            className={`${styles.action}${appliedAction?.id === id ? ` ${styles.selected}` : ''}`}
            data-testid={`next-action-${id}`}
            onClick={() => handleSelect(id)}
          >
            {copyById[id]}
          </Button>
        ))}
        {appliedAction && (
          <Button type='text' size='mini' className={styles.undo} data-testid='next-action-undo' onClick={handleUndo}>
            {t('messages.nextActions.undo')}
          </Button>
        )}
      </div>
    </section>
  );
};

export default React.memo(NextActionBar);
