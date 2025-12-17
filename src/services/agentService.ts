import { ensureAgent } from "@/lib/agent";
import type { MessageOptions, MessageResponse, ToolCall } from "@/types/message";
import { HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

/**
 * Stream AI responses with memory hydrated from client history
 */
export async function streamResponse(params: {
  threadId: string;
  userText: string;
  history: MessageResponse[]; // NEW: client provides history
  opts?: MessageOptions;
}) {
  const { threadId, userText, history, opts } = params;

  // No longer need ensureThread - threads are client-side only

  // If allowTool is present, use Command with resume action instead of regular inputs
  const inputs = opts?.allowTool
    ? new Command({
        resume: {
          action: opts.allowTool === "allow" ? "continue" : "update",
          data: {},
        },
      })
    : {
        messages: [new HumanMessage(userText)],
      };

  // Create agent WITH HYDRATED MEMORY
  const agent = await ensureAgent(
    {
      model: opts?.model,
      tools: opts?.tools,
      approveAllTools: opts?.approveAllTools,
    },
    threadId,
    history, // Pass client history for memory hydration
  );

  // Type assertion needed for Command union with state update in v1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iterable = await agent.stream(inputs as any, {
    streamMode: ["updates"],
    configurable: { thread_id: threadId },
  });

  async function* generator(): AsyncGenerator<MessageResponse, void, unknown> {
    for await (const chunk of iterable) {
      if (!chunk) continue;

      // Handle tuple format: [type, data]
      if (Array.isArray(chunk) && chunk.length === 2) {
        const [chunkType, chunkData] = chunk;

        if (
          chunkType === "updates" &&
          chunkData &&
          typeof chunkData === "object" &&
          !Array.isArray(chunkData)
        ) {
          // Handle updates: ['updates', { agent: { messages: [Array] } }]
          if (
            "agent" in chunkData &&
            chunkData.agent &&
            typeof chunkData.agent === "object" &&
            !Array.isArray(chunkData.agent) &&
            "messages" in chunkData.agent
          ) {
            const messages = Array.isArray(chunkData.agent.messages)
              ? chunkData.agent.messages
              : [chunkData.agent.messages];
            for (const message of messages) {
              if (!message) continue;

              const isAIMessage =
                message?.constructor?.name === "AIMessageChunk" ||
                message?.constructor?.name === "AIMessage";

              if (!isAIMessage) continue;

              const messageWithTools = message as Record<string, unknown>;
              const processedMessage = processAIMessage(messageWithTools);
              if (processedMessage) {
                yield processedMessage;
              }
            }
          }
        }
      }
    }
  }
  return generator();
}

// Helper function to process any AI message and return the appropriate MessageResponse
function processAIMessage(message: Record<string, unknown>): MessageResponse | null {
  // Check if this is a tool call (content is array with functionCall)
  const hasToolCall =
    Array.isArray(message.content) &&
    message.content.some(
      (item: unknown) => item && typeof item === "object" && "functionCall" in item,
    );

  if (hasToolCall) {
    // Return full AIMessageData for tool calls to preserve all information
    return {
      type: "ai",
      data: {
        id: (message.id as string) || Date.now().toString(),
        content: typeof message.content === "string" ? message.content : "",
        tool_calls: (message.tool_calls as ToolCall[]) || undefined,
        additional_kwargs: (message.additional_kwargs as Record<string, unknown>) || undefined,
        response_metadata: (message.response_metadata as Record<string, unknown>) || undefined,
      },
    };
  } else {
    // Handle regular text content - extract text from various content types
    let text = "";
    if (typeof message.content === "string") {
      text = message.content;
    } else if (Array.isArray(message.content)) {
      text = message.content
        .map((c: string | { text?: string }) => (typeof c === "string" ? c : c?.text || ""))
        .join("");
    } else {
      text = String(message.content ?? "");
    }

    // Only return message if we have actual text content
    if (text.trim()) {
      return {
        type: "ai",
        data: { id: (message.id as string) || Date.now().toString(), content: text },
      };
    }
  }
  return null;
}
