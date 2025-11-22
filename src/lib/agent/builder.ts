import {
  StateGraph,
  MessagesAnnotation,
  END,
  START,
  BaseCheckpointSaver,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SystemMessage, ToolMessage, ContentBlock } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import { DynamicTool } from "@langchain/core/tools";

export class AgentBuilder {
  private toolNode: ToolNode;
  private readonly model: BaseChatModel;
  private tools: DynamicTool[];
  private systemPrompt: string = "";
  private approveAllTools: boolean = false;
  private checkpointer?: BaseCheckpointSaver;

  constructor({
    tools,
    llm,
    prompt,
    checkpointer,
    approveAllTools,
  }: {
    tools: DynamicTool[];
    llm: BaseChatModel;
    prompt: string;
    checkpointer?: BaseCheckpointSaver;
    approveAllTools?: boolean;
  }) {
    if (!llm) {
      throw new Error("Language model (llm) is required");
    }
    this.tools = tools || [];
    this.toolNode = new ToolNode(tools || []);
    this.systemPrompt = prompt;
    this.model = llm;
    this.checkpointer = checkpointer;
    this.approveAllTools = approveAllTools || false;
  }

  private shouldApproveTool(state: typeof MessagesAnnotation.State) {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls?.length
    ) {
      return "tool_approval";
    }
    return END;
  }

  private async approveToolCall(state: typeof MessagesAnnotation.State) {
    if (this.approveAllTools) {
      return new Command({ goto: "tools" });
    }
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    if (
      "tool_calls" in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls?.length
    ) {
      const toolCall = lastMessage.tool_calls![lastMessage.tool_calls!.length - 1];

      const humanReview = interrupt<
        {
          question: string;
          toolCall: ToolCall;
        },
        {
          action: string;
          data: string | ContentBlock[];
        }
      >({
        question: "Is this correct?",
        toolCall: toolCall,
      });
      const reviewAction = humanReview.action;
      const reviewData = humanReview.data;
      if (reviewAction === "continue") {
        return new Command({ goto: "tools" });
      } else if (reviewAction === "update") {
        const updatedMessage = {
          role: "ai",
          content: lastMessage.content,
          tool_calls: [
            {
              id: toolCall.id,
              name: toolCall.name,
              args: reviewData,
            },
          ],
          id: lastMessage.id,
        };
        return new Command({
          goto: "tools",
          update: { messages: [updatedMessage] },
        });
      } else if (reviewAction === "feedback") {
        const toolMessage = new ToolMessage({
          name: toolCall.name,
          content: reviewData,
          tool_call_id: toolCall.id,
        });
        return new Command({
          goto: "agent",
          update: { messages: [toolMessage] },
        });
      }
      throw new Error("Invalid review action");
    }
  }

  private async callModel(state: typeof MessagesAnnotation.State) {
    if (!this.model || !this.model.bindTools) {
      throw new Error("Invalid or missing language model (llm)");
    }
    const messages = [
      // Add always system prompt so it is not duplicated in the messages
      new SystemMessage(this.systemPrompt),
      ...state.messages,
    ];
    const modelInvoker = this.model.bindTools(this.tools);
    const response = await modelInvoker.invoke(messages);
    return { messages: response };
  }

  build() {
    const stateGraph = new StateGraph(MessagesAnnotation);
    stateGraph
      .addNode("agent", this.callModel.bind(this))
      .addNode("tools", this.toolNode)
      .addNode("tool_approval", this.approveToolCall.bind(this), {
        ends: ["tools", "agent"],
      })
      .addEdge(START, "agent")
      .addConditionalEdges("agent", this.shouldApproveTool.bind(this), ["tool_approval", END])
      .addEdge("tools", "agent");

    const compiledGraph = stateGraph.compile({ checkpointer: this.checkpointer });
    return compiledGraph;
  }
}
