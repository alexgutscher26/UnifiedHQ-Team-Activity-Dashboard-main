import { auth } from '@/lib/auth';
import { NextRequest } from 'next/server';

/**
 * Handles GET requests for authentication.
 */
export async function GET(request: NextRequest) {
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  return auth.handler(request);
}
