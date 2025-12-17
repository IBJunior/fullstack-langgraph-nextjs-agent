import React, { createContext, useContext, useState } from "react";
import {
  getActiveThreadId,
  setActiveThreadId as saveActiveThreadId,
} from "@/lib/storage/localStorage";

interface ThreadContextType {
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
}

const ThreadContext = createContext<ThreadContextType | null>(null);

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  // Initialize from localStorage
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(() => {
    return getActiveThreadId();
  });

  const setActiveThreadId = (threadId: string | null) => {
    setActiveThreadIdState(threadId);
    saveActiveThreadId(threadId);
  };

  return (
    <ThreadContext.Provider value={{ activeThreadId, setActiveThreadId }}>
      {children}
    </ThreadContext.Provider>
  );
}

export function useThreadContext() {
  const context = useContext(ThreadContext);
  if (!context) {
    throw new Error("useThreadContext must be used within a ThreadProvider");
  }
  return context;
}
