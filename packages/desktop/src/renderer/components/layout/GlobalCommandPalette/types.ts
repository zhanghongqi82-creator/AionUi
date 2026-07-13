/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CommandPaletteItemKind = 'action' | 'navigation' | 'assistant' | 'model' | 'workspace' | 'conversation';

export type CommandPaletteIcon =
  | 'newConversation'
  | 'folder'
  | 'scheduled'
  | 'assistant'
  | 'skills'
  | 'tools'
  | 'settings'
  | 'model'
  | 'conversation';

export type CommandPaletteItem = {
  id: string;
  kind: CommandPaletteItemKind;
  icon: CommandPaletteIcon;
  label: string;
  subtitle?: string;
  keywords: string[];
  shortcut?: string;
  suggested?: boolean;
  defaultRank: number;
  lastUsedAt?: number;
  unavailableReason?: string;
  unavailableAction?: string;
  execute: () => boolean | void | Promise<boolean | void>;
};

export type CommandPaletteRecentEntry = {
  id: string;
  usedAt: number;
};
