import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Handles Server-Sent Events (SSE) for offline sync notifications.
 *
 * This endpoint provides real-time updates about offline synchronization events,
 * including sync start, completion, failures, and conflicts.
 */
export async function GET(request: NextRequest) {
  try {
    // console.log('[Offline Sync SSE] Received connection request');

    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      console.log('[Offline Sync SSE] Unauthorized access attempt');
      return new Response(
        `data: ${JSON.stringify({
          type: 'error',
          message: 'Authentication required for sync notifications',
          code: 'AUTH_REQUIRED',
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
    // console.log(`[Offline Sync SSE] User ${userId} connecting to sync events`);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        try {
          // Send initial connection message
          const data = JSON.stringify({
            type: 'connected',
            message: 'Connected to offline sync events',
            timestamp: new Date().toISOString(),
          });

          controller.enqueue(`data: ${data}\n\n`);

          // Store the controller for this user's connection
          if (!(global as any).syncEventConnections) {
            (global as any).syncEventConnections = new Map();
          }
          (global as any).syncEventConnections.set(userId, controller);

          // Send periodic heartbeat to keep connection alive
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeat = JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
              });
              controller.enqueue(`data: ${heartbeat}\n\n`);
            } catch (error) {
              console.error('Sync events heartbeat error:', error);
              clearInterval(heartbeatInterval);
              (global as any).syncEventConnections?.delete(userId);
            }
          }, 30000); // Send heartbeat every 30 seconds

          // Clean up on connection close
          request.signal.addEventListener('abort', () => {
            console.log(`[Offline Sync SSE] User ${userId} disconnected`);
            clearInterval(heartbeatInterval);
            (global as any).syncEventConnections?.delete(userId);
            try {
              controller.close();
            } catch (error) {
              console.error('Error closing sync events controller:', error);
            }
          });
        } catch (error) {
          console.error('Error in sync events SSE stream start:', error);
          try {
            controller.close();
          } catch (closeError) {
            console.error(
              'Error closing sync events controller on start error:',
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
    console.error('Offline sync SSE connection error:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Failed to establish sync events connection' },
      { status: 500 }
    );
  }
}

// Helper function to broadcast sync events to connected users
export function broadcastSyncEvent(userId: string, event: any) {
  const syncEventConnections = (global as any).syncEventConnections;
  if (syncEventConnections?.has(userId)) {
    const controller = syncEventConnections.get(userId);
    try {
      const message = JSON.stringify({
        type: 'sync_event',
        data: event,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Failed to broadcast sync event to user:', error);
      syncEventConnections?.delete(userId);
    }
  }
}

// Helper function to broadcast to all connected users
export function broadcastSyncEventToAll(event: any) {
  const syncEventConnections = (global as any).syncEventConnections;
  if (syncEventConnections) {
    for (const [userId, controller] of syncEventConnections) {
      try {
        const message = JSON.stringify({
          type: 'sync_event',
          data: event,
          timestamp: new Date().toISOString(),
        });
        controller.enqueue(`data: ${message}\n\n`);
      } catch (error) {
        console.error('Failed to broadcast sync event to user:', userId, error);
        syncEventConnections.delete(userId);
      }
    }
  }
}
