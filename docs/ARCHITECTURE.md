# 🏗️ Architecture Documentation

This document provides a comprehensive overview of the StackPath AI architecture, designed to help developers understand the system's design patterns and extend functionality.

**Key Innovation**: Excalidraw-style localStorage persistence with server-side memory hydration. No database required.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow & Memory Hydration](#data-flow--memory-hydration)
4. [localStorage Persistence](#localstorage-persistence)
5. [Agent Workflow](#agent-workflow)
6. [MCP Integration](#mcp-integration)
7. [Tool Approval Process](#tool-approval-process)
8. [Streaming Architecture](#streaming-architecture)
9. [Error Handling](#error-handling)
10. [Performance Considerations](#performance-considerations)

## 🌐 System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Chat UI       │  │   Settings UI   │  │   Thread List   │ │
│  │   Components    │  │   (Model Config)│  │   Sidebar       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React Query   │  │   Context API   │  │   Custom Hooks  │ │
│  │   (State Mgmt)  │  │   (UI State)    │  │   (Data Logic)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              localStorage (All Persistence)                 ││
│  │  • Threads metadata  • Messages per thread  • UI state      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                      HTTP/SSE + History Payload
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Server                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   API Routes    │  │   Agent Service │  │   Chat Service  │ │
│  │   (SSE Only)    │  │   (Streaming)   │  │   (Utils)       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Agent Builder  │  │   MCP Client    │  │ Memory Hydration│ │
│  │  (LangGraph)    │  │   (from JSON)   │  │ (from History)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                          Network Only
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     External Systems                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────────┐│
│  │   OpenAI/Google APIs     │  │   MCP Servers (stdio/HTTP)   ││
│  │   (LLM Processing)       │  │   (Dynamic Tools)            ││
│  └──────────────────────────┘  └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend

- **Next.js 15**: App Router with Server Components
- **React 19**: Latest features including Suspense and concurrent rendering
- **TypeScript**: Strict mode for type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Accessible component library
- **React Query (TanStack Query)**: Client state management and caching
- **localStorage**: Browser-based persistence (no database)

#### Backend

- **Node.js**: JavaScript runtime
- **Server-Sent Events**: Real-time streaming
- **No Database**: Stateless server with client-driven memory

#### AI & Tools

- **LangGraph.js**: Agent orchestration framework with ephemeral MemorySaver
- **LangChain**: LLM abstraction and tools
- **OpenAI/Google**: Language model providers
- **Model Context Protocol**: Static tool configuration via JSON

## 🧩 Core Components

### 1. Agent Builder (`src/lib/agent/builder.ts`)

The heart of the AI agent system, responsible for creating and configuring LangGraph StateGraphs.

```typescript
export class AgentBuilder {
  private toolNode: ToolNode;
  private readonly model: BaseChatModel;
  private tools: DynamicTool[];
  private systemPrompt: string;
  private approveAllTools: boolean;
  private checkpointer?: BaseCheckpointSaver;

  build() {
    const stateGraph = new StateGraph(MessagesAnnotation);
    stateGraph
      .addNode("agent", this.callModel.bind(this))
      .addNode("tools", this.toolNode)
      .addNode("tool_approval", this.approveToolCall.bind(this))
      .addEdge(START, "agent")
      .addConditionalEdges("agent", this.shouldApproveTool.bind(this))
      .addEdge("tools", "agent");

    return stateGraph.compile({ checkpointer: this.checkpointer });
  }
}
```

**Key Responsibilities:**

- StateGraph construction with human-in-the-loop pattern
- Tool binding and approval workflow
- Model configuration and prompt management
- Checkpointer integration for persistence

### 2. MCP Integration (`src/lib/agent/mcp.ts`)

Manages dynamic tool loading from Model Context Protocol servers configured via JSON file.

```typescript
export async function createMCPClient(): Promise<MultiServerMCPClient | null> {
  const mcpServers = await getMCPServerConfigs(); // From mcp-config.json

  if (Object.keys(mcpServers).length === 0) {
    return null;
  }

  const client = new MultiServerMCPClient({
    mcpServers: mcpServers,
    throwOnLoadError: false,
    prefixToolNameWithServerName: true, // Prevent conflicts
  });

  return client;
}

export async function getMCPServerConfigs(): Promise<Record<string, MCPServerConfig>> {
  try {
    const configPath = path.join(process.cwd(), "mcp-config.json");
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const fileContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(fileContent);
    // Parse and return enabled servers only
    return config.servers
      .filter((s: any) => s.enabled)
      .reduce((acc: Record<string, MCPServerConfig>, server: any) => {
        // ... configuration parsing logic
        return acc;
      }, {});
  } catch (error) {
    console.error("Failed to load MCP config:", error);
    return {};
  }
}
```

**Key Features:**

- Static JSON configuration (`mcp-config.json` in project root)
- Support for stdio and HTTP transports
- Tool name prefixing for conflict prevention
- Graceful error handling for failed servers
- No runtime UI for configuration changes

### 3. Streaming Service (`src/services/agentService.ts`)

Handles real-time streaming of agent responses with memory hydration from client history.

```typescript
export async function streamResponse(params: {
  threadId: string;
  userText: string;
  history: MessageResponse[]; // NEW: Client provides history
  opts?: MessageOptions;
}) {
  const { threadId, userText, history, opts } = params;

  // Handle tool approval vs normal input
  const inputs = opts?.allowTool
    ? new Command({ resume: { action: opts.allowTool === "allow" ? "continue" : "update" } })
    : { messages: [new HumanMessage(userText)] };

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

  // Stream with ephemeral MemorySaver (hydrated with client history)
  const iterable = await agent.stream(inputs, {
    streamMode: ["updates"],
    configurable: { thread_id: threadId },
  });

  // Process and yield streaming chunks
  async function* generator(): AsyncGenerator<MessageResponse, void, unknown> {
    for await (const chunk of iterable) {
      // Process chunk and yield MessageResponse
    }
  }

  return generator();
}
```

### 4. Chat Hook (`src/hooks/useChatThread.ts`)

React hook providing chat functionality with optimistic UI updates.

```typescript
export function useChatThread({ threadId }: UseChatThreadOptions) {
  const queryClient = useQueryClient();
  const streamRef = useRef<EventSource | null>(null);

  const sendMessage = useCallback(
    async (text: string, opts?: MessageOptions) => {
      // Optimistic UI: Add user message immediately
      const userMessage: MessageResponse = {
        type: "human",
        data: { id: `temp-${Date.now()}`, content: text },
      };
      queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
        ...old,
        userMessage,
      ]);

      // Stream agent response
      await handleStreamResponse({ threadId, text, opts });
    },
    [threadId, queryClient, handleStreamResponse],
  );

  return {
    messages,
    sendMessage,
    approveToolExecution,
    // ... other methods
  };
}
```

## 🔄 Data Flow & Memory Hydration

### Message Flow Diagram (Memory Hydration Pattern)

```
User Input → Load History from localStorage → Optimistic UI → API Route + History
    ↓                                                                ↓
localStorage ← Save Messages ← React Query ← SSE Stream ←─ Agent Service
                                                                     ↓
                                                            Memory Hydration
                                                                     ↓
                                                            LangGraph Agent
                                                                     ↓
                                                            Stream Response
```

### Detailed Flow Steps

1. **User Input**
   - User types message in `MessageInput` component
   - `useChatThread.sendMessage()` called

2. **Load Client History**
   - Client loads full conversation history from localStorage
   - Uses `getMessages(threadId)` from storage utility
   - History includes all previous messages (human, AI, tool)

3. **Optimistic UI Update**
   - User message immediately added to React Query cache
   - UI updates instantly for responsive feel
   - React Query cache also updated in localStorage

4. **API Request with History**
   - SSE connection opened to `/api/agent/stream`
   - Request includes thread ID, message content, **and full conversation history**
   - History sent as JSON stringified query parameter

5. **Server-Side Memory Hydration**
   - Server creates fresh MemorySaver instance (ephemeral)
   - Converts client `MessageResponse[]` to LangChain `BaseMessage[]`
   - Hydrates MemorySaver checkpoint with client history via `hydrateMemoryFromHistory()`
   - Agent now has full conversation context without database

6. **Agent Processing**
   - Fresh agent created with hydrated memory
   - Agent loaded with MCP tools from `mcp-config.json`
   - LangGraph processes with full context from client history

7. **Tool Approval (if needed)**
   - Agent pauses at tool calls if approval required
   - Tool details sent via SSE to frontend
   - User approves/denies via UI
   - Resume command sent to continue processing

8. **Streaming Response**
   - Agent response streamed chunk-by-chunk via SSE
   - Frontend accumulates chunks by message ID
   - React Query cache updated in real-time

9. **Client-Side Persistence**
   - All updated messages saved to localStorage after each chunk
   - Uses `saveMessages(threadId, messages)` from storage utility
   - Thread metadata updated in localStorage
   - No server-side persistence required

## 🗄️ localStorage Persistence

### Storage Architecture

All application data is stored in browser localStorage with namespace prefix `stackpath_`:

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser localStorage                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  stackpath_threads                                          │
│  ├─ Array<Thread>                                           │
│  │  ├─ { id, title, createdAt, updatedAt }                 │
│  │  ├─ { id, title, createdAt, updatedAt }                 │
│  │  └─ ...                                                  │
│                                                             │
│  stackpath_messages_{threadId}                              │
│  ├─ Array<MessageResponse>                                  │
│  │  ├─ { type: "human", data: { id, content } }            │
│  │  ├─ { type: "ai", data: { id, content, tool_calls } }   │
│  │  └─ ...                                                  │
│                                                             │
│  stackpath_active_thread                                    │
│  └─ string (current thread ID)                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Models

#### Thread Model

```typescript
interface Thread {
  id: string; // UUID
  title: string; // Display name
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

**Storage Key**: `stackpath_threads`
**Purpose**: Minimal metadata for conversation threads. Messages stored separately per thread.

#### Message Model

```typescript
type MessageResponse =
  | { type: "human"; data: HumanMessageData }
  | { type: "ai"; data: AIMessageData }
  | { type: "tool"; data: ToolMessageData }
  | { type: "error"; data: ErrorMessageData };

interface AIMessageData {
  id: string;
  content: string;
  tool_calls?: ToolCall[];
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
}
```

**Storage Key**: `stackpath_messages_{threadId}` (separate key per thread)
**Purpose**: Complete conversation history including tool calls and metadata.

### Storage Utilities (`src/lib/storage/localStorage.ts`)

#### Key Functions

```typescript
// Thread Management
export function getThreads(): Thread[];
export function getThread(threadId: string): Thread | null;
export function saveThread(thread: Thread): void;
export function deleteThread(threadId: string): void;

// Message Management
export function getMessages(threadId: string): MessageResponse[];
export function saveMessages(threadId: string, messages: MessageResponse[]): void;

// Active Thread
export function getActiveThreadId(): string | null;
export function setActiveThreadId(threadId: string | null): void;

// Utilities
export function getStorageSize(): string;
export function clearAllData(): void;
```

#### Error Handling

- **QuotaExceededError**: Gracefully handled with console warnings
- **SSR Safety**: All functions check for `window` availability
- **JSON Parse Errors**: Return empty arrays/null on corrupted data

### MCP Configuration (Static)

MCP servers are configured in `mcp-config.json` at project root (not in localStorage):

```json
{
  "servers": [
    {
      "name": "context7",
      "enabled": true,
      "type": "http",
      "url": "https://mcp.context7.ai",
      "headers": {}
    },
    {
      "name": "web_fetch",
      "enabled": true,
      "type": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-fetch"],
      "env": {}
    }
  ]
}
```

**Purpose**: Static tool configuration loaded by server at runtime. No UI for management.

## 🤖 Agent Workflow

### StateGraph Structure

```
    START
      │
      ▼
┌──────────┐
│  agent   │ ──► Call language model with tools
└──────────┘
      │
      ▼
  Should approve
     tool?
   ┌─────────┐
   │   Yes   │ ──► ┌─────────────┐
   └─────────┘     │tool_approval│ ──► Human review
                   └─────────────┘
   ┌─────────┐              │
   │   No    │              ▼
   └─────────┘         ┌─────────┐
      │                │  tools  │ ──► Execute tools
      ▼                └─────────┘
    END                     │
                           ▼
                      Back to agent
```

### Node Descriptions

#### Agent Node

- **Input**: Current conversation state
- **Process**:
  - Add system prompt to message history
  - Bind available tools to language model
  - Generate response with potential tool calls
- **Output**: AI message (text and/or tool calls)

#### Tool Approval Node

- **Input**: AI message with tool calls
- **Process**:
  - Check if `approveAllTools` is enabled
  - If not, interrupt with tool details for human review
  - Wait for user decision (allow/deny/modify)
- **Output**: Command to continue to tools or return to agent

#### Tools Node

- **Input**: Approved tool calls
- **Process**: Execute tools via MCP clients
- **Output**: Tool results as messages

### Interrupt Handling

```typescript
const humanReview = interrupt<
  { question: string; toolCall: ToolCall },
  { action: string; data: string | MessageContentComplex[] }
>({
  question: "Is this correct?",
  toolCall: toolCall,
});

switch (humanReview.action) {
  case "continue":
    return new Command({ goto: "tools" });
  case "update":
    return new Command({
      goto: "tools",
      update: { messages: [updatedMessage] },
    });
  case "feedback":
    return new Command({
      goto: "agent",
      update: { messages: [toolMessage] },
    });
}
```

## 🔧 MCP Integration

### Server Configuration Flow

```
mcp-config.json → getMCPServerConfigs() → MultiServerMCPClient → Agent Tools
```

### Configuration Examples

#### Stdio Server (File System)

```json
{
  "name": "filesystem",
  "enabled": true,
  "type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "/allowed/path"],
  "env": { "LOG_LEVEL": "info" }
}
```

#### HTTP Server (Custom API)

```json
{
  "name": "web-search",
  "enabled": true,
  "type": "http",
  "url": "https://api.example.com/mcp",
  "headers": {
    "Authorization": "Bearer token",
    "Content-Type": "application/json"
  }
}
```

### Tool Loading Process

1. **Load JSON Config**: Read `mcp-config.json` from project root
2. **Filter Enabled Servers**: Only process servers with `enabled: true`
3. **Client Creation**: Initialize MultiServerMCPClient with configurations
4. **Tool Discovery**: Get available tools from each server
5. **Name Prefixing**: Add server name prefix to prevent conflicts
6. **Agent Binding**: Bind tools to language model

### Updating MCP Configuration

To add or modify MCP servers:

1. Edit `mcp-config.json` in project root
2. Add/remove/modify server configurations
3. Restart development server to pick up changes
4. No database migrations or UI management needed

## ✅ Tool Approval Process

### User Interface Flow

```
Tool Call Detected → Approval UI Rendered → User Decision → Command Sent → Agent Resumes
```

### Approval Options

#### 1. Allow

- **Action**: Execute tool with original parameters
- **Implementation**: `new Command({ goto: "tools" })`
- **Result**: Tool runs and agent continues with results

#### 2. Deny

- **Action**: Skip tool execution
- **Implementation**: Return to agent with denial message
- **Result**: Agent continues without tool results

#### 3. Modify

- **Action**: Edit tool parameters before execution
- **Implementation**: Update message with new parameters
- **Result**: Tool runs with modified inputs

### Frontend Implementation

```typescript
const approveToolExecution = useCallback(
  async (toolCallId: string, action: "allow" | "deny") => {
    await handleStreamResponse({
      threadId,
      text: "",
      opts: { allowTool: action },
    });
  },
  [threadId, handleStreamResponse],
);
```

## 🌊 Streaming Architecture

### Server-Sent Events (SSE) Flow

```
Client Request → API Route → Agent Stream → SSE Response → Client Handler
```

### Message Processing

#### Server Side (`/api/agent/stream/route.ts`)

```typescript
export async function POST(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const responseGenerator = streamResponse(params);

        for await (const messageResponse of responseGenerator) {
          const data = JSON.stringify(messageResponse);
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }

        controller.enqueue(new TextEncoder().encode(`event: done\ndata: {}\n\n`));
      } catch (error) {
        controller.enqueue(
          new TextEncoder().encode(
            `event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

#### Client Side (`useChatThread.ts`)

```typescript
stream.onmessage = (event: MessageEvent) => {
  const messageResponse = JSON.parse(event.data) as MessageResponse;
  const data = messageResponse.data as AIMessageData;

  // First chunk: create new message
  if (!currentMessageRef.current || currentMessageRef.current.data.id !== data.id) {
    currentMessageRef.current = messageResponse;
    queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
      ...old,
      currentMessageRef.current!,
    ]);
  } else {
    // Subsequent chunks: accumulate content
    const currentData = currentMessageRef.current.data as AIMessageData;
    const newContent = currentData.content + data.content;

    currentMessageRef.current = {
      ...currentMessageRef.current,
      data: { ...currentData, content: newContent },
    };

    // Update React Query cache
    queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => {
      const idx = old.findIndex((m) => m.data?.id === currentMessageRef.current!.data.id);
      if (idx === -1) return old;
      const clone = [...old];
      clone[idx] = currentMessageRef.current!;
      return clone;
    });
  }
};
```

### Message Types

```typescript
type MessageResponse =
  | { type: "human"; data: HumanMessageData }
  | { type: "ai"; data: AIMessageData }
  | { type: "tool"; data: ToolMessageData }
  | { type: "error"; data: ErrorMessageData };

interface AIMessageData {
  id: string;
  content: string;
  tool_calls?: ToolCall[];
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
}
```

## 🚨 Error Handling

### Error Categories

#### 1. Network Errors

- **Causes**: Connection failures, timeouts
- **Handling**: Retry with exponential backoff
- **UI**: Error message with retry button

#### 2. Authentication Errors

- **Causes**: Invalid API keys, expired tokens
- **Handling**: Clear invalid credentials, prompt for re-auth
- **UI**: Settings panel with credential update

#### 3. MCP Server Errors

- **Causes**: Server unavailable, configuration issues
- **Handling**: Graceful degradation, disable failed servers
- **UI**: Server status indicators in settings

#### 4. Tool Execution Errors

- **Causes**: Invalid parameters, permission issues
- **Handling**: Return error to agent for recovery
- **UI**: Error display in tool result

### Error Recovery Strategies

```typescript
// Stream error handling
stream.addEventListener("error", async (ev: Event) => {
  try {
    const dataText = (ev as MessageEvent<string>)?.data;
    const message = extractErrorMessage(dataText);

    // Surface error in chat
    const errorMsg: MessageResponse = {
      type: "error",
      data: { id: `err-${Date.now()}`, content: `⚠️ ${message}` },
    };

    queryClient.setQueryData(["messages", threadId], (old: MessageResponse[] = []) => [
      ...old,
      errorMsg,
    ]);
  } finally {
    // Always cleanup
    setIsSending(false);
    currentMessageRef.current = null;
    stream.close();
    streamRef.current = null;
  }
});
```

## ⚡ Performance Considerations

### Frontend Optimizations

#### 1. React Query Caching

- **Strategy**: Stale-while-revalidate
- **Cache Time**: 5 minutes for message history
- **Background Refetch**: On window focus

#### 2. Component Memoization

- **Usage**: Memoize expensive renders
- **Example**: Message list virtualization for long conversations

#### 3. Code Splitting

- **Route-based**: Automatic with Next.js App Router
- **Component-based**: Dynamic imports for heavy components

### Backend Optimizations

#### 1. Stateless Server Design

- **No Database Queries**: Server reads MCP config from JSON file once at startup
- **Fresh Agent Per Request**: No singleton pattern reduces memory footprint
- **Ephemeral Memory**: MemorySaver instances garbage collected after response

#### 2. MCP Client Caching

- **Reuse Connections**: MCP clients reused across requests when possible
- **Lazy Loading**: Tools discovered only when agent is created

#### 3. Streaming Efficiency

- **Chunking**: Optimal chunk sizes for SSE
- **Backpressure**: Handle slow clients gracefully
- **Memory Hydration**: Efficient conversion from client format to LangChain format

### Memory Management

#### 1. Stream Cleanup

```typescript
useEffect(
  () => () => {
    if (streamRef.current) {
      try {
        streamRef.current.close();
      } catch {}
    }
  },
  [],
);
```

#### 2. Client-Side Storage Cleanup

- **Manual**: Users can clear localStorage via browser settings or app UI
- **Storage Monitoring**: `getStorageSize()` utility provides storage usage info
- **Quota Management**: QuotaExceededError handled gracefully

## 📊 Monitoring & Observability

### Logging Strategy

#### 1. Structured Logging

```typescript
logger.info("Agent processing started", {
  threadId,
  model: opts?.model,
  toolCount: tools.length,
  approveAllTools: opts?.approveAllTools,
});
```

#### 2. Error Tracking

- **Client**: Error boundaries with error reporting
- **Server**: Centralized error logging with context

#### 3. Performance Metrics

- **Response Time**: Track agent processing duration
- **Tool Usage**: Monitor MCP server performance
- **Stream Health**: SSE connection success rates

### Health Checks

#### 1. MCP Server Status

```typescript
export async function checkMCPServers() {
  const config = await getMCPServerConfigs(); // From mcp-config.json
  const servers = Object.keys(config);
  const statuses = await Promise.allSettled(
    servers.map((serverName) => testMCPConnection(config[serverName])),
  );
  return statuses.map((status, i) => ({
    server: servers[i],
    status: status.status,
    error: status.status === "rejected" ? status.reason : null,
  }));
}
```

#### 2. Client Storage Health

```typescript
export function checkLocalStorageHealth() {
  try {
    const storageSize = getStorageSize();
    const threads = getThreads();
    return {
      status: "healthy",
      storageSize,
      threadCount: threads.length,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      error: error.message,
    };
  }
}
```

---

## 🎯 Architecture Benefits

### Simplicity

- **No Database Setup**: Zero infrastructure required for development or deployment
- **Stateless Server**: Easier horizontal scaling and serverless deployment
- **Client-Driven State**: Browser localStorage provides reliable persistence

### Performance

- **No Database Queries**: Eliminates database latency from request path
- **Fresh Agent Per Request**: No stale state or singleton issues
- **Memory Efficiency**: Ephemeral MemorySaver instances garbage collected after use

### Developer Experience

- **Quick Setup**: `pnpm install && pnpm dev` - no Docker or database configuration
- **Simple Debugging**: All state visible in browser DevTools
- **Easy Configuration**: MCP servers configured via simple JSON file

### Scalability

- **Horizontal Scaling**: Stateless servers can scale infinitely
- **Serverless Ready**: Deploy to Vercel, Netlify, or any edge platform
- **No Database Bottleneck**: Client storage eliminates shared database contention

---

This architecture is designed for simplicity, maintainability, and extensibility. The Excalidraw-style client-side persistence with server-side memory hydration provides a unique approach that eliminates database complexity while maintaining full conversational context. The modular design allows for easy addition of new features while maintaining clean separation of concerns.
