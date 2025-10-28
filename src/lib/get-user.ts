import { auth } from './auth';
import { headers } from 'next/headers';

export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
