import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from './features/auth/auth-context';
import { GraphQLRequestError } from './lib/graphql';
import { useTheme } from './lib/theme';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // GraphQL errors are deliberate answers; only network failures are retried.
      retry: (count, error) => !(error instanceof GraphQLRequestError) && count < 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** Applies the saved or system theme before anything renders. */
function ThemeRoot() {
  useTheme();
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeRoot />
        <App />
        <Toaster richColors position="bottom-right" closeButton />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
