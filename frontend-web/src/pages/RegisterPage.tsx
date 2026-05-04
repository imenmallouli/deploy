import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
        setError(result.message ?? t('auth.register.failed'));
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
        setError(apiData?.detail ?? apiData?.message ?? error.message ?? t('auth.register.unable'));
        return;
      }
      setError(t('auth.register.checkBackend'));
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
        <h2>{t('auth.register.title')}</h2>
        <p className="subtitle">{t('auth.register.subtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.firstName')}
            <input className="auth-input-white" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label>
            {t('auth.lastName')}
            <input className="auth-input-white" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            {t('auth.phone')}
            <input className="auth-input-white" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label>
            {t('auth.password')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('auth.register.creating') : t('auth.register.createAccount')}</button>
          <p className="auth-switch">
            {t('auth.register.alreadyRegistered')} <Link to="/login">{t('auth.register.signIn')}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
