import type { Thread, MessageResponse } from "@/types/message";

// Storage keys
const THREADS_KEY = "stackpath_threads";
const MESSAGES_KEY_PREFIX = "stackpath_messages_";
const ACTIVE_THREAD_KEY = "stackpath_active_thread";

/**
 * Thread operations
 */
export function getThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(THREADS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load threads:", error);
    return [];
  }
}

export function saveThread(thread: Thread): void {
  if (typeof window === "undefined") return;
  try {
    const threads = getThreads();
    const index = threads.findIndex((t) => t.id === thread.id);

    const updatedThread = {
      ...thread,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      threads[index] = updatedThread;
    } else {
      threads.unshift(updatedThread);
    }
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch (error) {
    console.error("Failed to save thread:", error);
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("localStorage quota exceeded. Consider clearing old threads.");
    }
  }
}

export function deleteThread(threadId: string): void {
  if (typeof window === "undefined") return;
  try {
    const threads = getThreads().filter((t) => t.id !== threadId);
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
    localStorage.removeItem(`${MESSAGES_KEY_PREFIX}${threadId}`);
  } catch (error) {
    console.error("Failed to delete thread:", error);
  }
}

export function getThread(threadId: string): Thread | null {
  const threads = getThreads();
  return threads.find((t) => t.id === threadId) || null;
}

/**
 * Message operations
 */
export function getMessages(threadId: string): MessageResponse[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(`${MESSAGES_KEY_PREFIX}${threadId}`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load messages:", error);
    return [];
  }
}

export function saveMessages(threadId: string, messages: MessageResponse[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${MESSAGES_KEY_PREFIX}${threadId}`, JSON.stringify(messages));

    // Update thread's updatedAt timestamp
    const thread = getThread(threadId);
    if (thread) {
      saveThread(thread);
    }
  } catch (error) {
    console.error("Failed to save messages:", error);

    // If we hit storage quota, try to handle gracefully
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("localStorage quota exceeded. Consider clearing old threads.");
    }
  }
}

/**
 * Active thread persistence
 */
export function getActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_THREAD_KEY);
}

export function setActiveThreadId(threadId: string | null): void {
  if (typeof window === "undefined") return;
  if (threadId) {
    localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
  } else {
    localStorage.removeItem(ACTIVE_THREAD_KEY);
  }
}

/**
 * Storage management utilities
 */
export function getStorageSize(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  return total;
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage).filter((key) => key.startsWith("stackpath_"));
  keys.forEach((key) => localStorage.removeItem(key));
}
