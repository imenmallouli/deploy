import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';

export function RegisterPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('driver');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? 'Registration failed');
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
        setError(apiData?.detail ?? apiData?.message ?? error.message ?? 'Unable to register.');
        return;
      }
      setError('Unable to register. Check backend and input data.');
    },
  });

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    mutation.mutate({
      first_name: firstName,
      last_name: lastName,
      email,
      role,
      phone,
      password,
    });
  };

  return (
    <div className="auth-screen">
      <section className="auth-page auth-shared-card">
        <h2>Register</h2>
        <p className="subtitle">Create a new account for fleet operations.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            First Name
            <input className="auth-input-white" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label>
            Last Name
            <input className="auth-input-white" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="driver">driver</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label>
            Phone
            <input className="auth-input-white" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create Account'}</button>
          <p className="auth-switch">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
