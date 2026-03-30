import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { TopBar } from '../components/TopBar';

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <section className="content-shell">
        <TopBar />
        <main className="content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
