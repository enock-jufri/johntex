import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProductsTab from '../components/settings/ProductsTab';
import WorkersTab from '../components/settings/WorkersTab';
import UsersTab from '../components/settings/UsersTab';
import MpesaTab from '../components/settings/MpesaTab';
import { Shirt, Users, Settings2, Smartphone } from 'lucide-react';

const allTabs = [
  { id: 'products', label: 'Products', icon: <Shirt className="h-3.5 w-3.5" />, minRole: 'supervisor' as const },
  { id: 'workers', label: 'Workers', icon: <Users className="h-3.5 w-3.5" />, minRole: 'supervisor' as const },
  { id: 'users', label: 'Users', icon: <Settings2 className="h-3.5 w-3.5" />, minRole: 'admin' as const },
  { id: 'mpesa', label: 'M-Pesa', icon: <Smartphone className="h-3.5 w-3.5" />, minRole: 'admin' as const },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const tabs = allTabs.filter((t) => t.minRole === 'supervisor' || isAdmin);
  const [tab, setTab] = useState(tabs[0]?.id ?? 'products');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">Manage products, workers, and users</p>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'products' && <ProductsTab />}
        {tab === 'workers' && <WorkersTab />}
        {tab === 'users' && isAdmin && <UsersTab />}
        {tab === 'mpesa' && isAdmin && <MpesaTab />}
      </div>
    </div>
  );
}
