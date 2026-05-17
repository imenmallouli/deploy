import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteUserByAdmin, listUsers, resetUserPasswordByAdmin } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function AdminUsersPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        resetFailed: 'Reinitialisation impossible',
        resetDone: 'Mot de passe reinitialise',
        deleteFailed: 'Suppression impossible',
        deleteDone: 'Utilisateur supprime',
        title: 'Gestion des utilisateurs',
        subtitle: 'Espace admin cache pour gerer les comptes et les roles.',
        listTitle: 'Liste des utilisateurs',
        accounts: 'comptes',
        loading: 'Chargement...',
        noUsers: 'Aucun utilisateur.',
        phone: 'Telephone',
        newPassword: 'Nouveau mot de passe',
        resetPassword: 'Reinitialiser mot de passe',
        delete: 'Supprimer',
        confirmDelete: 'Supprimer',
      }
    : {
        resetFailed: 'Password reset failed',
        resetDone: 'Password reset successfully',
        deleteFailed: 'Delete failed',
        deleteDone: 'User deleted',
        title: 'User Management',
        subtitle: 'Hidden admin area to manage accounts and roles.',
        listTitle: 'Users List',
        accounts: 'accounts',
        loading: 'Loading...',
        noUsers: 'No users.',
        phone: 'Phone',
        newPassword: 'New password',
        resetPassword: 'Reset password',
        delete: 'Delete',
        confirmDelete: 'Delete',
      };
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
        setError(result.message ?? text.resetFailed);
        return;
      }
      setMessage(text.resetDone);
      setError(null);
      setPasswordDrafts((current) => ({ ...current, [variables.userId]: '' }));
    },
    onError: () => setError(text.resetFailed),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ userId }: { userId: number }) => deleteUserByAdmin(userId),
    onSuccess: (result) => {
      if (result.status !== 'success') {
        setError(result.message ?? text.deleteFailed);
        return;
      }
      setMessage(text.deleteDone);
      setError(null);
      refreshUsers();
    },
    onError: () => setError(text.deleteFailed),
  });

  const users = usersQuery.data?.items ?? [];

  return (
    <section>
      <h2>{text.title}</h2>
      <p className="subtitle">{text.subtitle}</p>

      <article className="panel">
        <div className="panel-title-row">
          <h3>{text.listTitle}</h3>
          <span className="muted-note">{usersQuery.data?.count ?? 0} {text.accounts}</span>
        </div>
        {usersQuery.isLoading ? <p>{text.loading}</p> : null}
        {!usersQuery.isLoading && users.length === 0 ? <p>{text.noUsers}</p> : null}
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
              <p>{text.phone}: {user.phone ?? '-'}</p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder={text.newPassword}
                  value={passwordValue}
                  onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.user_id]: event.target.value }))}
                />
                <button
                  type="button"
                  disabled={!passwordValue}
                  onClick={() => resetPasswordMutation.mutate({ userId: user.user_id, newPassword: passwordValue })}
                >
                  {text.resetPassword}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const shouldDelete = window.confirm(`${text.confirmDelete} ${user.email} ?`);
                    if (shouldDelete) {
                      deleteMutation.mutate({ userId: user.user_id });
                    }
                  }}
                >
                  {text.delete}
                </button>
              </div>
            </div>
          );
        })}
      </article>
    </section>
  );
}