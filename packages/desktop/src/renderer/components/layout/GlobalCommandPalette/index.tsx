/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import type { Assistant } from '@/common/types/agent/assistantTypes';
import { resolveLocaleKey } from '@/common/utils';
import AionModal from '@/renderer/components/base/AionModal';
import { addRecentWorkspace, getRecentWorkspaces } from '@/renderer/components/workspace/recentWorkspaces';
import { Button, Empty, Input, Message, Spin } from '@arco-design/web-react';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';
import {
  ApplicationOne,
  Calendar,
  CloseSmall,
  Cpu,
  FolderOpen,
  MessageOne,
  Plus,
  Robot,
  Search,
  SettingTwo,
  Tool,
} from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
  getFuzzyMatchIndices,
  getSuggestedCommandPaletteItems,
  readRecentCommandPaletteEntries,
  recordRecentCommandPaletteEntry,
  searchCommandPaletteItems,
} from './commandPaletteSearch';
import styles from './GlobalCommandPalette.module.css';
import type { CommandPaletteIcon, CommandPaletteItem } from './types';

type PaletteCatalog = {
  assistants: Assistant[];
  conversations: TChatConversation[];
};

type PaletteEventPhase = 'exposure' | 'selection' | 'cancel' | 'completion';

const EMPTY_CATALOG: PaletteCatalog = { assistants: [], conversations: [] };

function emitPaletteEvent(phase: PaletteEventPhase, itemId?: string): void {
  window.dispatchEvent(
    new CustomEvent('aionui:global-command-palette', {
      detail: { phase, itemId },
    })
  );
}

function getWorkspaceName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function renderHighlightedLabel(label: string, query: string): React.ReactNode {
  const matchedIndices = new Set(getFuzzyMatchIndices(label, query));
  if (matchedIndices.size === 0) return label;

  return Array.from(label).map((character, index) =>
    matchedIndices.has(index) ? (
      <mark key={`${index}-${character}`} className={styles.highlight}>
        {character}
      </mark>
    ) : (
      <React.Fragment key={`${index}-${character}`}>{character}</React.Fragment>
    )
  );
}

const iconByKind: Record<CommandPaletteIcon, React.ReactNode> = {
  newConversation: <Plus size={18} />,
  folder: <FolderOpen size={18} />,
  scheduled: <Calendar size={18} />,
  assistant: <Robot size={18} />,
  skills: <ApplicationOne size={18} />,
  tools: <Tool size={18} />,
  settings: <SettingTwo size={18} />,
  model: <Cpu size={18} />,
  conversation: <MessageOne size={18} />,
};

const GlobalCommandPalette: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<RefInputType>(null);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentEntries, setRecentEntries] = useState(() => readRecentCommandPaletteEntries());
  const localeKey = resolveLocaleKey(i18n.language);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const newChatKey = isMac ? '⌘N' : 'Ctrl N';
  const openProjectKey = isMac ? '⌘O' : 'Ctrl O';

  const { data: catalog = EMPTY_CATALOG, isLoading } = useSWR<PaletteCatalog>(
    visible ? 'global-command-palette.catalog' : null,
    async () => {
      const [assistants, conversationResult] = await Promise.all([
        ipcBridge.assistants.list.invoke().catch(() => [] as Assistant[]),
        ipcBridge.database.getUserConversations
          .invoke({ limit: 100 })
          .catch((): { items: TChatConversation[] } => ({ items: [] })),
      ]);
      return {
        assistants,
        conversations: Array.isArray(conversationResult?.items) ? conversationResult.items : [],
      };
    }
  );

  const closePalette = useCallback((trackCancel: boolean) => {
    setVisible(false);
    setQuery('');
    setActiveIndex(0);
    if (trackCancel) {
      emitPaletteEvent('cancel');
    }
  }, []);

  const openPalette = useCallback(() => {
    setRecentEntries(readRecentCommandPaletteEntries());
    setVisible(true);
    setQuery('');
    setActiveIndex(0);
    emitPaletteEvent('exposure');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const startNewConversation = useCallback(() => {
    navigate('/guid', { state: { resetAssistant: true } });
  }, [navigate]);

  const openProject = useCallback(async (): Promise<boolean> => {
    const selected = await ipcBridge.dialog.showOpen.invoke({
      properties: ['openDirectory', 'createDirectory'],
    });
    const workspace = selected?.[0];
    if (!workspace) return false;
    addRecentWorkspace(workspace);
    navigate('/guid', { state: { workspace } });
    return true;
  }, [navigate]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.shiftKey) return;
      if ((event as KeyboardEvent & { isComposing?: boolean }).isComposing) return;
      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();
      if (!['k', 'n', 'o'].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();

      if (key === 'k') {
        if (visible) {
          closePalette(true);
        } else {
          openPalette();
        }
        return;
      }

      closePalette(false);
      if (key === 'n') {
        startNewConversation();
        return;
      }

      void openProject().catch((error: unknown) => {
        console.error('[GlobalCommandPalette] Open project shortcut failed:', error);
        Message.error(t('common.commandPalette.operationFailed'));
      });
    };

    document.addEventListener('keydown', handleShortcut, true);
    return () => document.removeEventListener('keydown', handleShortcut, true);
  }, [closePalette, openPalette, openProject, startNewConversation, t, visible]);

  const items = useMemo<CommandPaletteItem[]>(() => {
    const staticItems: CommandPaletteItem[] = [
      {
        id: 'action:new-conversation',
        kind: 'action',
        icon: 'newConversation',
        label: t('conversation.welcome.newConversation'),
        subtitle: t('common.commandPalette.newConversationDescription'),
        keywords: [t('common.commandPalette.actionKeyword')],
        shortcut: newChatKey,
        suggested: true,
        defaultRank: 0,
        execute: startNewConversation,
      },
      {
        id: 'action:open-project',
        kind: 'action',
        icon: 'folder',
        label: t('common.commandPalette.openProject'),
        subtitle: t('common.commandPalette.openProjectDescription'),
        keywords: [t('common.workspace'), t('common.folder')],
        shortcut: openProjectKey,
        suggested: true,
        defaultRank: 1,
        execute: openProject,
      },
      {
        id: 'action:create-scheduled-task',
        kind: 'action',
        icon: 'scheduled',
        label: t('common.commandPalette.createScheduledTask'),
        subtitle: t('cron.scheduledTasks'),
        keywords: [t('cron.scheduledTasks')],
        suggested: true,
        defaultRank: 2,
        execute: () => navigate('/scheduled', { state: { openCreateTask: true } }),
      },
      {
        id: 'navigation:assistants',
        kind: 'navigation',
        icon: 'assistant',
        label: t('settings.assistants'),
        subtitle: t('common.commandPalette.navigationDescription'),
        keywords: [t('common.commandPalette.assistantKeyword')],
        suggested: true,
        defaultRank: 3,
        execute: () => navigate('/assistants'),
      },
      {
        id: 'navigation:skills',
        kind: 'navigation',
        icon: 'skills',
        label: t('common.skills'),
        subtitle: t('common.commandPalette.navigationDescription'),
        keywords: [t('settings.skills')],
        suggested: true,
        defaultRank: 4,
        execute: () => navigate('/settings/skills'),
      },
      {
        id: 'navigation:tools',
        kind: 'navigation',
        icon: 'tools',
        label: t('settings.tools'),
        subtitle: t('common.commandPalette.navigationDescription'),
        keywords: [t('mcp.tools')],
        defaultRank: 5,
        execute: () => navigate('/settings/tools'),
      },
      {
        id: 'navigation:model-settings',
        kind: 'navigation',
        icon: 'model',
        label: t('common.commandPalette.modelSettings'),
        subtitle: t('common.commandPalette.navigationDescription'),
        keywords: [t('common.model')],
        defaultRank: 6,
        execute: () => navigate('/settings/model'),
      },
      {
        id: 'navigation:settings',
        kind: 'navigation',
        icon: 'settings',
        label: t('common.settings'),
        subtitle: t('common.commandPalette.navigationDescription'),
        keywords: [t('settings.title')],
        defaultRank: 7,
        execute: () => navigate('/settings/agent'),
      },
    ];

    const assistantItems = catalog.assistants
      .filter((assistant) => assistant.enabled !== false)
      .flatMap<CommandPaletteItem>((assistant, assistantIndex) => {
        const assistantName = assistant.name_i18n?.[localeKey] || assistant.name;
        const unavailable = assistant.agent_status !== 'online';
        const assistantItem: CommandPaletteItem = {
          id: `assistant:${assistant.id}`,
          kind: 'assistant',
          icon: 'assistant',
          label: assistantName,
          subtitle: unavailable
            ? assistant.agent_status_message || t('common.commandPalette.assistantUnavailable')
            : t('common.commandPalette.switchAssistant'),
          keywords: [t('common.commandPalette.assistantKeyword'), assistant.description || ''],
          defaultRank: 100 + assistantIndex,
          unavailableReason: unavailable ? assistant.agent_status_message || assistant.agent_status : undefined,
          unavailableAction: unavailable ? t('common.commandPalette.viewSetup') : undefined,
          execute: () =>
            unavailable
              ? navigate('/assistants', {
                  state: { openAssistantId: assistant.id, openAssistantEditor: true },
                })
              : navigate('/guid', { state: { selectedAssistantId: assistant.id } }),
        };

        const models = Array.isArray(assistant.models) ? assistant.models : [];
        const modelItems = models.map<CommandPaletteItem>((model, modelIndex) => ({
          id: `model:${assistant.id}:${model}`,
          kind: 'model',
          icon: 'model',
          label: model,
          subtitle: `${assistantName} · ${t('common.commandPalette.switchModel')}`,
          keywords: [assistantName, t('common.model')],
          defaultRank: 200 + assistantIndex * 20 + modelIndex,
          execute: () =>
            navigate('/guid', {
              state: { selectedAssistantId: assistant.id, selectedModelId: model },
            }),
        }));

        return [assistantItem, ...modelItems];
      });

    const workspaceItems = getRecentWorkspaces().map<CommandPaletteItem>((workspace, index) => ({
      id: `workspace:${workspace}`,
      kind: 'workspace',
      icon: 'folder',
      label: getWorkspaceName(workspace),
      subtitle: workspace,
      keywords: [t('common.workspace'), t('common.commandPalette.recentWorkspace')],
      defaultRank: 300 + index,
      execute: () => navigate('/guid', { state: { workspace } }),
    }));

    const conversationItems = [...catalog.conversations]
      .toSorted((left, right) => right.modified_at - left.modified_at)
      .slice(0, 30)
      .map<CommandPaletteItem>((conversation, index) => ({
        id: `conversation:${conversation.id}`,
        kind: 'conversation',
        icon: 'conversation',
        label: conversation.name || t('conversation.historySearch.untitled'),
        subtitle: t('common.commandPalette.recentConversation'),
        keywords: [conversation.desc || '', conversation.extra?.workspace || ''],
        defaultRank: 400 + index,
        execute: () => navigate(`/conversation/${conversation.id}`),
      }));

    const recentById = new Map(recentEntries.map((entry) => [entry.id, entry.usedAt]));
    return [...staticItems, ...assistantItems, ...workspaceItems, ...conversationItems].map((item) => ({
      ...item,
      lastUsedAt: recentById.get(item.id) ?? item.lastUsedAt,
    }));
  }, [
    catalog.assistants,
    catalog.conversations,
    localeKey,
    navigate,
    newChatKey,
    openProject,
    openProjectKey,
    recentEntries,
    startNewConversation,
    t,
  ]);

  const trimmedQuery = query.trim();
  const results = useMemo(
    () => (trimmedQuery ? searchCommandPaletteItems(items, trimmedQuery) : getSuggestedCommandPaletteItems(items)),
    [items, trimmedQuery]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedQuery, results.length]);

  const executeItem = useCallback(
    async (item: CommandPaletteItem) => {
      emitPaletteEvent('selection', item.id);
      closePalette(false);
      try {
        const completed = await item.execute();
        if (completed === false) return;
        const nextRecentEntries = recordRecentCommandPaletteEntry(item.id);
        setRecentEntries(nextRecentEntries);
        emitPaletteEvent('completion', item.id);
      } catch (error) {
        console.error('[GlobalCommandPalette] Command failed:', error);
        Message.error(t('common.commandPalette.operationFailed'));
      }
    },
    [closePalette, t]
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) {
        setActiveIndex((current) => (current + 1) % results.length);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) {
        setActiveIndex((current) => (current - 1 + results.length) % results.length);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const activeItem = results[activeIndex];
      if (activeItem) void executeItem(activeItem);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePalette(true);
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={() => closePalette(true)}
      footer={null}
      showCustomClose={false}
      unmountOnExit
      autoFocus={false}
      focusLock
      className={styles.modal}
      wrapStyle={{ zIndex: 10020 }}
      maskStyle={{
        zIndex: 10010,
        background: 'var(--color-mask-bg)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
      style={{ width: 'auto', padding: 0, background: 'transparent', boxShadow: 'none' }}
      contentStyle={{ padding: 0, overflow: 'hidden', background: 'transparent' }}
    >
      <div className={styles.panel} data-testid='global-command-palette'>
        <div className={styles.searchRow}>
          <Search className={styles.searchIcon} size={20} />
          <Input
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onKeyDown={handleInputKeyDown}
            placeholder={t('common.commandPalette.placeholder')}
            className={styles.searchInput}
            allowClear
            clearIcon={<CloseSmall size={16} aria-label={t('common.clear')} />}
            aria-label={t('common.commandPalette.placeholder')}
          />
        </div>

        <div className={styles.body}>
          {results.length > 0 ? (
            <>
              <div className={styles.sectionTitle}>
                {trimmedQuery ? t('common.commandPalette.results') : t('common.commandPalette.suggestions')}
                {isLoading ? <Spin className='ml-8px' size={12} /> : null}
              </div>
              <div className={styles.list} role='listbox' aria-label={t('common.commandPalette.results')}>
                {results.map((item, index) => {
                  const active = index === activeIndex;
                  return (
                    <Button
                      key={item.id}
                      type='text'
                      className={classNames(styles.item, active && styles.active)}
                      role='option'
                      aria-selected={active}
                      data-testid={`command-palette-item-${item.id}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void executeItem(item)}
                    >
                      <span className={styles.itemIcon} aria-hidden='true'>
                        {iconByKind[item.icon]}
                      </span>
                      <span className={styles.itemText}>
                        <span className={styles.itemLabel}>{renderHighlightedLabel(item.label, trimmedQuery)}</span>
                        {item.subtitle ? (
                          <span
                            className={classNames(styles.itemSubtitle, item.unavailableReason && styles.unavailable)}
                          >
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.itemMeta}>{item.unavailableAction || item.shortcut || ''}</span>
                    </Button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <Empty description={t('common.commandPalette.noResults', { query: trimmedQuery })} />
              <Button type='text' className={styles.emptySuggestion} onClick={() => setQuery(t('cron.scheduledTasks'))}>
                {t('common.commandPalette.tryScheduledTasks')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AionModal>
  );
};

export default GlobalCommandPalette;
