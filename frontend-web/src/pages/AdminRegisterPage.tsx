import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';

export function AdminRegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? 'Creation admin impossible.');
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
    mutation.mutate({
      first_name: firstName,
      last_name: lastName,
      email,
      role: 'admin',
      phone,
      password,
    });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page auth-shared-card">
        <h2>Admin register</h2>
        <p className="subtitle">Creation d'un compte admin pour le portail de gestion utilisateurs.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Prenom
            <input className="auth-input-white" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label>
            Nom
            <input className="auth-input-white" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Telephone
            <input className="auth-input-white" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label>
            Mot de passe
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creation...' : 'Creer compte admin'}</button>
          <p className="auth-switch">
            Deja admin ? <Link to="/admin/login">Se connecter</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
