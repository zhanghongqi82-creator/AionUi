/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import { Analysis, Bug, Edit, FolderOpen } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './QuickTaskCards.module.css';

export type QuickTaskId = 'analyze' | 'fix' | 'modifyUi' | 'organize';

type QuickTaskCardsProps = {
  hasInput: boolean;
  hasWorkspace: boolean;
  selectedTaskId: QuickTaskId | null;
  onSelect: (taskId: QuickTaskId, template: string) => void;
};

type QuickTask = {
  id: QuickTaskId;
  title: string;
  description: string;
  template: string;
  icon: React.ReactNode;
};

const QuickTaskCards: React.FC<QuickTaskCardsProps> = ({ hasInput, hasWorkspace, selectedTaskId, onSelect }) => {
  const { t } = useTranslation();
  const [showWhileTyping, setShowWhileTyping] = useState(false);

  useEffect(() => {
    if (!hasInput) {
      setShowWhileTyping(false);
    }
  }, [hasInput]);

  const tasks = useMemo<QuickTask[]>(() => {
    const context = hasWorkspace ? 'Project' : 'General';

    return [
      {
        id: 'analyze',
        title: t(`guid.quickTasks.analyze.title${context}`),
        description: t(`guid.quickTasks.analyze.description${context}`),
        template: t(`guid.quickTasks.analyze.template${context}`),
        icon: <Analysis size={20} />,
      },
      {
        id: 'fix',
        title: t('guid.quickTasks.fix.title'),
        description: t(`guid.quickTasks.fix.description${context}`),
        template: t(`guid.quickTasks.fix.template${context}`),
        icon: <Bug size={20} />,
      },
      {
        id: 'modifyUi',
        title: t('guid.quickTasks.modifyUi.title'),
        description: t(`guid.quickTasks.modifyUi.description${context}`),
        template: t(`guid.quickTasks.modifyUi.template${context}`),
        icon: <Edit size={20} />,
      },
      {
        id: 'organize',
        title: t('guid.quickTasks.organize.title'),
        description: t(`guid.quickTasks.organize.description${context}`),
        template: t(`guid.quickTasks.organize.template${context}`),
        icon: <FolderOpen size={20} />,
      },
    ];
  }, [hasWorkspace, t]);

  if (hasInput && !showWhileTyping) {
    return (
      <div className={styles.collapsed}>
        <Button type='text' className={styles.showButton} onClick={() => setShowWhileTyping(true)}>
          {t('guid.quickTasks.showSuggestions')}
        </Button>
      </div>
    );
  }

  return (
    <section className={styles.root} aria-labelledby='guid-quick-task-heading'>
      <div id='guid-quick-task-heading' className={styles.heading}>
        {t('guid.quickTasks.heading')}
      </div>
      <div className={styles.grid}>
        {tasks.map((task) => (
          <Button
            key={task.id}
            type='outline'
            className={`${styles.card} ${selectedTaskId === task.id ? styles.selected : ''}`}
            aria-label={`${task.title}: ${task.description}`}
            onClick={() => onSelect(task.id, task.template)}
          >
            <span className={styles.icon} aria-hidden='true'>
              {task.icon}
            </span>
            <span className={styles.content}>
              <span className={styles.title}>{task.title}</span>
              <span className={styles.description}>{task.description}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
};

export default QuickTaskCards;
