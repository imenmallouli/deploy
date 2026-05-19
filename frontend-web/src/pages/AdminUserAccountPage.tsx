import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listUsers } from '../lib/api/endpoints';
import { useI18n } from '../lib/i18n';

export function AdminUserAccountPage() {
  const { userId } = useParams<{ userId: string }>();
  const id = Number(userId);
  const { locale } = useI18n();

  const text = locale === 'fr'
    ? {
        title: 'Compte utilisateur',
        back: 'Retour a la liste',
        loading: 'Chargement...',
        notFound: 'Utilisateur introuvable.',
        phone: 'Telephone',
        role: 'Role',
        id: 'ID',
      }
    : {
        title: 'User Account',
        back: 'Back to list',
        loading: 'Loading...',
        notFound: 'User not found.',
        phone: 'Phone',
        role: 'Role',
        id: 'ID',
      };

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: listUsers });
  const user = usersQuery.data?.items?.find((item) => item.user_id === id);

  return (
    <section>
      <div className="panel-title-row" style={{ marginBottom: 12 }}>
        <h2>{text.title}</h2>
        <Link to="/admin/panel">{text.back}</Link>
      </div>

      {usersQuery.isLoading ? <p>{text.loading}</p> : null}
      {!usersQuery.isLoading && !user ? <p>{text.notFound}</p> : null}

      {user ? (
        <article className="panel">
          <div className="stat-card">
            <p><strong>{user.first_name} {user.last_name}</strong></p>
            <p>{user.email}</p>
            <p>{text.phone}: {user.phone ?? '-'}</p>
            <p>{text.role}: {user.role}</p>
            <p>{text.id}: {user.user_id}</p>
          </div>
        </article>
      ) : null}
    </section>
  );
}
