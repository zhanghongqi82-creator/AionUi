/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * useAutoScroll - Auto-scroll hook for a plain scroll container
 *
 * Strategy:
 * - Track whether the user has intentionally scrolled away from the bottom.
 * - Observe content/scroller size changes and keep the list pinned to bottom
 *   only while auto-follow mode is active.
 * - Use DOM-native scrollIntoView for explicit message jumps.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TMessage } from '@/common/chat/chatLib';

const PROGRAMMATIC_SCROLL_GUARD_MS = 150;
const AT_BOTTOM_THRESHOLD_PX = 100;
const FOLLOW_BOTTOM_THRESHOLD_PX = 4;

interface UseAutoScrollOptions {
  messages: TMessage[];
  itemCount: number;
  conversationId?: string;
}

interface ScrollElementIntoViewOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  preserveUnread?: boolean;
}

interface UseAutoScrollReturn {
  handleScrollerRef: (ref: HTMLDivElement | null) => void;
  handleContentRef: (ref: HTMLDivElement | null) => void;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  handleWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  handlePointerDown: () => void;
  showScrollButton: boolean;
  unreadCount: number;
  firstUnreadMessageId?: string;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollElementIntoView: (element: HTMLElement | null, options?: ScrollElementIntoViewOptions) => void;
  markUnreadRead: () => void;
  hideScrollButton: () => void;
}

type ConversationScrollMemory = {
  scrollTop: number;
  userScrolled: boolean;
  unreadCount: number;
  firstUnreadMessageId?: string;
};

const conversationScrollMemory = new Map<string, ConversationScrollMemory>();

const getBottomGap = (element: HTMLElement): number => {
  return element.scrollHeight - element.clientHeight - element.scrollTop;
};

export function useAutoScroll({ messages, itemCount, conversationId }: UseAutoScrollOptions): UseAutoScrollReturn {
  const initialMemory = conversationId ? conversationScrollMemory.get(conversationId) : undefined;
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(initialMemory?.userScrolled ?? false);
  const [unreadCount, setUnreadCount] = useState(initialMemory?.unreadCount ?? 0);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(initialMemory?.firstUnreadMessageId);

  const userScrolledRef = useRef(initialMemory?.userScrolled ?? false);
  const lastScrollTopRef = useRef(initialMemory?.scrollTop ?? 0);
  const previousLastMessageRef = useRef<TMessage | undefined>(messages[messages.length - 1]);
  const lastProgrammaticScrollTimeRef = useRef(0);
  const initialScrollDoneRef = useRef(false);
  const pendingAutoFollowFrameRef = useRef<number | null>(null);
  const userInputActiveRef = useRef(false);
  const unreadCountRef = useRef(initialMemory?.unreadCount ?? 0);
  const firstUnreadMessageIdRef = useRef<string | undefined>(initialMemory?.firstUnreadMessageId);

  const persistScrollMemory = useCallback(
    (element: HTMLDivElement, userScrolled: boolean) => {
      if (!conversationId) return;
      conversationScrollMemory.set(conversationId, {
        scrollTop: element.scrollTop,
        userScrolled,
        unreadCount: unreadCountRef.current,
        firstUnreadMessageId: firstUnreadMessageIdRef.current,
      });
    },
    [conversationId]
  );

  const updateUnreadState = useCallback(
    (count: number, anchorId?: string) => {
      unreadCountRef.current = count;
      firstUnreadMessageIdRef.current = anchorId;
      setUnreadCount(count);
      setFirstUnreadMessageId(anchorId);

      if (!conversationId) return;
      const memory = conversationScrollMemory.get(conversationId);
      conversationScrollMemory.set(conversationId, {
        scrollTop: memory?.scrollTop ?? 0,
        userScrolled: memory?.userScrolled ?? userScrolledRef.current,
        unreadCount: count,
        firstUnreadMessageId: anchorId,
      });
    },
    [conversationId]
  );

  const markProgrammaticScroll = useCallback(() => {
    lastProgrammaticScrollTimeRef.current = Date.now();
  }, []);

  const updateBottomState = useCallback(
    (element: HTMLDivElement) => {
      const bottomGap = getBottomGap(element);
      const withinButtonThreshold = bottomGap <= AT_BOTTOM_THRESHOLD_PX;
      const pinnedToBottom = bottomGap <= FOLLOW_BOTTOM_THRESHOLD_PX;
      setShowScrollButton(!withinButtonThreshold);

      if (pinnedToBottom) {
        userScrolledRef.current = false;
        userInputActiveRef.current = false;
        lastProgrammaticScrollTimeRef.current = Date.now() - (PROGRAMMATIC_SCROLL_GUARD_MS - 50);
        if (unreadCountRef.current > 0 || firstUnreadMessageIdRef.current) {
          updateUnreadState(0);
        }
      }

      persistScrollMemory(element, userScrolledRef.current);
      return pinnedToBottom;
    },
    [persistScrollMemory, updateUnreadState]
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      if (itemCount <= 0 || !scrollerEl) return;

      markProgrammaticScroll();
      scrollerEl.scrollTo({
        top: scrollerEl.scrollHeight - scrollerEl.clientHeight,
        behavior,
      });
      userScrolledRef.current = false;
      setShowScrollButton(false);
      updateUnreadState(0);
    },
    [itemCount, markProgrammaticScroll, scrollerEl, updateUnreadState]
  );

  const scheduleAutoFollow = useCallback(() => {
    if (!scrollerEl || userScrolledRef.current) return;

    if (pendingAutoFollowFrameRef.current !== null) {
      cancelAnimationFrame(pendingAutoFollowFrameRef.current);
    }

    pendingAutoFollowFrameRef.current = requestAnimationFrame(() => {
      pendingAutoFollowFrameRef.current = null;
      if (!scrollerEl || userScrolledRef.current) return;

      const gap = getBottomGap(scrollerEl);
      if (gap > 2) {
        scrollToBottom('auto');
      }
    });
  }, [scrollerEl, scrollToBottom]);

  const handleScrollerRef = useCallback(
    (ref: HTMLDivElement | null) => {
      if (!ref && scrollerEl) {
        persistScrollMemory(scrollerEl, userScrolledRef.current);
      }

      setScrollerEl(ref);
      if (!ref || !conversationId || initialScrollDoneRef.current) return;

      const memory = conversationScrollMemory.get(conversationId);
      if (!memory || !memory.userScrolled) return;

      ref.scrollTop = memory.scrollTop;
      lastScrollTopRef.current = memory.scrollTop;
      userScrolledRef.current = true;
      initialScrollDoneRef.current = true;
      setShowScrollButton(true);
    },
    [conversationId, persistScrollMemory, scrollerEl]
  );

  const handleContentRef = useCallback((ref: HTMLDivElement | null) => {
    setContentEl(ref);
  }, []);

  const scrollElementIntoView = useCallback(
    (element: HTMLElement | null, options?: ScrollElementIntoViewOptions) => {
      if (!element) return;

      if (!options?.preserveUnread) {
        userScrolledRef.current = false;
        setShowScrollButton(false);
        updateUnreadState(0);
      }
      markProgrammaticScroll();
      element.scrollIntoView({
        behavior: options?.behavior ?? 'smooth',
        block: options?.block ?? 'start',
        inline: 'nearest',
      });
    },
    [markProgrammaticScroll, updateUnreadState]
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const currentScrollTop = target.scrollTop;
      const timeSinceGuard = Date.now() - lastProgrammaticScrollTimeRef.current;
      const delta = currentScrollTop - lastScrollTopRef.current;
      const bottomGap = getBottomGap(target);
      const pinnedToBottom = bottomGap <= FOLLOW_BOTTOM_THRESHOLD_PX;

      if (
        !pinnedToBottom &&
        Math.abs(delta) > 2 &&
        (userInputActiveRef.current || timeSinceGuard >= PROGRAMMATIC_SCROLL_GUARD_MS)
      ) {
        userScrolledRef.current = true;
      }

      if (pinnedToBottom) {
        userInputActiveRef.current = false;
      } else if (Math.abs(delta) > 2) {
        userInputActiveRef.current = false;
      }

      lastScrollTopRef.current = currentScrollTop;
      updateBottomState(target);
    },
    [updateBottomState]
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) > 0 || Math.abs(e.deltaX) > 0) {
      userInputActiveRef.current = true;
    }
  }, []);

  const handlePointerDown = useCallback(() => {
    userInputActiveRef.current = true;
  }, []);

  useEffect(() => {
    if (!scrollerEl || !contentEl) return;

    const observer = new ResizeObserver(() => {
      scheduleAutoFollow();
      updateBottomState(scrollerEl);
    });

    observer.observe(scrollerEl);
    observer.observe(contentEl);

    return () => observer.disconnect();
  }, [contentEl, scheduleAutoFollow, scrollerEl, updateBottomState]);

  useEffect(() => {
    if (!scrollerEl || initialScrollDoneRef.current || itemCount === 0) return;

    initialScrollDoneRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom('auto');
      lastScrollTopRef.current = scrollerEl.scrollTop;
    });
  }, [itemCount, scrollerEl, scrollToBottom]);

  useEffect(() => {
    const currentListLength = messages.length;
    const lastMessage = messages[messages.length - 1];
    const previousLastMessage = previousLastMessageRef.current;
    const previousLastIndex = previousLastMessage
      ? messages.findIndex((message) => message.id === previousLastMessage.id)
      : -1;
    const appendedMessages = previousLastIndex >= 0 ? messages.slice(previousLastIndex + 1) : [];
    const isNewMessage = appendedMessages.length > 0;
    const isLastMessageUpdated = currentListLength > 0 && lastMessage !== previousLastMessage;

    previousLastMessageRef.current = lastMessage;

    if (!isNewMessage) {
      if (isLastMessageUpdated) {
        scheduleAutoFollow();
      }
      return;
    }

    if (lastMessage?.position !== 'right') {
      const newAssistantMessages = appendedMessages.filter((message) => message.position === 'left');
      if (userScrolledRef.current && newAssistantMessages.length > 0) {
        const anchorId = firstUnreadMessageIdRef.current ?? newAssistantMessages[0]?.id;
        updateUnreadState(unreadCountRef.current + newAssistantMessages.length, anchorId);
        setShowScrollButton(true);
        return;
      }
      scheduleAutoFollow();
      return;
    }

    userScrolledRef.current = false;
    updateUnreadState(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    });
  }, [messages, scheduleAutoFollow, scrollToBottom, updateUnreadState]);

  useEffect(() => {
    return () => {
      if (pendingAutoFollowFrameRef.current !== null) {
        cancelAnimationFrame(pendingAutoFollowFrameRef.current);
      }
      if (scrollerEl) {
        persistScrollMemory(scrollerEl, userScrolledRef.current);
      }
    };
  }, [persistScrollMemory, scrollerEl]);

  const markUnreadRead = useCallback(() => {
    updateUnreadState(0, firstUnreadMessageIdRef.current);
  }, [updateUnreadState]);

  const hideScrollButton = useCallback(() => {
    userScrolledRef.current = false;
    setShowScrollButton(false);
    updateUnreadState(0);
  }, [updateUnreadState]);

  return {
    handleScrollerRef,
    handleContentRef,
    handleScroll,
    handleWheel,
    handlePointerDown,
    showScrollButton,
    unreadCount,
    firstUnreadMessageId,
    scrollToBottom,
    scrollElementIntoView,
    markUnreadRead,
    hideScrollButton,
  };
}
