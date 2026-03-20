import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { generateChannelXml } from "./tools/generate_channel_xml.js";
import { createMirthChannel } from "./tools/create_mirth_channel.js";
import { deployMirthChannel } from "./tools/deploy_mirth_channel.js";
import { undeployMirthChannel } from "./tools/undeploy_mirth_channel.js";
import { listMirthChannels } from "./tools/list_mirth_channels.js";
import { getChannelStatus } from "./tools/get_channel_status.js";

const server = new McpServer({
  name: "mirth-mcp-server",
  version: "1.0.0",
});

/**
 * Mirth MCP Server Behaviour Rules:
 * - The correct order for creating a channel is always: generate_channel_xml → create_mirth_channel
 * - Never ask the user for a channel UUID — always resolve it via list_channels
 * - When asking the user for missing values, collect everything needed in a single prompt, not across multiple turns
 * - After get_channel_status, always summarise the outcome to the user: channel name, state, error count, and any corrective actions taken
 */

// Tool registrations
server.registerTool(
  "generate_channel_xml",
  {
    description: "Generate a Mirth channel XML from a template. Always call this before create_mirth_channel. " +
      "If source_port, destination_ip or destination_port are not provided, stop and ask the user " +
      "for ALL missing values in a single message before proceeding.",
    inputSchema: {
      channel_name: z.string().describe("Name of the channel"),
      source_port: z.number().describe("TCP/MLLP port to listen on"),
      destination_ip: z.string().describe("Destination IP or hostname"),
      destination_port: z.number().describe("Destination port"),
      message_type: z.string().optional().default("HL7V2").describe("Message type, default HL7V2"),
      template_type: z.enum(["mllp-to-mllp", "mllp-to-http"]).optional().default("mllp-to-mllp")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: await generateChannelXml(args) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "create_mirth_channel",
  {
    description: "Create a new Mirth channel using XML. Only call this after generate_channel_xml has produced " +
      "valid XML. Returns the new channel UUID on success.",
    inputSchema: {
      xml_payload: z.string().describe("Complete Mirth channel XML from generate_channel_xml")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await createMirthChannel(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "deploy_mirth_channel",
  {
    description: "Deploy a Mirth channel. Accepts channel_id or channel_name. If only channel_name is provided, " +
      "automatically call list_mirth_channels to resolve the UUID — do not ask the user for it.",
    inputSchema: {
      channel_id: z.string().optional().describe("Channel UUID"),
      channel_name: z.string().optional().describe("Channel name — resolved to UUID automatically")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await deployMirthChannel(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "undeploy_mirth_channel",
  {
    description: "Undeploy a running Mirth channel. Accepts channel_id or channel_name. " +
      "If only channel_name is provided, resolve UUID via list_mirth_channels automatically.",
    inputSchema: {
      channel_id: z.string().optional().describe("Channel UUID"),
      channel_name: z.string().optional().describe("Channel name — resolved to UUID automatically")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await undeployMirthChannel(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "list_mirth_channels",
  {
    description: "List all Mirth channels returning name, UUID and current state. Call this first whenever " +
      "you need to resolve a channel name to a UUID. Also call this before generating new channel " +
      "XML to understand existing naming conventions.",
    inputSchema: {
      name_filter: z.string().optional().describe("Optional filter to match against channel names")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await listMirthChannels(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_channel_status",
  {
    description: "Get the runtime status of a Mirth channel including state, error count and queued messages. " +
      "Always call this after deploy_mirth_channel to confirm the channel is healthy. " +
      "If error count is greater than zero, report this clearly to the user." +
      "If only channel_name is provided, resolve UUID via list_mirth_channels automatically.",
    inputSchema: {
      channel_id: z.string().optional().describe("Channel UUID"),
      channel_name: z.string().optional().describe("Channel name — resolved to UUID automatically")
    }
  },
  async (args) => {
    try {
      return { content: [{ type: "text", text: JSON.stringify(await getChannelStatus(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mirth MCP Server running on stdio");
}

runServer();
