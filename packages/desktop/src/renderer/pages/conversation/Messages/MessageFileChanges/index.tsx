/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { usePreviewLauncher } from '@/renderer/hooks/file/usePreviewLauncher';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import { extractContentFromDiff, parseDiff, type FileChangeInfo } from '@/renderer/utils/file/diffUtils';
import { getFileTypeInfo } from '@/renderer/utils/file/fileType';
import { dispatchWorkspaceOpenChangesEvent } from '@/renderer/utils/workspace/workspaceEvents';
import { Button, Card, Spin, Tag } from '@arco-design/web-react';
import { Attention, Change, Down, Minus, Plus, Right } from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WriteFileResult } from '../types';
import styles from './MessageFileChanges.module.css';
import { mergeFileChanges, summarizeFileChanges } from './summaryUtils';

export { parseDiff, type FileChangeInfo } from '@/renderer/utils/file/diffUtils';
export { mergeFileChanges, summarizeFileChanges } from './summaryUtils';

export type MessageFileChangesProps = {
  writeFileChanges?: WriteFileResult[];
  className?: string;
  diffsChanges?: FileChangeInfo[];
  isProcessing?: boolean;
  failedFiles?: number;
};

const MAX_VISIBLE_FILES = 5;

const STATUS_ICONS: Record<FileChangeInfo['status'], React.ReactNode> = {
  added: <Plus theme='outline' size='14' />,
  modified: <Change theme='outline' size='14' />,
  deleted: <Minus theme='outline' size='14' />,
  conflicted: <Attention theme='outline' size='14' />,
};

const STATUS_CLASSES: Record<FileChangeInfo['status'], string> = {
  added: 'text-success bg-success-light-1',
  modified: 'text-primary bg-primary-light-1',
  deleted: 'text-danger bg-danger-light-1',
  conflicted: 'text-warning bg-warning-light-1',
};

const MessageFileChanges: React.FC<MessageFileChangesProps> = ({
  writeFileChanges = [],
  diffsChanges = [],
  className,
  isProcessing = false,
  failedFiles = 0,
}) => {
  const { t } = useTranslation();
  const conversation = useConversationContextSafe();
  const { launchPreview } = usePreviewLauncher();
  const [expanded, setExpanded] = useState(false);

  const fileChanges = useMemo(
    () =>
      mergeFileChanges([
        ...diffsChanges,
        ...writeFileChanges.flatMap((change) =>
          change.file_diff ? [parseDiff(change.file_diff, change.file_name)] : []
        ),
      ]),
    [diffsChanges, writeFileChanges]
  );
  const summary = useMemo(() => summarizeFileChanges(fileChanges), [fileChanges]);

  const handleFileClick = useCallback(
    (file: FileChangeInfo) => {
      const { contentType, editable, language } = getFileTypeInfo(file.file_name);
      void launchPreview({
        relativePath: file.fullPath,
        file_name: file.file_name,
        contentType,
        editable,
        language,
        fallbackContent: editable ? extractContentFromDiff(file.diff) : undefined,
        diffContent: file.diff,
      });
    },
    [launchPreview]
  );

  const handleDiffClick = useCallback(
    (file: FileChangeInfo) => {
      void launchPreview({
        file_name: file.file_name,
        contentType: 'diff',
        editable: false,
        language: 'diff',
        diffContent: file.diff,
      });
    },
    [launchPreview]
  );

  if (fileChanges.length === 0) return null;

  if (isProcessing) {
    return (
      <Card className={classNames(styles.card, 'w-full box-border', className)} data-testid='file-change-summary'>
        <div className='flex items-center gap-8px text-14px text-t-secondary' aria-live='polite'>
          <Spin size={16} />
          <span>{t('messages.fileChangeSummary.organizing')}</span>
        </div>
      </Card>
    );
  }

  const distribution = (['added', 'modified', 'deleted', 'conflicted'] as const)
    .filter((status) => summary.counts[status] > 0)
    .map((status) => t(`messages.fileChangeSummary.distribution.${status}`, { count: summary.counts[status] }))
    .join(' · ');
  const visibleFiles = fileChanges.slice(0, MAX_VISIBLE_FILES);
  const hasLineChanges = summary.insertions > 0 || summary.deletions > 0;

  return (
    <Card className={classNames(styles.card, 'w-full box-border', className)} data-testid='file-change-summary'>
      <div className='flex flex-wrap items-center gap-x-12px gap-y-8px'>
        <div
          className={classNames(
            'size-32px shrink-0 rounded-full flex-center',
            failedFiles > 0 ? 'bg-warning-light-1 text-warning' : 'bg-success-light-1 text-success'
          )}
        >
          {failedFiles > 0 ? <Attention theme='outline' size='16' /> : <Change theme='outline' size='16' />}
        </div>
        <div className='min-w-120px flex-1'>
          <div className='text-14px font-medium text-t-primary'>
            {failedFiles > 0
              ? t('messages.fileChangeSummary.partialFailure', {
                  changed: fileChanges.length,
                  failed: failedFiles,
                })
              : t('messages.fileChangeSummary.title', { count: fileChanges.length })}
          </div>
          <div className='mt-4px text-12px text-t-secondary'>{distribution}</div>
        </div>
        {hasLineChanges && (
          <div className='flex items-center gap-8px' aria-label={t('messages.fileChangeSummary.lineChanges')}>
            <Tag className='!m-0 !rounded-12px !border-0 !bg-success-light-1 !text-success'>+{summary.insertions}</Tag>
            <Tag className='!m-0 !rounded-12px !border-0 !bg-danger-light-1 !text-danger'>-{summary.deletions}</Tag>
          </div>
        )}
        <Button
          type='text'
          size='small'
          onClick={() => dispatchWorkspaceOpenChangesEvent(conversation?.conversation_id)}
        >
          {t('messages.fileChangeSummary.viewChanges')}
          <Right theme='outline' size='14' />
        </Button>
      </div>

      <div className='mt-8px flex items-center'>
        <Button type='text' size='mini' onClick={() => setExpanded((value) => !value)}>
          {expanded ? t('messages.fileChangeSummary.collapse') : t('messages.fileChangeSummary.expand')}
          <Down theme='outline' size='13' className={classNames('transition-transform', expanded && 'rotate-180')} />
        </Button>
      </div>

      {expanded && (
        <div className='mt-8px pt-4px border-t border-solid border-b-base'>
          {visibleFiles.map((file) => (
            <div key={file.fullPath} className='w-full flex items-center gap-4px'>
              <Button
                type='text'
                className={classNames(styles.fileButton, '!flex !min-w-0 !text-left')}
                onClick={() => (file.diff ? handleDiffClick(file) : handleFileClick(file))}
                aria-label={t(
                  file.diff ? 'messages.fileChangeSummary.openDiff' : 'messages.fileChangeSummary.previewFile',
                  { file: file.file_name }
                )}
              >
                <span className='w-full min-w-0 flex items-center gap-8px'>
                  <span
                    className={classNames('size-24px shrink-0 rounded-full flex-center', STATUS_CLASSES[file.status])}
                  >
                    {STATUS_ICONS[file.status]}
                  </span>
                  <span className='min-w-0 flex-1 truncate text-13px text-t-primary'>{file.fullPath}</span>
                  <span className='shrink-0 text-12px text-t-secondary'>
                    {file.insertions > 0 && <span className='text-success'>+{file.insertions}</span>}
                    {file.insertions > 0 && file.deletions > 0 && ' / '}
                    {file.deletions > 0 && <span className='text-danger'>-{file.deletions}</span>}
                  </span>
                  <Tag className={classNames('!m-0 !border-0', STATUS_CLASSES[file.status])}>
                    {t(`messages.fileChangeSummary.status.${file.status}`)}
                  </Tag>
                </span>
              </Button>
              {file.diff && (
                <Button
                  type='text'
                  size='mini'
                  aria-label={t('messages.fileChangeSummary.previewFile', { file: file.file_name })}
                  onClick={() => handleFileClick(file)}
                >
                  <Right theme='outline' size='13' />
                </Button>
              )}
            </div>
          ))}
          {fileChanges.length > MAX_VISIBLE_FILES && (
            <div className='px-4px pt-8px text-12px text-t-tertiary'>
              {t('messages.fileChangeSummary.fileLimit', {
                total: fileChanges.length,
                visible: MAX_VISIBLE_FILES,
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default React.memo(MessageFileChanges);
