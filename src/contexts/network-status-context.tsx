'use client';

import React, { createContext, useContext } from 'react';
import { useNetworkStatus, UseNetworkStatusReturn } from '@/hooks/use-network-status';

const NetworkStatusContext = createContext<UseNetworkStatusReturn | null>(null);

export function useNetworkStatusContext(): UseNetworkStatusReturn {
    const context = useContext(NetworkStatusContext);
    if (!context) {
        throw new Error('useNetworkStatusContext must be used within NetworkStatusProvider');
    }
    return context;
}

interface NetworkStatusProviderProps {
    children: React.ReactNode;
}

export function NetworkStatusProvider({ children }: NetworkStatusProviderProps) {
    const networkStatus = useNetworkStatus();

    return (
        <NetworkStatusContext.Provider value={networkStatus}>
            {children}
        </NetworkStatusContext.Provider>
    );
}