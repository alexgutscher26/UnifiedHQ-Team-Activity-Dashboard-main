import { auth } from '@/lib/auth';
import { createMcpHandler } from '@vercel/mcp-adapter';
import { withMcpAuth } from 'better-auth/plugins';
import { z } from 'zod';

const handler = withMcpAuth(auth, (req, session) => {
  // session contains the access token record with scopes and user ID
  return createMcpHandler(
    server => {
      server.tool(
        'echo',
        'Echo a message',
        { message: z.string() },
        async ({ message }) => {
          return {
            content: [{ type: 'text', text: `Tool echo: ${message}` }],
          };
        }
      );

      server.tool(
        'get-user-info',
        'Get information about the authenticated user',
        {},
        async () => {
          return {
            content: [
              {
                type: 'text',
                text: `User ID: ${session.userId}, Scopes: ${Array.isArray(session.scopes) ? session.scopes.join(', ') : session.scopes || 'none'}`,
              },
            ],
          };
        }
      );
    },
    {
      capabilities: {
        tools: {
          echo: {
            description: 'Echo a message',
          },
          'get-user-info': {
            description: 'Get information about the authenticated user',
          },
        },
      },
    },
    {
      basePath: '/api',
      verboseLogs: true,
      maxDuration: 60,
    }
  )(req);
});

export { handler as GET, handler as POST, handler as DELETE };
