interface UserPreferences {
  githubOwner: string | null;
  githubRepo: string | null;
  githubRepoId: number | null;
}

interface UserPreferencesResponse {
  success: boolean;
  data: UserPreferences;
  error?: string;
}

export async function loadUserPreferences(): Promise<UserPreferences> {
  try {
    const response = await fetch('/api/user-preferences');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: UserPreferencesResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to load user preferences');
    }

    return result.data;
  } catch (error) {
    console.error('Error loading user preferences:', error);
    // Return default preferences on error
    return {
      githubOwner: null,
      githubRepo: null,
      githubRepoId: null,
    };
  }
}

export async function saveUserPreferences(preferences: {
  githubOwner: string;
  githubRepo: string;
  githubRepoId: number;
}): Promise<boolean> {
  try {
    const response = await fetch('/api/user-preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to save user preferences');
    }

    return true;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return false;
  }
}

export async function clearUserPreferences(): Promise<boolean> {
  try {
    const response = await fetch('/api/user-preferences', {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to clear user preferences');
    }

    return true;
  } catch (error) {
    console.error('Error clearing user preferences:', error);
    return false;
  }
}

export type { UserPreferences };
