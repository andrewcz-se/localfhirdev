# Mirth MCP Server - Context & Guidelines

This project is a Model Context Protocol (MCP) server that provides a connection between AI agents and the Mirth Connect REST API. It enables autonomous management of the basic Mirth channel lifecycle using a set of MCP tools.

## Project Overview

- **Core Technology**: Node.js (ESM), `@modelcontextprotocol/sdk`, `axios`, `handlebars`.
- **Purpose**: To provide a standardized interface for interacting with Mirth Connect via an AI agent, allowing for channel generation, validation, deployment, and monitoring.
- **Architecture**: 
  - `index.js`: Main entry point, handles MCP protocol (stdio) and tool registration.
  - `mirthClient.js`: Singleton Axios client managing authentication (JSESSIONID), SSL (`rejectUnauthorized`), and API requests.
  - `tools/`: Individual modules for each MCP tool (e.g., `create_mirth_channel.js`).
  - `templates/`: Handlebars XML templates for generating Mirth channel configurations.

## Available tools

- **generate_channel_xml:** Creates a Mirth-compatible XML configuration using Handlebars templates. It requires details like ports and destination IPs to populate the template.
- **create_mirth_channel:** Submits the generated XML to the Mirth server. It includes logic to self-correct minor issues (like missing UUIDs) and identifies if user input is needed for critical errors.
- **deploy_mirth_channel:** Activates a channel on the Mirth engine so it can begin processing data. It can automatically resolve a channel name to its required UUID.
- **undeploy_mirth_channel:** Stops a running channel and removes it from the active Mirth engine.
- **list_mirth_channels:** Returns a list of all channels on the server, mapping their human-readable names to their unique UUIDs and current states.
- **get_channel_status:** Provides real-time runtime statistics, including the current state (Started/Stopped), message counts, and error totals.

## Building and Running

- **Install Dependencies**: `pnpm install` or `npm install`.
- **Configuration**: 
  - Copy `.env.example` to `.env`.
  - Update the example user name and password and set `MIRTH_URL`, `MIRTH_USERNAME`, `MIRTH_PASSWORD`.
  - Set `NODE_TLS_REJECT_UNAUTHORIZED=0` for local Mirth instances with self-signed certs.
- **Run the Server**: `node index.js`.

## Behaviour Rules

1.  **Creation Workflow**: Always follows the sequence: `generate_channel_xml` → `create_mirth_channel`.
2.  **UUID Resolution**: **Never** asks the user for a channel UUID. Always uses `list_mirth_channels` to resolve a channel name to its UUID.
3.  **Error Handling & User Input**: 
    - The `create_mirth_channel` tool attempts to self-correct minor XML issues (e.g., missing UUIDs, revision numbers).
    - If it returns `userInputRequired`, all requested information is gathered from the user in a **single turn**.
    - If error count is greater than zero in `get_channel_status`, this is reported clearly to the user.
4.  **Status Reporting**: After calling `get_channel_status`, always provides a concise summary including:
    - Channel Name and Current State (e.g., Started, Stopped).
    - Error and Re-routed counts.
    - Any recommended corrective actions.

## Development Conventions

- **Tool Design**: Each new tool can be added as a separate file in `tools/` and registered in `index.js`.
- **Mirth API Usage**: 
  - Uses `mirthClient.js` for all communication.
  - Ensure the `X-Requested-With` header is present (set by default in the client).
  - API endpoints follow the `/api/...` pattern (e.g., `/api/channels`).
  - Reference `openapi.json` to add support for more Mirth API Endpoints (baselined to Mirth 4.5.2)
- **Templates**: Handlebars templates should use camelCase for placeholders (e.g., `{{channelName}}`, `{{sourcePort}}`).

## Key Files

- `index.js`: MCP server setup and tool definitions.
- `mirthClient.js`: Authentication and API interaction logic.
- `tools/`: Individual modules for each MCP tool (e.g., `create_mirth_channel.js`).
- `templates/channel-template-mllp-to-mllp.xml`: The primary reference for Mirth channel XML structure for MLLP to MLLP interfaces.
- `templates/channel-template-mllp-to-http.xml`: The primary reference for Mirth channel XML structure for MLLP to HTTP interfaces.
- `openapi.json`: The Mirth Connect REST API specification.
- `config/`: Reference MCP config files for Codex (config.toml) and Gemini (settings.json). Note, I tested this on a local server with NODE_TLS_REJECT_UNAUTHORIZED=0 to bypass TLS verification. You can export and setup your Mirth keys as required.
