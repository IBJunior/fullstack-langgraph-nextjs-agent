import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import fs from "fs";
import path from "path";

interface StdioMCPServerConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface HttpMCPServerConfig {
  transport: "http";
  url: string;
  headers?: Record<string, string>;
}

type MCPServerConfig = StdioMCPServerConfig | HttpMCPServerConfig;

/**
 * Loads enabled MCP servers from mcp-config.json and formats them for MultiServerMCPClient
 */
export async function getMCPServerConfigs(): Promise<Record<string, MCPServerConfig>> {
  try {
    const configPath = path.join(process.cwd(), "mcp-config.json");

    if (!fs.existsSync(configPath)) {
      console.warn("mcp-config.json not found, no MCP servers will be loaded");
      return {};
    }

    const fileContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(fileContent);

    if (!config.servers || !Array.isArray(config.servers)) {
      console.error("Invalid mcp-config.json structure: servers array not found");
      return {};
    }

    const configs: Record<string, MCPServerConfig> = {};

    for (const server of config.servers) {
      // Skip disabled servers
      if (!server.enabled) continue;

      if (server.type === "stdio" && server.command) {
        const config: StdioMCPServerConfig = {
          transport: "stdio",
          command: server.command,
        };

        if (server.args && Array.isArray(server.args)) {
          config.args = server.args.filter(
            (arg: unknown): arg is string => typeof arg === "string",
          );
        }
        if (server.env && typeof server.env === "object" && server.env !== null) {
          config.env = server.env as Record<string, string>;
        }

        configs[server.name] = config;
      } else if (server.type === "http" && server.url) {
        const config: HttpMCPServerConfig = {
          transport: "http",
          url: server.url,
        };

        if (server.headers && typeof server.headers === "object" && server.headers !== null) {
          config.headers = server.headers as Record<string, string>;
        }

        configs[server.name] = config;
      }
    }

    console.log(`Loaded ${Object.keys(configs).length} enabled MCP server(s)`);
    return configs;
  } catch (error) {
    console.error("Failed to load MCP config:", error);
    return {};
  }
}

/**
 * Creates and initializes a MultiServerMCPClient with the current database configurations
 */
export async function createMCPClient(): Promise<MultiServerMCPClient | null> {
  try {
    const mcpServers = await getMCPServerConfigs();

    if (Object.keys(mcpServers).length === 0) {
      return null;
    }

    const client = new MultiServerMCPClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpServers: mcpServers as any, // Complex MCP server config types require type assertion
      throwOnLoadError: false, // Don't fail if some servers can't connect
      prefixToolNameWithServerName: true, // Prevent tool name conflicts
    });

    return client;
  } catch (error) {
    console.error("Failed to create MCP client:", error);
    return null;
  }
}

/**
 * Gets tools from the MCP client if available
 */
export async function getMCPTools() {
  try {
    const client = await createMCPClient();
    if (!client) {
      return [];
    }

    const tools = await client.getTools();
    return tools;
  } catch (error) {
    console.error("Failed to get MCP tools:", error);
    return [];
  }
}
