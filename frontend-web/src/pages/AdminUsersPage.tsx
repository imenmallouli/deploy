import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUserByAdmin, impersonateUserByAdmin, listUsers } from '../lib/api/endpoints';
import { saveSession } from '../lib/auth/session';
import { useI18n } from '../lib/i18n';

export function AdminUsersPage() {
  const { locale } = useI18n();
  const text = locale === 'fr'
    ? {
        deleteFailed: 'Suppression impossible',
        deleteDone: 'Utilisateur supprime',
        openInterfaceFailed: 'Ouverture interface impossible',
        title: 'Gestion des utilisateurs',
        subtitle: 'Espace admin - gerer les comptes et les roles',
        listTitle: 'Liste des utilisateurs',
        accounts: 'comptes',
        loading: 'Chargement...',
        noUsers: 'Aucun utilisateur.',
        searchPlaceholder: 'Rechercher...',
        all: 'Tous',
        admins: 'Admins',
        users: 'Users',
        phone: 'Telephone',
        openInterface: 'Ouvrir interface',
        delete: 'Supprimer',
        confirmDelete: 'Supprimer',
      }
    : {
        deleteFailed: 'Delete failed',
        deleteDone: 'User deleted',
        openInterfaceFailed: 'Unable to open user interface',
        title: 'User Management',
          subtitle: 'Admin space - manage accounts and roles',
        listTitle: 'Users List',
        accounts: 'accounts',
        loading: 'Loading...',
        noUsers: 'No users.',
          searchPlaceholder: 'Search...',
          all: 'All',
          admins: 'Admins',
          users: 'Users',
        phone: 'Phone',
        openInterface: 'Open interface',
        delete: 'Delete',
        confirmDelete: 'Delete',
      };
        const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
        const [searchTerm, setSearchTerm] = useState('');
        const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

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

  const impersonateMutation = useMutation({
    mutationFn: ({ userId }: { userId: number }) => impersonateUserByAdmin(userId),
    onSuccess: (result) => {
      if (result.status !== 'success' || !result.access_token) {
        setError(result.message ?? text.openInterfaceFailed);
        return;
      }

      saveSession({
        accessToken: result.access_token,
        role: result.role,
        email: result.email,
        userId: result.user_id,
      });

      const nextPath = (result.role ?? '').toLowerCase() === 'admin' ? '/admin/panel' : '/get-started';
      navigate(nextPath, { replace: true });
    },
    onError: () => setError(text.openInterfaceFailed),
  });

  const users = usersQuery.data?.items ?? [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const roleMatches = roleFilter === 'all' || (user.role ?? '').toLowerCase() === roleFilter;
    if (!roleMatches) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.toLowerCase();
    const email = (user.email ?? '').toLowerCase();
    const phone = (user.phone ?? '').toLowerCase();
    return fullName.includes(normalizedSearch) || email.includes(normalizedSearch) || phone.includes(normalizedSearch);
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = (firstName ?? '').trim().charAt(0);
    const last = (lastName ?? '').trim().charAt(0);
    const value = `${first}${last}`.toUpperCase();
    return value || 'U';
  };

  const roleClassName = (role?: string | null) => {
    return (role ?? '').toLowerCase() === 'admin' ? 'admin-user-role is-admin' : 'admin-user-role is-user';
  };

  return (
    <section className="admin-users-page">
      <header className="admin-users-header">
        <div>
          <h2>{text.title}</h2>
          <p className="subtitle">{text.subtitle}</p>
        </div>
        <span className="admin-users-count">{usersQuery.data?.count ?? 0} {text.accounts}</span>
      </header>

      <div className="admin-users-toolbar">
        <input
          className="admin-users-search"
          type="search"
          placeholder={text.searchPlaceholder}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <div className="admin-users-filters">
          <button
            type="button"
            className={roleFilter === 'all' ? 'active' : ''}
            onClick={() => setRoleFilter('all')}
          >
            {text.all}
          </button>
          <button
            type="button"
            className={roleFilter === 'admin' ? 'active' : ''}
            onClick={() => setRoleFilter('admin')}
          >
            {text.admins}
          </button>
          <button
            type="button"
            className={roleFilter === 'user' ? 'active' : ''}
            onClick={() => setRoleFilter('user')}
          >
            {text.users}
          </button>
        </div>
      </div>

      {message ? <p className="admin-users-message">{message}</p> : null}
      {error ? <p className="admin-users-error">{error}</p> : null}

      <article className="admin-users-list-panel">
        <h3>{text.listTitle}</h3>
        {usersQuery.isLoading ? <p>{text.loading}</p> : null}
        {!usersQuery.isLoading && filteredUsers.length === 0 ? <p>{text.noUsers}</p> : null}
        {filteredUsers.map((user) => {
          return (
            <div key={user.user_id} className="admin-user-card">
              <div className="admin-user-identity">
                <div className="admin-user-avatar">{getInitials(user.first_name, user.last_name)}</div>
                <div>
                  <p className="admin-user-name">{user.first_name} {user.last_name}</p>
                  <p className="admin-user-email">{user.email}</p>
                  <p className="admin-user-phone">{user.phone ?? '-'}</p>
                </div>
              </div>

              <div className={roleClassName(user.role)}>{(user.role ?? 'user').toLowerCase()}</div>

              <div className="admin-user-actions">
                <button
                  type="button"
                  className="admin-user-btn"
                  onClick={() => impersonateMutation.mutate({ userId: user.user_id })}
                >
                  {text.openInterface}
                </button>
                <button
                  type="button"
                  className="admin-user-btn"
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