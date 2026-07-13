/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigateMock, locationMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  locationMock: {
    pathname: '/scheduled',
    search: '',
    hash: '',
    state: null as unknown,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationMock,
}));

vi.mock('@renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@renderer/pages/cron/useCronJobs', () => ({
  useAllCronJobs: () => ({
    jobs: [],
    loading: false,
    pauseJob: vi.fn(),
    resumeJob: vi.fn(),
  }),
}));

vi.mock('@renderer/pages/conversation/hooks/useConversationAssistants', () => ({
  useConversationAssistants: () => ({ presetAssistants: [] }),
}));

vi.mock('@renderer/utils/model/agentLogo', () => ({
  useAgentLogos: () => ({}),
}));

vi.mock('@/common/config/configService', () => ({
  configService: {
    get: vi.fn(() => false),
    setLocal: vi.fn(),
  },
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  systemSettings: {
    setKeepAwake: { invoke: vi.fn() },
  },
}));

vi.mock('@/renderer/components/base/TalkToButlerButton', () => ({
  default: () => null,
}));

vi.mock('@/renderer/pages/cron/ScheduledTasksPage/CreateTaskDialog', () => ({
  default: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid='create-task-dialog'>Create task</div> : null,
}));

import ScheduledTasksPage from '@/renderer/pages/cron/ScheduledTasksPage';

describe('ScheduledTasksPage command palette navigation', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    locationMock.state = null;
  });

  it('opens the create dialog once and clears the navigation intent', async () => {
    locationMock.state = { openCreateTask: true };

    render(<ScheduledTasksPage />);

    expect(screen.getByTestId('create-task-dialog')).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/scheduled', { replace: true, state: null });
    });
  });
});
