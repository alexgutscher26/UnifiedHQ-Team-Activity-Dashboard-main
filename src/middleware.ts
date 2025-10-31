import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
    // Temporarily disable middleware to avoid Edge Runtime issues
    // Authentication is handled entirely on the client side
    return NextResponse.next()
}

export const config = {
    matcher: [
        // Currently disabled - using client-side auth only
        // '/admin/:path*',
    ]
}