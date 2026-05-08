import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (result) => {
      if (result.status !== 'success') {
        setError(result.message ?? t('auth.login.unable'));
        return;
      }
      setMessage(t('auth.forgot.success'));
      setError(null);
    },
    onError: () => {
      setError(t('auth.login.unable'));
    },
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    mutation.mutate({ email });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page auth-shared-card">
        <h2>{t('auth.forgot.title')}</h2>
        <p className="subtitle">{t('auth.forgot.subtitle')}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p>{message}</p> : null}
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.forgot.sending') : t('auth.forgot.submit')}
          </button>
          <p className="auth-switch">
            <Link to="/login">{t('auth.login.signIn')}</Link>
          </p>
        </form>
      </section>
    </div>
  );
}