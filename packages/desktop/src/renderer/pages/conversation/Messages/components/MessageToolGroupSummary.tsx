import type { BadgeProps } from '@arco-design/web-react';
import { Badge, Button, Message, Spin, Tooltip } from '@arco-design/web-react';
import { IconDown, IconRight } from '@arco-design/web-react/icon';
import { Checklist, Download, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import { getAcpImageFileName } from '@/common/chat/acpToolCallOutput';
import type { NormalizedToolCall, NormalizedToolStatus, ToolMessage } from '@/common/chat/normalizeToolCall';
import { normalizeToolMessages, hasRunningToolMessages } from '@/common/chat/normalizeToolCall';
import LocalImageView from '@/renderer/components/media/LocalImageView';
import { downloadFileFromPath } from '@/renderer/utils/file/download';
import './MessageToolGroupSummary.css';

const statusToBadge = (status: NormalizedToolStatus): BadgeProps['status'] => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    case 'running':
      return 'processing';
    case 'canceled':
      return 'default';
    case 'pending':
    default:
      return 'default';
  }
};

const ToolItemDetail: React.FC<{ item: NormalizedToolCall }> = ({ item }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [fullItem, setFullItem] = useState<NormalizedToolCall | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const displayItem = fullItem ?? item;
  const hasDetail = displayItem.input || displayItem.output || item.truncated || item.imagePath;
  const [messageApi, messageContext] = Message.useMessage();
  const handleDownloadImage = useCallback(
    async (path: string) => {
      try {
        await downloadFileFromPath(path, getAcpImageFileName(path));
        messageApi.success(t('acp.image.download_success'));
      } catch (error) {
        console.error('[MessageToolGroupSummary] Failed to download image:', error);
        messageApi.error(t('acp.image.download_error'));
      }
    },
    [messageApi, t]
  );

  const loadFullItem = async () => {
    if (!item.truncated || fullItem || loadingFull || !item.conversationId || !item.messageId) return;
    setLoadingFull(true);
    setLoadError(false);
    try {
      const message = await ipcBridge.database.getConversationMessage.invoke({
        conversation_id: item.conversationId,
        message_id: item.messageId,
      });
      const next = normalizeToolMessages([message as ToolMessage]).find((candidate) => candidate.key === item.key);
      if (next) setFullItem(next);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingFull(false);
    }
  };

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded) void loadFullItem();
  };

  return (
    <div className='tool-activity-stack__item-wrap' data-tool-status={item.status} role='listitem'>
      {messageContext}
      {hasDetail ? (
        <Button
          type='text'
          className='tool-activity-stack__item tool-activity-stack__item--interactive'
          aria-expanded={expanded}
          aria-label={t(expanded ? 'messages.activityStack.collapseItem' : 'messages.activityStack.expandItem', {
            name: displayItem.name,
          })}
          onClick={toggleExpanded}
        >
          <Badge status={statusToBadge(item.status)} className={item.status === 'running' ? 'badge-breathing' : ''} />
          <span className={`tool-activity-stack__item-copy${expanded ? ' tool-activity-stack__item-copy--open' : ''}`}>
            <span className='tool-activity-stack__item-name'>{displayItem.name}</span>
            {displayItem.description && displayItem.description !== displayItem.name && (
              <span className='tool-activity-stack__item-description'>{displayItem.description}</span>
            )}
          </span>
          <span className='tool-activity-stack__item-arrow' aria-hidden='true'>
            {expanded ? <IconDown style={{ fontSize: 12 }} /> : <IconRight style={{ fontSize: 12 }} />}
          </span>
        </Button>
      ) : (
        <div className='tool-activity-stack__item'>
          <Badge status={statusToBadge(item.status)} className={item.status === 'running' ? 'badge-breathing' : ''} />
          <span className='tool-activity-stack__item-copy'>
            <span className='tool-activity-stack__item-name'>{displayItem.name}</span>
            {displayItem.description && displayItem.description !== displayItem.name && (
              <span className='tool-activity-stack__item-description'>{displayItem.description}</span>
            )}
          </span>
        </div>
      )}
      {expanded && hasDetail && (
        <div className='tool-detail-panel'>
          {loadingFull && <div className='tool-detail-label'>{t('messages.activityStack.loadingDetail')}</div>}
          {loadError && <div className='tool-detail-label'>{t('messages.activityStack.loadDetailFailed')}</div>}
          {displayItem.input && (
            <div className='tool-detail-section'>
              <div className='tool-detail-label'>{t('messages.activityStack.input')}</div>
              <pre className='tool-detail-content'>{displayItem.input}</pre>
            </div>
          )}
          {displayItem.output && (
            <div className='tool-detail-section'>
              <div className='tool-detail-label'>{t('messages.activityStack.output')}</div>
              <pre className='tool-detail-content'>{displayItem.output}</pre>
            </div>
          )}
        </div>
      )}
      {item.imagePath && (
        <div className='group relative m-l-20px m-t-8px overflow-hidden rounded border bg-1 p-2 max-w-280px'>
          <LocalImageView
            src={item.imagePath}
            alt={getAcpImageFileName(item.imagePath)}
            className='max-w-full max-h-320px object-contain rounded'
          />
          <Tooltip content={t('acp.image.download')}>
            <Button
              aria-label={t('acp.image.download_aria')}
              className='!absolute right-10px top-10px !h-28px !w-28px !p-0 opacity-0 shadow-sm transition-opacity group-hover:opacity-90 focus:opacity-100'
              type='secondary'
              size='mini'
              shape='circle'
              icon={<Download theme='outline' size='14' />}
              onClick={() => void handleDownloadImage(item.imagePath)}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
};

const MessageToolGroupSummary: React.FC<{ messages: ToolMessage[] }> = ({ messages }) => {
  const { t } = useTranslation();
  const hasRunning = hasRunningToolMessages(messages);
  const [showMore, setShowMore] = useState(hasRunning);
  const previousHasRunningRef = useRef(hasRunning);

  const tools = useMemo(() => normalizeToolMessages(messages), [messages]);
  const completedCount = tools.filter((item) => ['completed', 'error', 'canceled'].includes(item.status)).length;
  const currentItem =
    tools.findLast((item) => item.status === 'running') ??
    tools.findLast((item) => item.status === 'pending') ??
    tools.at(-1);
  const importantItems = tools.filter((item) => item.status === 'error' || item.status === 'canceled');

  const currentAction = useMemo(() => {
    const normalizedName = currentItem?.name.toLowerCase() ?? '';
    if (/(read|file_read)/.test(normalizedName)) return t('messages.activityStack.actions.read');
    if (/(search|grep|glob|find)/.test(normalizedName)) return t('messages.activityStack.actions.search');
    if (/(edit|write|replace|patch)/.test(normalizedName)) return t('messages.activityStack.actions.edit');
    if (/(exec|command|shell|bash|run)/.test(normalizedName)) return t('messages.activityStack.actions.execute');
    if (/(browser|web|fetch)/.test(normalizedName)) return t('messages.activityStack.actions.browse');
    return currentItem?.name ?? t('messages.activityStack.actions.tool');
  }, [currentItem, t]);

  useEffect(() => {
    if (hasRunning && !previousHasRunningRef.current) setShowMore(true);
    if (!hasRunning && previousHasRunningRef.current) setShowMore(false);
    previousHasRunningRef.current = hasRunning;
  }, [hasRunning]);

  const displayedItems = showMore ? tools : importantItems;
  const title = hasRunning
    ? t('messages.activityStack.runningTitle', { action: currentAction })
    : t('messages.activityStack.completedTitle');
  const toggleLabel = showMore ? t('messages.activityStack.collapse') : t('messages.activityStack.expand');

  return (
    <section className='tool-activity-stack' data-testid='tool-activity-stack' data-running={hasRunning}>
      <Button
        type='text'
        className='tool-activity-stack__header'
        data-testid='tool-activity-stack-toggle'
        aria-expanded={showMore}
        aria-label={toggleLabel}
        onClick={() => setShowMore((current) => !current)}
      >
        <span className='tool-activity-stack__icon' aria-hidden='true'>
          {hasRunning ? <Spin size={12} /> : <Checklist theme='outline' size='14' />}
        </span>
        <span className='tool-activity-stack__summary'>
          <span className='tool-activity-stack__title'>{title}</span>
          {hasRunning && currentItem?.description && currentItem.description !== currentItem.name && (
            <span className='tool-activity-stack__description'>{currentItem.description}</span>
          )}
        </span>
        <span
          className='tool-activity-stack__count'
          aria-label={t('messages.activityStack.progressLabel', { completed: completedCount, total: tools.length })}
        >
          {completedCount} / {tools.length}
        </span>
        <span
          className={`tool-activity-stack__arrow${showMore ? ' tool-activity-stack__arrow--open' : ''}`}
          aria-hidden='true'
        >
          <Right theme='outline' size='12' />
        </span>
      </Button>
      {displayedItems.length > 0 && (
        <div
          className={`tool-activity-stack__body${showMore ? '' : ' tool-activity-stack__body--important'}`}
          role='list'
          aria-label={
            showMore ? t('messages.activityStack.allActivities') : t('messages.activityStack.importantActivities')
          }
        >
          {displayedItems.map((item) => (
            <ToolItemDetail key={item.key} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};

export default React.memo(MessageToolGroupSummary);
