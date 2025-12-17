import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import type { MessageResponse, AIMessageData } from "@/types/message";

/**
 * Creates ephemeral MemorySaver (no persistence)
 */
export function createMemorySaver(): MemorySaver {
  return new MemorySaver();
}

/**
 * Normalize content to string (LangChain expects string or ContentBlock[] from their types)
 */
function normalizeContent(content: string | unknown[] | unknown): string {
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content);
}

/**
 * Convert MessageResponse to LangChain BaseMessage
 */
function messageResponseToBaseMessage(msg: MessageResponse): BaseMessage {
  if (msg.type === "human") {
    return new HumanMessage({
      content: normalizeContent(msg.data.content),
      id: msg.data.id,
    });
  } else if (msg.type === "ai") {
    const aiData = msg.data as AIMessageData;
    return new AIMessage({
      content: normalizeContent(aiData.content),
      id: aiData.id,
      tool_calls: aiData.tool_calls,
      additional_kwargs: aiData.additional_kwargs,
      response_metadata: aiData.response_metadata,
    });
  } else if (msg.type === "tool") {
    return new ToolMessage({
      content: normalizeContent(msg.data.content),
      tool_call_id: msg.data.id,
    });
  }

  return new HumanMessage({
    content: normalizeContent(msg.data.content),
    id: msg.data.id,
  });
}

/**
 * KEY FUNCTION: Hydrate MemorySaver with client history
 * This allows server-side agent to have full conversation context
 */
export async function hydrateMemoryFromHistory(
  saver: MemorySaver,
  threadId: string,
  history: MessageResponse[],
): Promise<void> {
  if (!history || history.length === 0) return;

  try {
    const messages: BaseMessage[] = history.map(messageResponseToBaseMessage);

    const checkpoint = {
      v: 1,
      id: `hydrated-${Date.now()}`,
      ts: new Date().toISOString(),
      channel_values: {
        messages: messages,
      },
      channel_versions: {
        messages: messages.length,
      },
      versions_seen: {},
    };

    await saver.put({ configurable: { thread_id: threadId } }, checkpoint, {
      source: "update",
      step: -1,
      parents: {},
    });

    console.log(`Hydrated ${messages.length} messages for thread ${threadId}`);
  } catch (error) {
    console.error("Failed to hydrate memory:", error);
    // Don't throw - allow agent to continue without history
  }
}

/**
 * Get history from saver (for debugging/testing)
 */
export const getHistory = async (saver: MemorySaver, threadId: string): Promise<BaseMessage[]> => {
  try {
    const checkpoint = await saver.get({
      configurable: { thread_id: threadId },
    });
    return Array.isArray(checkpoint?.channel_values?.messages)
      ? checkpoint.channel_values.messages
      : [];
  } catch (error) {
    console.error("Failed to get history:", error);
    return [];
  }
};
