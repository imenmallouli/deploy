import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? 'Login failed');
        return;
      }

      saveSession({
        accessToken: result.access_token,
        role: result.role,
        email: result.email,
        userId: result.user_id,
      });
      navigate('/');
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        const apiData = error.response?.data as { detail?: string; message?: string } | undefined;
        setError(apiData?.detail ?? apiData?.message ?? error.message ?? 'Unable to login.');
        return;
      }
      setError('Unable to login. Check backend and credentials.');
    },
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({ email, password });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page">
        <h2>Login</h2>
        <p className="subtitle">Authenticate to access the operations dashboard.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in...' : 'Sign In'}</button>
          <p className="auth-switch">
            No account? <Link to="/register">Create one</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
