# StackPath AI 🚀

> **AI-powered tech learning roadmaps tailored to your background**

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://roadmap.documentorai.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph.js-1.0-green?logo=langchain)](https://langchain-ai.github.io/langgraphjs/)

## Why StackPath AI?

Learning a new tech stack is overwhelming. StackPath AI creates personalized learning plans based on your experience, time commitment, and goals through an interactive conversational AI interview.

## Features

- 🤖 **Conversational AI Interview** - Natural interaction to understand your background and goals
- 📚 **Curated Resources** - Links to official docs, tutorials, and courses
- 📅 **Phase-Based Learning** - Clear milestones and structured progression
- 📄 **Professional PDF Roadmap** - Downloadable learning plan
- 💾 **Client-Side Persistence** - No database required, works offline after initial load
- 🔗 **Powered by MCP** - Context7 and web_fetch MCP servers for enhanced capabilities

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- OpenAI API key or Google AI API key

### 1. Clone and Install

```bash
git clone https://github.com/agentailor/documentorai-roadmap.git
cd documentorai-roadmap
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# AI Models (choose one or both)
OPENAI_API_KEY="sk-..."
# or
GOOGLE_API_KEY="..."

# Optional: Default model
DEFAULT_MODEL="gpt-4o-mini"
```

### 3. Configure MCP Servers (Optional)

Edit `mcp-config.json` to customize MCP tool servers:

```json
{
  "servers": [
    {
      "name": "context7",
      "enabled": true,
      "type": "http",
      "url": "https://mcp.context7.ai",
      "headers": {}
    }
  ]
}
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) - **no database setup needed!**

## Architecture

StackPath AI uses an innovative **client-side persistence** architecture similar to Excalidraw:

```
┌─────────────────────────────────────────────────────────┐
│ Browser (Client)                                        │
│                                                         │
│  localStorage                    React Components      │
│  ├── threads                     ├── ThreadList        │
│  ├── messages_threadA            ├── ChatInterface     │
│  └── active_thread              └── MessageList       │
│                                         │              │
│                                         ▼              │
│                                  React Query Cache     │
│                                         │              │
└─────────────────────────────────────────┼──────────────┘
                                          │
                                          │ SSE + history
                                          ▼
┌─────────────────────────────────────────────────────────┐
│ Server (Next.js API)                                    │
│                                                         │
│  /api/agent/stream                                      │
│         │                                               │
│         ├──► Parse history from client                 │
│         ├──► Hydrate MemorySaver                       │
│         └──► LangGraph Agent.stream()                  │
│                      │                                  │
│                      ├──► LLM (OpenAI/Google)          │
│                      └──► MCP Tools (from config)      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Architecture Features

- **Frontend**: Next.js 15 with React 19 and TypeScript
- **State Management**: React Query for optimistic UI
- **Persistence**: Browser localStorage (Excalidraw-style)
- **Agent**: Server-side LangGraph.js with ephemeral memory
- **Memory Hydration**: Client sends conversation history to server on each request
- **Tools**: Pre-configured MCP servers from JSON config file

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Built With

- **[LangGraph.js](https://langchain-ai.github.io/langgraphjs/)** - Agent orchestration and workflow management
- **[Next.js 15](https://nextjs.org/)** - Full-stack React framework with App Router
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - Context7 and web_fetch servers
- **[React Query](https://tanstack.com/query/latest)** - Async state management and caching
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **[shadcn/ui](https://ui.shadcn.com/)** - High-quality React components

## Development

### Available Scripts

```bash
pnpm dev            # Start development server with Turbopack
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Run ESLint
pnpm format         # Format with Prettier
pnpm format:check   # Check formatting
```

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/agent/         # Agent streaming API
│   └── thread/            # Thread pages
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/
│   ├── agent/            # Agent builder, MCP integration, memory
│   └── storage/          # localStorage utilities
├── services/             # Business logic
└── types/                # TypeScript definitions

mcp-config.json           # MCP server configuration
```

### Key Files

- **Agent Core**: `src/lib/agent/builder.ts`, `src/lib/agent/index.ts`
- **Memory Hydration**: `src/lib/agent/memory.ts`
- **MCP Integration**: `src/lib/agent/mcp.ts`
- **localStorage**: `src/lib/storage/localStorage.ts`
- **Streaming API**: `src/app/api/agent/stream/route.ts`
- **Chat Interface**: `src/components/Thread.tsx`
- **Chat Logic**: `src/hooks/useChatThread.ts`

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/agentailor/documentorai-roadmap)

1. Click the Deploy button above
2. Add environment variables:
   - `OPENAI_API_KEY` or `GOOGLE_API_KEY`
   - `DEFAULT_MODEL` (optional)
3. Deploy - no database configuration needed!

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/agentailor/documentorai-roadmap)

### Render

1. Create a new Web Service
2. Connect your repository
3. Add environment variables
4. Deploy

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow TypeScript strict mode
- Use Prettier for code formatting (run `pnpm format` before committing)
- Add JSDoc comments for public APIs
- Test thoroughly, especially localStorage interactions
- Update documentation for new features

## Learning Resources

### LangGraph.js

- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [StateGraph API Reference](https://langchain-ai.github.io/langgraphjs/reference/)
- [Memory Management](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)

### Model Context Protocol

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [Building MCP Servers](https://modelcontextprotocol.io/docs/building-servers)

### Next.js & React

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Release Notes](https://react.dev/blog/2024/12/05/react-19)
- [React Query Documentation](https://tanstack.com/query/latest/docs/framework/react/overview)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [LangChain](https://github.com/langchain-ai) for the incredible AI framework ecosystem
- [Model Context Protocol](https://modelcontextprotocol.io/) for the tool integration standard
- [Next.js](https://nextjs.org/) team for the amazing React framework
- [Excalidraw](https://excalidraw.com/) for inspiration on client-side architecture

---

**Want AI-powered documentation assistance?** Check out [DocuMentor AI](https://documentorai.io)
