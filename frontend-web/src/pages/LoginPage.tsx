import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const requestedPath = typeof location.state === 'object' && location.state && 'from' in location.state && typeof location.state.from === 'string'
    ? location.state.from
    : null;

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? t('auth.login.failed'));
        return;
      }

      saveSession({
        accessToken: result.access_token,
        role: result.role,
        email: result.email,
        userId: result.user_id,
      });

      const normalizedRole = (result.role ?? '').toLowerCase();
      const nextPath = requestedPath && requestedPath.startsWith('/')
        ? requestedPath
        : normalizedRole === 'admin'
          ? '/get-started'
          : '/get-started';

      navigate(nextPath, { replace: true });
    },
    onError: (error: unknown) => {
      if (error instanceof AxiosError) {
        const apiData = error.response?.data as { detail?: unknown; message?: unknown } | undefined;
        const detail = apiData?.detail;
        const message = apiData?.message;

        const resolveText = (value: unknown): string | null => {
          if (typeof value === 'string' && value.trim()) {
            return value;
          }
          if (Array.isArray(value)) {
            const joined = value
              .map((entry) => (typeof entry === 'string' ? entry : (entry as { msg?: unknown })?.msg))
              .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
              .join(' | ');
            return joined || null;
          }
          return null;
        };

        setError(resolveText(detail) ?? resolveText(message) ?? error.message ?? t('auth.login.unable'));
        return;
      }
      setError(t('auth.login.checkBackend'));
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
        <h2>{t('auth.login.title')}</h2>
        <p className="subtitle">{t('auth.login.subtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.email')}
            <input type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t('auth.password')}
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('auth.login.signingIn') : t('auth.login.signIn')}</button>
          <p className="auth-switch">
            <Link to="/forgot-password">{t('auth.login.forgotPassword')}</Link>
          </p>
          <p className="auth-switch">
            {t('auth.login.noAccount')} <Link to="/register" state={requestedPath ? { from: requestedPath } : undefined}>{t('auth.login.createOne')}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
