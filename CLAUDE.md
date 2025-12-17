# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

```bash
# Setup (No database required!)
pnpm install

# Development
pnpm dev                      # Next.js with Turbopack
pnpm build                    # Production build
pnpm lint                     # ESLint
pnpm format                   # Prettier formatting
pnpm format:check             # Check formatting
```

## Architecture Overview

This is a Next.js 15 fullstack AI agent chat application using LangGraph.js with Model Context Protocol (MCP) server integration.

**Key Innovation**: Excalidraw-style localStorage persistence with server-side memory hydration. No database required.

### Core Agent System

- **Agent Builder**: `src/lib/agent/builder.ts` - Creates StateGraph with agent→tool_approval→tools flow
- **MCP Integration**: `src/lib/agent/mcp.ts` - Loads tools from `mcp-config.json` static configuration
- **Memory Hydration**: Client sends conversation history to server; server creates fresh MemorySaver and hydrates it with client data
- **Tool Approval**: Human-in-the-loop pattern with interrupts for tool execution approval

### Data Flow (Memory Hydration Pattern)

1. User message → Client loads conversation history from localStorage
2. Client sends message + full history to `/api/agent/stream` SSE endpoint
3. Server creates fresh agent with ephemeral MemorySaver
4. **Memory Hydration**: Server hydrates MemorySaver with client history via `hydrateMemoryFromHistory()`
5. Agent processes with full conversation context → streams incremental responses
6. Client saves updated messages to localStorage after each chunk

### Key Components Structure

- **Context Providers**: `ThreadContext` (active thread), `UISettingsContext` (UI state)
- **Custom Hooks**: `useChatThread`, `useThreads` for data domains
- **Message Components**: Separate components for AI/Human/Tool/Error message types
- **Agent Services**: `src/services/agentService.ts` handles streaming, `src/services/chatService.ts` manages UI state
- **Storage Layer**: `src/lib/storage/localStorage.ts` - All persistence utilities

### localStorage Persistence

All data stored in browser localStorage with namespace prefix `stackpath_`:

- `stackpath_threads` - Array of Thread objects (id, title, timestamps)
- `stackpath_messages_{threadId}` - Messages array per thread
- `stackpath_active_thread` - Currently active thread ID

### MCP Server Configuration

MCP servers are pre-configured in `mcp-config.json` at project root:

```json
{
  "servers": [
    { "name": "context7", "enabled": true, "type": "http", "url": "https://mcp.context7.ai" },
    {
      "name": "web_fetch",
      "enabled": true,
      "type": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-fetch"]
    }
  ]
}
```

- Tool names prefixed with server name to prevent conflicts
- Server configs support environment variables and command arguments
- No runtime management UI - configuration is code-level only

### Tool Approval Workflow

- Agent pauses at tool calls, emits interrupt with tool details
- Frontend shows approval UI, sends `allowTool=allow/deny` parameter
- Uses `Command.resume()` pattern instead of new message input

## Project-Specific Patterns

### Agent Configuration

- **No Singleton Pattern**: Fresh agent instance created per request
- `createAgent()` accepts `history` parameter for memory hydration
- Memory hydration via `hydrateMemoryFromHistory()` in `src/lib/agent/memory.ts`
- MCP servers loaded from JSON config file on each agent creation
- Supports OpenAI/Google models via `AgentConfigOptions`

### Memory Hydration Implementation

Key function in `src/lib/agent/memory.ts`:

```typescript
export async function hydrateMemoryFromHistory(
  saver: MemorySaver,
  threadId: string,
  history: MessageResponse[],
): Promise<void>;
```

Converts client `MessageResponse[]` format to LangChain `BaseMessage[]` and creates checkpoint in MemorySaver.

### API Route Patterns

- Stream endpoints use `dynamic = "force-dynamic"` and `runtime = "nodejs"`
- Query params for streaming: `content`, `threadId`, `history` (JSON stringified), `model`, `allowTool`, `approveAllTools`
- History parameter is full conversation array sent from client

### Streaming Architecture

- SSE with React Query: `useChatThread` manages optimistic UI + streaming updates
- Message accumulation: Frontend concatenates text chunks by message ID
- Tool approval flow uses Command objects with `resume` action
- All messages persisted to localStorage after each update

## Important Notes

- No database setup required - all persistence is client-side via localStorage
- Restart dev server to pick up MCP configuration changes in `mcp-config.json`
- Uses pnpm as package manager (see packageManager in package.json)
- Storage keys are namespaced with `stackpath_` prefix
