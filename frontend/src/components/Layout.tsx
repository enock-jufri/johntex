import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:py-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
