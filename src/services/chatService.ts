import type { MessageOptions, MessageResponse } from "@/types/message";

export interface ChatServiceConfig {
  baseUrl?: string;
  endpoints?: {
    stream?: string;
  };
  headers?: Record<string, string>;
}

const config: ChatServiceConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "/api/agent",
  endpoints: {
    stream: "/stream",
  },
};

function getUrl(endpoint: keyof Required<ChatServiceConfig>["endpoints"]): string {
  return `${config.baseUrl}${config.endpoints?.[endpoint] || ""}`;
}

/**
 * Creates an EventSource for streaming agent responses.
 * Now includes message history in the request.
 */
export function createMessageStream(
  threadId: string,
  message: string,
  history: MessageResponse[],
  opts?: MessageOptions,
): EventSource {
  const params = new URLSearchParams({
    content: message,
    threadId,
    history: JSON.stringify(history), // Send history to server
  });

  if (opts?.model) params.set("model", opts.model);
  if (opts?.tools?.length) params.set("tools", opts.tools.join(","));
  if (opts?.allowTool) params.set("allowTool", opts.allowTool);
  if (opts?.approveAllTools !== undefined)
    params.set("approveAllTools", opts.approveAllTools ? "true" : "false");

  return new EventSource(`${getUrl("stream")}?${params}`);
}
