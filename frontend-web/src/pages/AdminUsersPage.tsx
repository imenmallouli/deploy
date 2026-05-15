import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteUserByAdmin, listUsers, resetUserPasswordByAdmin } from '../lib/api/endpoints';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({});

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: number; newPassword: string }) => resetUserPasswordByAdmin(userId, { new_password: newPassword }),
    onSuccess: (result, variables) => {
      if (result.status !== 'success') {
        setError(result.message ?? 'Reinitialisation impossible');
        return;
      }
      setMessage('Mot de passe reinitialise');
      setError(null);
      setPasswordDrafts((current) => ({ ...current, [variables.userId]: '' }));
    },
    onError: () => setError('Reinitialisation impossible'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ userId }: { userId: number }) => deleteUserByAdmin(userId),
    onSuccess: (result) => {
      if (result.status !== 'success') {
        setError(result.message ?? 'Suppression impossible');
        return;
      }
      setMessage('Utilisateur supprime');
      setError(null);
      refreshUsers();
    },
    onError: () => setError('Suppression impossible'),
  });

  const users = usersQuery.data?.items ?? [];

  return (
    <section>
      <h2>Gestion des utilisateurs</h2>
      <p className="subtitle">Espace admin cache pour gerer les comptes et les roles.</p>

      <article className="panel">
        <div className="panel-title-row">
          <h3>Liste des utilisateurs</h3>
          <span className="muted-note">{usersQuery.data?.count ?? 0} comptes</span>
        </div>
        {usersQuery.isLoading ? <p>Chargement...</p> : null}
        {!usersQuery.isLoading && users.length === 0 ? <p>Aucun utilisateur.</p> : null}
        {users.map((user) => {
          const passwordValue = passwordDrafts[user.user_id] ?? '';
          return (
            <div key={user.user_id} className="stat-card" style={{ marginBottom: 16 }}>
              <div className="panel-title-row">
                <div>
                  <strong>{user.first_name} {user.last_name}</strong>
                  <p className="subtitle" style={{ margin: 0 }}>{user.email}</p>
                </div>
                <span className="muted-note">{user.role}</span>
              </div>
              <p>Telephone: {user.phone ?? '-'}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={passwordValue}
                  onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.user_id]: event.target.value }))}
                />
                <button
                  type="button"
                  disabled={!passwordValue}
                  onClick={() => resetPasswordMutation.mutate({ userId: user.user_id, newPassword: passwordValue })}
                >
                  Reinitialiser mot de passe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const shouldDelete = window.confirm(`Supprimer ${user.email} ?`);
                    if (shouldDelete) {
                      deleteMutation.mutate({ userId: user.user_id });
                    }
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </article>
    </section>
  );
}