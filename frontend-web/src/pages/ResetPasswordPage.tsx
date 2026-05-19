import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => (searchParams.get('token') ?? '').trim(), [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: (result) => {
      if (result.status !== 'success') {
        setError(result.message ?? t('auth.reset.failed'));
        return;
      }
      setError(null);
      setMessage(t('auth.reset.success'));
      setTimeout(() => navigate('/login', { replace: true }), 900);
    },
    onError: (err: unknown) => {
      if (err instanceof AxiosError) {
        const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
        setError(detail ?? t('auth.reset.failed'));
        return;
      }
      setError(t('auth.reset.failed'));
    },
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!token) {
      setError(t('auth.reset.invalidToken'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.reset.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.reset.passwordMismatch'));
      return;
    }

    mutation.mutate({ token, new_password: password });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page auth-shared-card">
        <h2>{t('auth.reset.title')}</h2>
        <p className="subtitle">{t('auth.reset.subtitle')}</p>

        {!token ? <p className="form-error">{t('auth.reset.invalidToken')}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.reset.newPassword')}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={!token}
              required
            />
          </label>
          <label>
            {t('auth.reset.confirmPassword')}
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              disabled={!token}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p>{message}</p> : null}

          <button type="submit" disabled={mutation.isPending || !token}>
            {mutation.isPending ? t('auth.reset.submitting') : t('auth.reset.submit')}
          </button>

          <p className="auth-switch">
            <Link to="/login">{t('auth.login.signIn')}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
