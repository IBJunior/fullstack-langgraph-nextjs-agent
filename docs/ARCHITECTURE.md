# 🏗️ Architecture Documentation

This document provides a comprehensive overview of the LangGraph.js AI Agent Template architecture, designed to help developers understand the system's design patterns and extend functionality.

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [Agent Workflow](#agent-workflow)
6. [MCP Integration](#mcp-integration)
7. [Tool Approval Process](#tool-approval-process)
8. [File Upload & Storage](#file-upload--storage)
9. [Streaming Architecture](#streaming-architecture)
10. [Error Handling](#error-handling)
11. [Performance Considerations](#performance-considerations)

## 🌐 System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Chat UI       │  │   Settings UI   │  │   Thread List   │ │
│  │   Components    │  │   (MCP Config)  │  │   Sidebar       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React Query   │  │   Context API   │  │   Custom Hooks  │ │
│  │   (State Mgmt)  │  │   (UI State)    │  │   (Data Logic)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                            HTTP/SSE
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Server                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   API Routes    │  │   Agent Service │  │   Chat Service  │ │
│  │   (REST/SSE)    │  │   (Streaming)   │  │   (Utils)       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Agent Builder  │  │   MCP Client    │  │   Memory Mgmt   │ │
│  │  (LangGraph)    │  │   (Tools)       │  │   (History)     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                          Database/Network
                                │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          External Systems                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL  │  │OpenAI/Google│  │ MCP Servers │  │ MinIO/S3 (Storage)  │ │
│  │(Persistence)│  │ (LLM APIs)  │  │  (Tools)    │  │ (File Uploads)      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend

- **Next.js 15**: App Router with Server Components
- **React 19**: Latest features including Suspense and concurrent rendering
- **TypeScript**: Strict mode for type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Accessible component library
- **React Query (TanStack Query)**: Server state management

#### Backend

- **Node.js**: JavaScript runtime
- **Prisma ORM**: Type-safe database access
- **PostgreSQL**: Primary database
- **Server-Sent Events**: Real-time streaming
- **MinIO/S3**: Object storage for file uploads

#### AI & Tools

- **LangGraph.js**: Agent orchestration framework
- **LangChain**: LLM abstraction and tools
- **OpenAI/Google**: Language model providers
- **Model Context Protocol**: Dynamic tool integration

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

Manages dynamic tool loading from Model Context Protocol servers.

```typescript
export async function createMCPClient(): Promise<MultiServerMCPClient | null> {
  const mcpServers = await getMCPServerConfigs(); // From database

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
```

**Key Features:**

- Database-driven MCP server configuration
- Support for stdio and HTTP transports
- Tool name prefixing for conflict prevention
- Graceful error handling for failed servers

### 3. Streaming Service (`src/services/agentService.ts`)

Handles real-time streaming of agent responses via Server-Sent Events.

```typescript
export async function streamResponse(params: {
  threadId: string;
  userText: string;
  opts?: MessageOptions;
}) {
  // Ensure thread exists
  await ensureThread(threadId, userText);

  // Handle tool approval vs normal input
  const inputs = opts?.allowTool
    ? new Command({ resume: { action: opts.allowTool === "allow" ? "continue" : "update" } })
    : { messages: [new HumanMessage(userText)] };

  const agent = await ensureAgent({
    model: opts?.model,
    tools: opts?.tools,
    approveAllTools: opts?.approveAllTools,
  });

  // Stream with checkpointer for persistence
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

## 🔄 Data Flow

### Message Flow Diagram

```
User Input → Optimistic UI → API Route → Agent Service → LangGraph Agent
    ↓                                                         ↓
React Query ←─ SSE Stream ←─ Stream Response ←─ Agent Stream ←─┘
    ↓
UI Update
```

### Detailed Flow Steps

1. **User Input**
   - User types message in `MessageInput` component
   - `useChatThread.sendMessage()` called

2. **Optimistic UI Update**
   - User message immediately added to React Query cache
   - UI updates instantly for responsive feel

3. **API Request**
   - SSE connection opened to `/api/agent/stream`
   - Request includes thread ID, message content, and options

4. **Agent Processing**
   - `streamResponse()` ensures thread exists in database
   - Agent created with current MCP tools and configuration
   - LangGraph begins processing with checkpointer for persistence

5. **Tool Approval (if needed)**
   - Agent pauses at tool calls if approval required
   - Tool details sent via SSE to frontend
   - User approves/denies via UI
   - Resume command sent to continue processing

6. **Streaming Response**
   - Agent response streamed chunk-by-chunk via SSE
   - Frontend accumulates chunks by message ID
   - React Query cache updated in real-time

7. **Persistence**
   - All messages stored in LangGraph checkpointer
   - Thread metadata updated in PostgreSQL
   - MCP server configurations persisted

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐
│     Thread      │         │   MCPServer     │
├─────────────────┤         ├─────────────────┤
│ id: String (PK) │         │ id: String (PK) │
│ title: String   │         │ name: String    │
│ createdAt: Date │         │ type: Enum      │
│ updatedAt: Date │         │ enabled: Bool   │
└─────────────────┘         │ command: String?│
                            │ args: Json?     │
                            │ env: Json?      │
                            │ url: String?    │
                            │ headers: Json?  │
                            │ createdAt: Date │
                            │ updatedAt: Date │
                            └─────────────────┘

                    ┌─────────────────────────┐
                    │   LangGraph Checkpoints │
                    │   (managed by framework)│
                    ├─────────────────────────┤
                    │ thread_id: String       │
                    │ checkpoint_id: String   │
                    │                         │
                    └─────────────────────────┘
```

### Schema Details

#### Thread Model

```prisma
model Thread {
  id        String   @id @default(uuid())
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Purpose**: Minimal metadata for conversation threads. The actual conversation history is stored in LangGraph checkpoints for efficient state management.

#### MCPServer Model

```prisma
model MCPServer {
  id        String            @id @default(uuid())
  name      String            @unique
  type      MCPServerType     // stdio | http
  enabled   Boolean           @default(true)
  // For stdio servers
  command   String?
  args      Json?
  env       Json?
  // For http servers
  url       String?
  headers   Json?
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
}
```

**Purpose**: Dynamic configuration of MCP servers. Supports both stdio (command-line) and HTTP-based servers with flexible JSON configuration.

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
Database MCPServer → getMCPServerConfigs() → MultiServerMCPClient → Agent Tools
```

### Configuration Examples

#### Stdio Server (File System)

```typescript
{
  name: "filesystem",
  type: "stdio",
  command: "npx",
  args: ["@modelcontextprotocol/server-filesystem", "/allowed/path"],
  env: { "LOG_LEVEL": "info" }
}
```

#### HTTP Server (Custom API)

```typescript
{
  name: "web-search",
  type: "http",
  url: "https://api.example.com/mcp",
  headers: {
    "Authorization": "Bearer token",
    "Content-Type": "application/json"
  }
}
```

### Tool Loading Process

1. **Database Query**: Fetch enabled MCP servers
2. **Client Creation**: Initialize MultiServerMCPClient
3. **Tool Discovery**: Get available tools from each server
4. **Name Prefixing**: Add server name prefix to prevent conflicts
5. **Agent Binding**: Bind tools to language model

## 📁 File Upload & Storage

The application supports multimodal AI conversations through file uploads. Files are stored in S3-compatible storage (MinIO for development) and processed for AI consumption.

### Upload Flow

```
User → MessageInput → Upload API → MinIO/S3 → File Metadata
                                        ↓
Agent Request ← processAttachmentsForAI ← Download & Convert to Base64
```

### Supported File Types

| Type      | Extensions | Max Size | AI Processing         |
| --------- | ---------- | -------- | --------------------- |
| Images    | PNG, JPEG  | 5MB      | Base64 data URL       |
| Documents | PDF        | 10MB     | Base64 data URL       |
| Text      | MD, TXT    | 2MB      | UTF-8 text extraction |

### Key Components

#### Upload Endpoint (`src/app/api/agent/upload/route.ts`)

Handles file validation and storage:

- Validates MIME type and file size
- Handles `application/octet-stream` for text files by extension
- Uploads to MinIO/S3 with unique keys
- Returns file metadata (URL, key, name, type, size)

#### Storage Utilities (`src/lib/storage/`)

- **s3-client.ts**: AWS SDK S3 client configuration
- **upload.ts**: Upload functions with multipart support for large files
- **validation.ts**: File type and size validation rules
- **content.ts**: File processing for AI (base64 conversion, text extraction)

#### Multimodal Message Building (`src/services/agentService.ts`)

```typescript
if (opts?.attachments && opts.attachments.length > 0) {
  const attachmentContents = await processAttachmentsForAI(opts.attachments);
  messageContent = [{ type: "text", text: userText }, ...attachmentContents];
}
```

### Storage Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  MessageInput   │────►│  Upload API     │────►│   MinIO/S3      │
│  (File Select)  │     │  (Validation)   │     │   (Storage)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  LangChain      │◄────│ processAttach-  │◄────│  Download &     │
│  HumanMessage   │     │ mentsForAI()    │     │  Base64 Convert │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Production Migration

The storage layer uses AWS SDK v3, which works with any S3-compatible service. To switch from MinIO to production storage (AWS S3, Cloudflare R2, etc.), update the environment variables - no code changes required.

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

#### 1. Database Indexing

```sql
-- Thread lookup optimization
CREATE INDEX idx_thread_updated_at ON "Thread" ("updatedAt" DESC);

-- MCP server query optimization
CREATE INDEX idx_mcpserver_enabled ON "MCPServer" ("enabled") WHERE enabled = true;
```

#### 2. Connection Pooling

- **Database**: Prisma connection pooling
- **MCP Servers**: Reuse client connections

#### 3. Streaming Efficiency

- **Chunking**: Optimal chunk sizes for SSE
- **Backpressure**: Handle slow clients gracefully

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

#### 2. LangGraph Checkpointing

- **Automatic**: Old checkpoints cleaned by framework
- **Configuration**: Retention policies via checkpointer settings

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

#### 1. Database Connectivity

```typescript
export async function healthCheck() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy", database: "connected" };
  } catch (error) {
    return { status: "unhealthy", database: "disconnected", error };
  }
}
```

#### 2. MCP Server Status

```typescript
export async function checkMCPServers() {
  const servers = await prisma.mCPServer.findMany({ where: { enabled: true } });
  const statuses = await Promise.allSettled(servers.map((server) => testMCPConnection(server)));
  return statuses.map((status, i) => ({
    server: servers[i].name,
    status: status.status,
    error: status.status === "rejected" ? status.reason : null,
  }));
}
```

---

This architecture is designed for scalability, maintainability, and extensibility. The modular design allows for easy addition of new features while maintaining clean separation of concerns. The comprehensive error handling and performance optimizations ensure a robust production-ready system.
