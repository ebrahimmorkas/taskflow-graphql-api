import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { gql, session } from '@/lib/graphql';
import type { User } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthPayload {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const USER_FIELDS = 'id name email';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(session.token ? 'loading' : 'anonymous');

  useEffect(
    () =>
      session.subscribe((token) => {
        if (token) return;
        setUser(null);
        setStatus('anonymous');
        queryClient.clear();
      }),
    [queryClient],
  );

  // Validate a stored token after a reload.
  useEffect(() => {
    if (!session.token) return;
    const controller = new AbortController();
    gql<{ me: User }>(`query Me { me { ${USER_FIELDS} } }`, undefined, controller.signal)
      .then(({ me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!controller.signal.aborted) session.set(null);
      });
    return () => controller.abort();
  }, []);

  const finish = useCallback((payload: AuthPayload) => {
    session.set(payload.token);
    setUser(payload.user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { logIn } = await gql<{ logIn: AuthPayload }, { input: object }>(
        `mutation LogIn($input: LogInInput!) { logIn(input: $input) { token user { ${USER_FIELDS} } } }`,
        { input: { email, password } },
      );
      finish(logIn);
    },
    [finish],
  );

  const signUp = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const res = await gql<{ signUp: AuthPayload }, { input: object }>(
        `mutation SignUp($input: SignUpInput!) { signUp(input: $input) { token user { ${USER_FIELDS} } } }`,
        { input },
      );
      finish(res.signUp);
    },
    [finish],
  );

  const logout = useCallback(() => session.set(null), []);

  const value = useMemo(
    () => ({ user, status, login, signUp, logout }),
    [user, status, login, signUp, logout],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useMe() {
  const { user } = useAuth();
  if (!user) throw new Error('useMe called while signed out');
  return user;
}
