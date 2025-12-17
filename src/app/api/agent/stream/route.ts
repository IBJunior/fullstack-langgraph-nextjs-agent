import { NextRequest } from "next/server";
import { streamResponse } from "@/services/agentService";
import type { MessageResponse } from "@/types/message";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint that streams incremental AI response chunks produced by the LangGraph React agent.
 * Query params:
 *  - content: user message text
 *  - threadId: thread identifier for conversation context
 *  - history: JSON stringified array of MessageResponse (from client localStorage)
 *  - model: optional model override
 *  - allowTool: "allow" | "deny" for tool approval
 *  - approveAllTools: boolean for auto-approval
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userContent = searchParams.get("content") || "";
  const threadId = searchParams.get("threadId") || "unknown";
  const model = searchParams.get("model") || undefined;
  const allowTool = searchParams.get("allowTool") as "allow" | "deny" | null;
  const toolsParam = searchParams.get("tools") || "";
  const approveAllTools = searchParams.get("approveAllTools") === "true";
  const historyParam = searchParams.get("history") || "[]"; // NEW

  const tools = toolsParam
    ? toolsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  // Parse client history
  let history: MessageResponse[] = [];
  try {
    history = JSON.parse(historyParam);
  } catch (e) {
    console.error("Failed to parse history from client:", e);
    // Continue with empty history rather than failing
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: MessageResponse) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial comment to establish stream
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Run the agent streaming in the background
      (async () => {
        try {
          const iterable = await streamResponse({
            threadId,
            userText: userContent,
            history, // PASS CLIENT HISTORY
            opts: { model, tools, allowTool: allowTool || undefined, approveAllTools },
          });
          for await (const chunk of iterable) {
            // Only forward AI/tool chunks; ignore human/system
            if (chunk.type === "ai" || chunk.type === "tool") {
              send(chunk);
            }
          }

          // Signal completion
          controller.enqueue(encoder.encode("event: done\n"));
          controller.enqueue(encoder.encode("data: {}\n\n"));
        } catch (err: unknown) {
          // Emit an error event (client onerror will capture general network; providing data for diagnostics)
          controller.enqueue(encoder.encode("event: error\n"));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ message: (err as Error)?.message || "Stream error", threadId })}\n\n`,
            ),
          );
        } finally {
          controller.close();
        }
      })();
    },
    cancel() {
      // If client disconnects, nothing special yet (LangGraph stream will stop as iteration halts)
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
