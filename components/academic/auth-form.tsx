import { useState, type FormEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  buttonLabel: string;
  title: string;
  description?: string;
  error?: string;
}

export function AuthForm({
  onSubmit,
  buttonLabel,
  title,
  description,
  error: externalError,
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: MouseEvent) => {
    e.preventDefault();
    router.push('/login?tab=forgot');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-border/60">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-2">{description}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(localError || externalError) && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  {localError || externalError}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="text-center">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : buttonLabel}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <a
              href="/register"
              className="text-primary hover:underline"
            >
              Don&apos;t have an account? Register
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
