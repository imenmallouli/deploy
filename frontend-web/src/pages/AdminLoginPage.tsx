import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../lib/api/endpoints';
import { clearSession, saveSession } from '../lib/auth/session';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? 'Connexion admin impossible.');
        return;
      }

      const normalizedRole = (result.role ?? '').toLowerCase();
      if (normalizedRole !== 'admin') {
        clearSession();
        setError('Acces reserve au compte admin.');
        return;
      }

      saveSession({
        accessToken: result.access_token,
        role: result.role,
        email: result.email,
        userId: result.user_id,
      });
      navigate('/admin/panel', { replace: true });
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        const apiData = error.response?.data as { detail?: unknown; message?: unknown } | undefined;
        const detail = typeof apiData?.detail === 'string' ? apiData.detail : null;
        const message = typeof apiData?.message === 'string' ? apiData.message : null;
        setError(detail ?? message ?? error.message ?? 'Backend indisponible.');
        return;
      }
      setError('Backend indisponible.');
    },
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({ email, password });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page auth-shared-card">
        <h2>Admin login</h2>
        <p className="subtitle">Portail admin separe de l'interface utilisateur.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Connexion...' : 'Se connecter'}</button>
          <p className="auth-switch">
            Premier admin ? <Link to="/admin/register">Creer un compte admin</Link>
          </p>
          <p className="auth-switch">
            Compte utilisateur ? <Link to="/login">Aller au login user</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
