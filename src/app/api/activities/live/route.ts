import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Handles the Server-Sent Events (SSE) connection for live updates.
 *
 * This function first attempts to retrieve the user session from the request headers. If the session is valid and the user is authenticated, it establishes a readable stream for SSE, sending connection messages and periodic heartbeats. If the user is not authenticated, it returns an error message. The function also manages connection cleanup on disconnection events.
 *
 * @param request - The incoming NextRequest object containing the connection request details.
 * @returns A Response object containing the SSE stream or an error message if the user is unauthorized or if an error occurs during connection establishment.
 * @throws Error If there is an issue with the SSE stream or connection handling.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[SSE] Received connection request');

    // Try to get session from cookies first
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    console.log('[SSE] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
    });

    if (!session?.user) {
      console.log('[SSE] Unauthorized access attempt');
      // Return SSE error message instead of JSON
      return new Response(
        `data: ${JSON.stringify({
          type: 'error',
          message: 'Unauthorized - please refresh the page',
          timestamp: new Date().toISOString(),
        })}\n\n`,
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
          },
        }
      );
    }

    const userId = session.user.id;
    console.log(`[SSE] User ${userId} connecting to live updates`);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        try {
          // Send initial connection message
          const data = JSON.stringify({
            type: 'connected',
            message: 'Connected to live updates',
            timestamp: new Date().toISOString(),
          });

          controller.enqueue(`data: ${data}\n\n`);

          // Store the controller for this user's connection
          if (!(global as any).userConnections) {
            (global as any).userConnections = new Map();
          }
          (global as any).userConnections.set(userId, controller);

          // Send periodic heartbeat to keep connection alive
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeat = JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
              });
              controller.enqueue(`data: ${heartbeat}\n\n`);
            } catch (error) {
              console.error('Heartbeat error:', error);
              clearInterval(heartbeatInterval);
              (global as any).userConnections?.delete(userId);
            }
          }, 30000); // Send heartbeat every 30 seconds

          // Clean up on connection close
          request.signal.addEventListener('abort', () => {
            console.log(`[SSE] User ${userId} disconnected`);
            clearInterval(heartbeatInterval);
            (global as any).userConnections?.delete(userId);
            try {
              controller.close();
            } catch (error) {
              console.error('Error closing controller:', error);
            }
          });
        } catch (error) {
          console.error('Error in SSE stream start:', error);
          try {
            controller.close();
          } catch (closeError) {
            console.error(
              'Error closing controller on start error:',
              closeError
            );
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('SSE connection error:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Failed to establish connection' },
      { status: 500 }
    );
  }
}

// Helper function to broadcast updates to connected users
export function broadcastToUser(userId: string, data: any) {
  const userConnections = (global as any).userConnections;
  if (userConnections?.has(userId)) {
    const controller = userConnections.get(userId);
    try {
      const message = JSON.stringify({
        type: 'activity_update',
        data,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Failed to broadcast to user:', error);
      userConnections?.delete(userId);
    }
  }
}

// Helper function to broadcast to all connected users
export function broadcastToAll(data: any) {
  const userConnections = (global as any).userConnections;
  if (userConnections) {
    for (const [userId, controller] of userConnections) {
      try {
        const message = JSON.stringify({
          type: 'activity_update',
          data,
          timestamp: new Date().toISOString(),
        });
        controller.enqueue(`data: ${message}\n\n`);
      } catch (error) {
        console.error('Failed to broadcast to user:', userId, error);
        userConnections.delete(userId);
      }
    }
  }
}
