'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApolloProvider } from '@apollo/client';
import { ThemeProvider } from 'next-themes';
import { I18nextProvider } from 'react-i18next';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { apolloClient } from '@/lib/apollo';
import { trpc } from '@/lib/trpc';
import { i18n } from '@/lib/i18n';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ServiceWorkerProvider } from '@/contexts/ServiceWorkerContext';
import { GeolocationProvider } from '@/contexts/GeolocationContext';
import { ErrorFallback } from '@/components/Error/ErrorFallback';
import { LoadingFallback } from '@/components/Loading/LoadingFallback';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Application Error:', error);
        console.error('Error Info:', errorInfo);
        // Send to error reporting service
      }}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <ApolloProvider client={apolloClient}>
              <trpc.Provider client={trpc} queryClient={queryClient}>
                <AuthProvider>
                  <NotificationProvider>
                    <WebSocketProvider>
                      <ServiceWorkerProvider>
                        <GeolocationProvider>
                          <Suspense fallback={<LoadingFallback />}>
                            {children}
                          </Suspense>
                        </GeolocationProvider>
                      </ServiceWorkerProvider>
                    </WebSocketProvider>
                  </NotificationProvider>
                </AuthProvider>
                <ReactQueryDevtools initialIsOpen={false} />
              </trpc.Provider>
            </ApolloProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
