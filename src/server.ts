import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  getCurrentConversation,
  getCurrentConversationSchema,
} from './tools/get-current-conversation.js';
import {
  getCurrentConversationUpto,
  getCurrentConversationUptoSchema,
} from './tools/get-current-conversation-upto.js';

export class ClaudistServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'claudist-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [getCurrentConversationSchema, getCurrentConversationUptoSchema],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: string;

        switch (name) {
          case 'getCurrentConversation':
            result = await getCurrentConversation(
              args as Parameters<typeof getCurrentConversation>[0]
            );
            break;
          case 'getCurrentConversationUpto':
            result = await getCurrentConversationUpto(
              args as Parameters<typeof getCurrentConversationUpto>[0]
            );
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    process.stderr.write('Claudist MCP server started\n');
  }
}

export async function startServer() {
  const server = new ClaudistServer();
  await server.start();
}
