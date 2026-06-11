import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-60 min-h-screen">
        <div className="px-4 py-6 lg:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
