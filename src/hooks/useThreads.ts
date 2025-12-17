import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Thread } from "@/types/message";
import {
  getThreads,
  saveThread,
  deleteThread as deleteThreadStorage,
} from "@/lib/storage/localStorage";
import { useThreadContext } from "@/contexts/ThreadContext";
import { v4 as uuidv4 } from "uuid";

export interface UseThreadsReturn {
  threads: Thread[];
  activeThreadId: string | null;
  isLoadingThreads: boolean;
  threadError: Error | null;
  createThread: () => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  switchThread: (threadId: string) => void;
  refetchThreads: () => Promise<unknown>;
}

export function useThreads(): UseThreadsReturn {
  const queryClient = useQueryClient();
  const { activeThreadId, setActiveThreadId } = useThreadContext();

  const {
    data: threads = [],
    isLoading: isLoadingThreads,
    error: threadError,
    refetch: refetchThreadsQuery,
  } = useQuery<Thread[]>({
    queryKey: ["threads"],
    queryFn: () => Promise.resolve(getThreads()),
  });

  const createThread = useCallback(async () => {
    const newThread: Thread = {
      id: uuidv4(),
      title: "New thread",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveThread(newThread);
    queryClient.setQueryData(["threads"], (old: Thread[] = []) => [newThread, ...old]);
    setActiveThreadId(newThread.id);

    return newThread;
  }, [queryClient, setActiveThreadId]);

  const deleteThreadCallback = useCallback(
    async (threadId: string) => {
      deleteThreadStorage(threadId);

      queryClient.setQueryData(["threads"], (old: Thread[] = []) =>
        old.filter((thread) => thread.id !== threadId),
      );

      if (activeThreadId === threadId) {
        setActiveThreadId(null);
      }

      queryClient.removeQueries({ queryKey: ["messages", threadId] });
    },
    [queryClient, setActiveThreadId, activeThreadId],
  );

  const switchThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
    },
    [setActiveThreadId],
  );

  return {
    threads,
    activeThreadId,
    isLoadingThreads,
    threadError: threadError as Error | null,
    createThread,
    deleteThread: deleteThreadCallback,
    switchThread,
    refetchThreads: refetchThreadsQuery,
  };
}
