import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { errorMessage } from '@/lib/graphql';
import { useAuth } from './auth-context';
import { AuthLayout } from './AuthLayout';

const loginSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginValues = z.infer<typeof loginSchema>;

/** Users created by `npm run db:seed`; they share one workspace with two projects. */
const DEMO_USERS = [
  { email: 'alice@example.com', name: 'Alice Owner', role: 'Owner' },
  { email: 'bob@example.com', name: 'Bob Developer', role: 'Admin' },
  { email: 'carol@example.com', name: 'Carol Designer', role: 'Member' },
];
const DEMO_PASSWORD = 'Password123';
const showDemo = import.meta.env.VITE_DEMO_ACCOUNTS !== 'false';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  // <RedirectIfAuthed> navigates away once the session is set.
  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Log in">
      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => signIn(v.email, v.password))}
      >
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        New here?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>

      {showDemo && (
        <section
          aria-labelledby="demo-heading"
          className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800"
        >
          <h2 id="demo-heading" className="text-sm font-semibold">
            Try it with a demo account
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Tip: open a second window as another user and drag a card to watch the board update
            live.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_USERS.map((user) => (
              <Button
                key={user.email}
                variant="secondary"
                className="h-auto flex-col gap-1 py-3"
                loading={demoLoading === user.email}
                disabled={demoLoading !== null}
                aria-label={`Log in as ${user.name}`}
                onClick={async () => {
                  setDemoLoading(user.email);
                  await signIn(user.email, DEMO_PASSWORD);
                  setDemoLoading(null);
                }}
              >
                <Avatar name={user.name} seed={user.email} size="sm" />
                <span className="text-xs">{user.name.split(' ')[0]}</span>
                <span className="text-[0.6875rem] font-normal text-slate-500">{user.role}</span>
              </Button>
            ))}
          </div>
        </section>
      )}
    </AuthLayout>
  );
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').max(72),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { signUp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterValues) => {
    setError(null);
    try {
      await signUp(values);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Create your account">
      <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        {error && <Alert>{error}</Alert>}
        <Field label="Your name" error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
