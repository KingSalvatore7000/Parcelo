import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings } from 'lucide-react';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-indigo-ink text-white p-6 rounded-2xl shadow-lg border border-indigo-light/30">
        <h1 className="font-heading text-2xl font-black">Society Admin Dashboard</h1>
        <p className="text-slate-300 text-sm mt-1">
          Welcome, {user?.name || 'Admin'} • {user?.societyName || 'Greenwood Heights'}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8" />
        </div>
        <h2 className="font-heading text-xl font-bold text-slate-800 dark:text-slate-100">
          Admin Dashboard Scheduled for Phase 5
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Phase 5 will add metrics cards, flat & user CRUD management, CSV resident bulk import, and unclaimed parcel management.
        </p>
      </div>
    </div>
  );
};
