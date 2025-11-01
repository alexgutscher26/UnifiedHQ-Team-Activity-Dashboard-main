'use client';

import { MinimalUserJotWidget } from '@/components/userjot-widget-minimal';

interface MinimalUserJotProviderProps {
    children: React.ReactNode;
}

export function MinimalUserJotProvider({ children }: MinimalUserJotProviderProps) {
    const projectId = process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID;

    if (process.env.NODE_ENV === 'development') {
        console.log('Minimal UserJot Provider - Project ID:', projectId ? 'Set' : 'Not set');
    }

    return (
        <>
            {children}
            {projectId && <MinimalUserJotWidget projectId={projectId} />}
        </>
    );
}