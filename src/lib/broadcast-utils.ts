// Helper function to broadcast repository changes
export function broadcastRepositoryChange(
  userId: string,
  action: 'added' | 'removed',
  repoName: string
) {
  const userConnections = (global as any).userConnections;
  if (userConnections?.has(userId)) {
    const controller = userConnections.get(userId);
    try {
      const message = JSON.stringify({
        type: 'repository_update',
        data: {
          action,
          repoName,
          message: `Repository ${repoName} ${action}`,
        },
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Failed to broadcast repository change:', error);
      userConnections?.delete(userId);
    }
  }
}
