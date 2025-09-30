import {
  MessageResponse,
  AIMessageData,
  ToolMessageData,
  ContentItem,
  ToolCall,
  FunctionCall,
} from "@/types/message";

export function getMessageContent(message: MessageResponse): string {
  if (typeof message.data?.content === "string") {
    return message.data.content;
  }
  return "";
}

export function getMessageId(message: MessageResponse): string {
  return message.data?.id || "";
}

export function isAIMessageWithToolCalls(
  message: MessageResponse,
): message is MessageResponse & { data: AIMessageData } {
  return (
    message.type === "ai" &&
    typeof message.data === "object" &&
    ("tool_calls" in message.data ||
      (Array.isArray(message.data.content) &&
        message.data.content.some((item: ContentItem) => item.functionCall)))
  );
}

export function getToolCalls(message: MessageResponse): ToolCall[] {
  if (!isAIMessageWithToolCalls(message)) {
    return [];
  }
  return message.data.tool_calls || [];
}

export function getFunctionCalls(message: MessageResponse): FunctionCall[] {
  if (!isAIMessageWithToolCalls(message)) {
    return [];
  }

  if (Array.isArray(message.data.content)) {
    return message.data.content
      .filter((item: ContentItem) => item.functionCall)
      .map((item: ContentItem) => item.functionCall!);
  }

  return [];
}

export function hasToolCalls(message: MessageResponse): boolean {
  return getToolCalls(message).length > 0 || getFunctionCalls(message).length > 0;
}

export function isToolMessage(
  message: MessageResponse,
): message is MessageResponse & { data: ToolMessageData } {
  return (
    message.type === "tool" &&
    typeof message.data === "object" &&
    "name" in message.data &&
    "tool_call_id" in message.data
  );
}

export function getToolName(message: MessageResponse): string {
  if (isToolMessage(message)) {
    return message.data.name;
  }
  return "";
}
