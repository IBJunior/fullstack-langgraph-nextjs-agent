# LangGraph.js AI Agent Template

> **A production-ready Next.js template for building AI agents with LangGraph.js, featuring Model Context Protocol (MCP) integration, human-in-the-loop tool approval, and persistent memory.**

![Demo](docs/images/hero-demo.gif)

_Complete agent workflow: user input → tool approval → execution → streaming response_

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.4-black?logo=next.js)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph.js-0.4-green?logo=langchain)](https://langchain-ai.github.io/langgraphjs/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.19-2D3748?logo=prisma)](https://www.prisma.io/)

## Features

### **Dynamic Tool Loading with MCP**

- **Model Context Protocol** integration for dynamic tool management
- Add tools via web UI - no code changes required
- Support for both stdio and HTTP MCP servers
- Tool name prefixing to prevent conflicts

### **Human-in-the-Loop Tool Approval**

- Interactive tool call approval before execution
- Granular control with approve/deny/modify options
- Optional auto-approval mode for trusted environments
- Real-time streaming with tool execution pauses

<div align="center">
  <img src="docs/images/tool-approval.png" alt="Tool Approval Dialog" width="600" />
  <p><em>Tool approval dialog with detailed parameter inspection</em></p>
</div>

### **Persistent Conversation Memory**

- LangGraph checkpointer with PostgreSQL backend
- Full conversation history preservation
- Thread-based organization
- Seamless resume across sessions

### **Multimodal File Uploads**

<div align="center">
  <img src="docs/images/file-upload.gif" alt="File upload" width="600" />
  <p><em>Tool approval dialog with detailed parameter inspection</em></p>
</div>

- Upload images, PDFs, and text files with messages
- S3-compatible storage (MinIO for development)
- Automatic file processing for AI consumption
- Production-ready with AWS S3, Cloudflare R2 support

### **Real-time Streaming Interface**

- Server-Sent Events (SSE) for live responses
- Optimistic UI updates with React Query
- Type-safe message handling
- Error recovery and graceful degradation

### **Modern Tech Stack**

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Prisma ORM, PostgreSQL, MinIO/S3
- **AI**: LangGraph.js, OpenAI/Google models
- **UI**: shadcn/ui components, Lucide icons

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Docker (for PostgreSQL and MinIO)
- OpenAI API key or Google AI API key

### 1. Clone and Install

```bash
git clone https://github.com/IBJunior/fullstack-langgraph-nextjs-agent.git
cd fullstack-langgraph-nextjs-agent
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5434/agent_db"

# AI Models (choose one or both)
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="..."

# Optional: Default model
DEFAULT_MODEL="gpt-4o-mini"  # or "gemini-1.5-flash"
```

### 3. Start Services

```bash
docker compose up -d  # Starts PostgreSQL and MinIO
```

### 4. Database Setup

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

### 5. Run Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to start chatting with your AI agent!

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="docs/images/chat-interface.png" alt="Chat Interface" width="400" />
      <br /><strong>Main Chat Interface</strong>
      <br />Clean, responsive design with streaming responses
    </td>
    <td align="center">
      <img src="docs/images/mcp-configuration.png" alt="MCP Configuration" width="400" />
      <br /><strong>MCP Server Management</strong>
      <br />Easy setup and configuration of tool servers
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/images/thread-sidebar.png" alt="Thread Management" width="400" />
      <br /><strong>Thread Management</strong>
      <br />Organize conversations with persistent history
    </td>
    <td align="center">
      <img src="docs/images/agent-configuration.png" alt="Streaming Response" width="400" />
      <br /><strong>Agent Configurations</strong>
      <br /> Multiple model Providers Support
    </td>
  </tr>
</table>

## Usage Guide

### Adding MCP Servers

1. **Navigate to Settings** - Click the gear icon in the sidebar
2. **Add MCP Server** - Click "Add MCP Server" button
3. **Configure Server**:
   - **Name**: Unique identifier (e.g., "filesystem")
   - **Type**: Choose `stdio` or `http`
   - **Command**: For stdio servers (e.g., `npx @modelcontextprotocol/server-filesystem`)
   - **Args**: Command arguments (e.g., `["/path/to/allow"]`)
   - **URL**: For HTTP servers

![Add MCP Server](docs/images/add-mcp-server.png)
_MCP server configuration form with example filesystem server setup_

### Example MCP Server Configurations

#### Filesystem Server (stdio)

```json
{
  "name": "filesystem",
  "type": "stdio",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-filesystem", "/Users/yourname/Documents"]
}
```

#### HTTP API Server

```json
{
  "name": "web-api",
  "type": "http",
  "url": "http://localhost:8080/mcp",
  "headers": {
    "Authorization": "Bearer your-token"
  }
}
```

### Tool Approval Workflow

1. **Agent Requests Tool** - AI suggests using a tool
2. **Approval Prompt** - Interface shows tool details and asks for approval
3. **User Decision**:
   - ✅ **Allow**: Execute tool as requested
   - ❌ **Deny**: Skip tool execution
   - ✏️ **Modify**: Edit tool parameters before execution
4. **Continue Conversation** - Agent responds with tool results

## Architecture

### High-Level Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js UI   │◄──►│  Agent Service   │◄──►│  LangGraph.js   │
│   (React 19)   │    │  (SSE Streaming) │    │    Agent        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Query   │    │     Prisma       │    │  MCP Clients    │
│   (State Mgmt)  │    │   (Database)     │    │   (Tools)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                  ┌──────────────────────────────┐
                  │   PostgreSQL  │  MinIO/S3    │
                  │  (Persistence)│ (File Store) │
                  └──────────────────────────────┘
```

### Core Components

#### Agent Builder (`src/lib/agent/builder.ts`)

- Creates StateGraph with agent→tool_approval→tools flow
- Handles tool approval interrupts
- Manages model binding and system prompts

#### MCP Integration (`src/lib/agent/mcp.ts`)

- Dynamic tool loading from database-stored MCP servers
- Support for stdio and HTTP transports
- Tool name prefixing for conflict prevention

#### Streaming Service (`src/services/agentService.ts`)

- Server-Sent Events for real-time responses
- Message processing and chunk aggregation
- Tool approval workflow handling

#### Chat Hook (`src/hooks/useChatThread.ts`)

- React Query integration for optimistic UI
- Stream management and error handling
- Tool approval user interface

#### File Storage (`src/lib/storage/`)

- S3-compatible storage with MinIO (development) or AWS S3 (production)
- File validation, upload, and content processing for AI
- Multimodal message building with base64 conversion

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

### Available Scripts

```bash
pnpm dev                 # Start development server with Turbopack
pnpm build              # Production build
pnpm start              # Start production server
pnpm lint               # Run ESLint
pnpm format             # Format with Prettier
pnpm format:check       # Check formatting

# Database
pnpm prisma:generate    # Generate Prisma client (after schema changes)
pnpm prisma:migrate     # Create and apply migrations
pnpm prisma:studio      # Open Prisma Studio (database UI)
```

### Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes (stream, upload, mcp-servers)
│   └── thread/         # Thread-specific pages
├── components/         # React components
├── hooks/              # Custom React hooks
├── lib/                # Core utilities
│   ├── agent/          # Agent-related logic
│   └── storage/        # File upload & S3 utilities
├── services/           # Business logic
└── types/              # TypeScript definitions

prisma/
├── schema.prisma       # Database schema
└── migrations/         # Database migrations
```

### Key Files

- **Agent Configuration**: `src/lib/agent/builder.ts`, `src/lib/agent/mcp.ts`
- **API Endpoints**: `src/app/api/agent/stream/route.ts`, `src/app/api/agent/upload/route.ts`
- **File Storage**: `src/lib/storage/` (validation, upload, content processing)
- **Database Models**: `prisma/schema.prisma`
- **Main Chat Interface**: `src/components/Thread.tsx`, `src/components/MessageInput.tsx`
- **Streaming Logic**: `src/hooks/useChatThread.ts`

## Contributing

We welcome contributions! This project is designed to be a community resource for LangGraph.js development.

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use Prettier for formatting
- Add JSDoc comments for public APIs
- Test MCP server integrations thoroughly
- Update documentation for new features

## Learning Resources

### LangGraph.js

- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [StateGraph API Reference](https://langchain-ai.github.io/langgraphjs/reference/modules/langgraph.html)
- [Checkpointer Guide](https://langchain-ai.github.io/langgraphjs/how-tos/persistence-postgres)

### Model Context Protocol (MCP)

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [Building MCP Servers](https://modelcontextprotocol.io/docs/building-servers)
- [Docker MCP Catalog](https://blog.agentailor.com/posts/docker-mcp-catalog-and-toolkit?utm_source=github_fullstack_repo)

### Next.js & React

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [React Query (TanStack Query)](https://tanstack.com/query/latest)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [LangChain](https://github.com/langchain-ai) for the incredible AI framework
- [Model Context Protocol](https://modelcontextprotocol.io/) for the tool integration standard
- [Next.js](https://nextjs.org/) team for the amazing React framework

---

**Ready to build your next AI agent?**

[Get Started](#quick-start)
