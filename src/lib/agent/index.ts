import { DEFAULT_SYSTEM_PROMPT as SYSTEM_PROMPT } from "./prompt";
import { createMemorySaver, hydrateMemoryFromHistory } from "./memory";
import type { DynamicTool, StructuredToolInterface } from "@langchain/core/tools";
import {
  AgentConfigOptions,
  createChatModel,
  DEFAULT_MODEL_NAME,
  DEFAULT_MODEL_PROVIDER,
} from "./util";
import { getMCPTools } from "./mcp";
import { AgentBuilder } from "./builder";
import type { MessageResponse } from "@/types/message";

/**
 * Create agent with hydrated memory from client history
 * NO LONGER A SINGLETON - creates fresh instance per request
 */
export async function createAgent(
  cfg?: AgentConfigOptions,
  threadId?: string,
  history?: MessageResponse[],
) {
  const provider = cfg?.provider || DEFAULT_MODEL_PROVIDER;
  const modelName = cfg?.model || DEFAULT_MODEL_NAME;
  const llm = createChatModel({ provider, model: modelName, temperature: 1 });

  const mcpTools = await getMCPTools();
  const configTools = (cfg?.tools || []) as StructuredToolInterface[];
  const allTools = [...configTools, ...mcpTools] as DynamicTool[];

  // Create fresh MemorySaver for this request
  const memorySaver = createMemorySaver();

  // HYDRATE with client history
  if (threadId && history && history.length > 0) {
    await hydrateMemoryFromHistory(memorySaver, threadId, history);
  }

  const agent = new AgentBuilder({
    llm,
    tools: allTools,
    prompt: cfg?.systemPrompt || SYSTEM_PROMPT,
    checkpointer: memorySaver,
    approveAllTools: cfg?.approveAllTools || false,
  }).build();

  return agent;
}

export async function ensureAgent(
  cfg?: AgentConfigOptions,
  threadId?: string,
  history?: MessageResponse[],
) {
  return createAgent(cfg, threadId, history);
}

export async function getAgent(
  cfg?: AgentConfigOptions,
  threadId?: string,
  history?: MessageResponse[],
) {
  return ensureAgent(cfg, threadId, history);
}
