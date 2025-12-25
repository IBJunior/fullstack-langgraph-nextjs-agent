import type { MessageOptions, MessageResponse, Thread } from "@/types/message";

export interface ChatServiceConfig {
  baseUrl?: string;
  endpoints?: {
    history?: string;
    chat?: string;
    stream?: string;
    threads?: string;
  };
  headers?: Record<string, string>;
}

const config: ChatServiceConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "/api/agent",
  endpoints: {
    history: "/history",
    chat: "/chat",
    stream: "/stream",
    threads: "/threads",
  },
};

function getUrl(endpoint: keyof Required<ChatServiceConfig>["endpoints"]): string {
  return `${config.baseUrl}${config.endpoints?.[endpoint] || ""}`;
}

export async function fetchMessageHistory(threadId: string): Promise<MessageResponse[]> {
  const response = await fetch(`${getUrl("history")}/${threadId}`, {
    headers: config.headers,
  });
  if (!response.ok) {
    throw new Error("Failed to load history");
  }
  const data = await response.json();
  return data as MessageResponse[];
}

export function createMessageStream(
  threadId: string,
  message: string,
  opts?: MessageOptions,
): EventSource {
  const params = new URLSearchParams({ content: message, threadId });
  if (opts?.model) params.set("model", opts.model);
  if (opts?.tools?.length) params.set("tools", opts.tools.join(","));
  if (opts?.allowTool) params.set("allowTool", opts.allowTool);
  if (opts?.approveAllTools !== undefined)
    params.set("approveAllTools", opts.approveAllTools ? "true" : "false");
  if (opts?.attachments && opts.attachments.length > 0) {
    // Serialize attachments as JSON string for query parameter
    params.set("attachments", JSON.stringify(opts.attachments));
  }
  return new EventSource(`${getUrl("stream")}?${params}`);
}

export async function fetchThreads(): Promise<Thread[]> {
  const response = await fetch(getUrl("threads"), {
    headers: config.headers,
  });
  if (!response.ok) {
    throw new Error("Failed to load threads");
  }
  return await response.json();
}

export async function createNewThread(): Promise<Thread> {
  const response = await fetch(getUrl("threads"), {
    method: "POST",
    headers: config.headers,
  });
  if (!response.ok) {
    throw new Error("Failed to create thread");
  }
  return await response.json();
}

export async function deleteThread(threadId: string): Promise<void> {
  const response = await fetch(getUrl("threads"), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify({ id: threadId }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete thread");
  }
}
