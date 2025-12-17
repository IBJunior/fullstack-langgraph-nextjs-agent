# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

```bash
# Setup (requires Postgres and MinIO running)
docker compose up -d          # Start Postgres (5434) and MinIO (9000/9001)
pnpm install
pnpm prisma:generate
pnpm prisma:migrate

# Development
pnpm dev                      # Next.js with Turbopack
pnpm build                    # Production build
pnpm lint                     # ESLint
pnpm format                   # Prettier formatting
pnpm format:check             # Check formatting

# Database
pnpm prisma:generate          # After schema changes
pnpm prisma:migrate           # Create/apply migrations
pnpm prisma:studio            # Database UI

# File Storage
# MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
# S3 API: http://localhost:9000
```

## Architecture Overview

This is a Next.js 15 fullstack AI agent chat application using LangGraph.js with Model Context Protocol (MCP) server integration.

### Core Agent System

- **Agent Builder**: `src/lib/agent/builder.ts` - Creates StateGraph with agent→tool_approval→tools flow
- **MCP Integration**: `src/lib/agent/mcp.ts` - Dynamically loads tools from MCP servers stored in Postgres
- **Persistent Memory**: Uses LangGraph's Postgres checkpointer for conversation history
- **Tool Approval**: Human-in-the-loop pattern with interrupts for tool execution approval

### Data Flow

1. User message → `/api/agent/stream` SSE endpoint → `streamResponse()` in `agentService.ts`
2. Agent processes with tools from enabled MCP servers → streams incremental responses
3. Frontend uses `useChatThread()` hook with React Query for optimistic UI and streaming
4. Thread persistence via Prisma → Postgres (threads + MCP server configs)
5. File uploads → `/api/agent/upload` → MinIO (S3-compatible storage) → returns file URLs

### Key Components Structure

- **Context Providers**: `ThreadContext` (active thread), `UISettingsContext` (UI state)
- **Custom Hooks**: `useChatThread`, `useMCPTools`, `useThreads` for data domains
- **Message Components**: Separate components for AI/Human/Tool/Error message types
- **Agent Services**: `src/services/agentService.ts` handles streaming, `src/services/chatService.ts` manages UI state

### Database Schema

- `Thread` model: Minimal metadata (actual history in LangGraph checkpoints)
- `MCPServer` model: Supports stdio/http types with conditional fields (command/args/env for stdio, url/headers for http)
- Uses JSON fields for flexible MCP server configuration

### MCP Server Management

- Add servers via `MCPServerForm` → stored in database → loaded dynamically into agent
- Tool names prefixed with server name to prevent conflicts
- Server configs support environment variables and command arguments

### Tool Approval Workflow

- Agent pauses at tool calls, emits interrupt with tool details
- Frontend shows approval UI, sends `allowTool=allow/deny` parameter
- Uses `Command.resume()` pattern instead of new message input

## Project-Specific Patterns

### Agent Configuration

- `ensureAgent()` ensures Postgres checkpointer is initialized before agent creation
- MCP servers queried from database on each agent creation for dynamic tool loading
- Supports OpenAI/Google models via `AgentConfigOptions`

### API Route Patterns

- Stream endpoints use `dynamic = "force-dynamic"` and `runtime = "nodejs"`
- Query params for streaming: `content`, `threadId`, `model`, `allowTool`, `approveAllTools`
- MCP server CRUD follows REST patterns in `/api/mcp-servers/route.ts`
- File upload endpoint: `/api/agent/upload` accepts multipart/form-data, returns file metadata

### Streaming Architecture

- SSE with React Query: `useChatThread` manages optimistic UI + streaming updates
- Message accumulation: Frontend concatenates text chunks by message ID
- Tool approval flow uses Command objects with `resume` action

## File Upload & Storage

### MinIO Setup (Development)

- **S3-compatible object storage** runs in Docker alongside Postgres
- **Bucket**: `uploads` (auto-created on startup, public download access)
- **Web Console**: http://localhost:9001 (credentials: minioadmin/minioadmin)
- **S3 API**: http://localhost:9000

### Supported File Types

- **Images**: PNG, JPEG (max 5MB)
- **Documents**: PDF (max 10MB)
- **Text**: Markdown, Plain text (max 2MB)

### Production Migration

To switch to AWS S3, Cloudflare R2, or other S3-compatible storage:

1. Update `.env` variables:

   ```bash
   S3_ENDPOINT=  # Empty for AWS S3, or your provider's endpoint
   S3_ACCESS_KEY_ID=your_production_key
   S3_SECRET_ACCESS_KEY=your_production_secret
   S3_FORCE_PATH_STYLE=false  # false for AWS S3/R2
   ```

2. No code changes required - AWS SDK handles the rest!

### File Upload Flow

1. User selects files in `MessageInput` component
2. Files uploaded to MinIO via `/api/agent/upload` endpoint
3. File metadata (URL, key, name, type, size) stored in message options
4. Files can be passed to agent for multimodal processing

### Storage Libraries

- `@aws-sdk/client-s3` - S3 client (works with MinIO + AWS S3)
- `@aws-sdk/lib-storage` - Multipart uploads for large files
- Storage utilities in `src/lib/storage/`

## Important Notes

- Always run `pnpm prisma:generate` after schema changes
- Restart dev server to pick up new MCP server configurations
- Database runs on port 5434 (not default 5432) to avoid conflicts
- MinIO runs on ports 9000 (API) and 9001 (Console)
- Uses pnpm as package manager (see packageManager in package.json)
