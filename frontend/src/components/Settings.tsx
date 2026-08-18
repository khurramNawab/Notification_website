import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  created_at: string;
}

export const Settings: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  // Settings State
  const [threshold, setThreshold] = useState('30');
  const [savingSettings, setSavingSettings] = useState(false);

  // User Management State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [savingUser, setSavingUser] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchSettings = async () => {
    try {
      const res = await request('/api/settings');
      if (res.overdue_days_threshold) {
        setThreshold(res.overdue_days_threshold);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchUsers = async () => {
    if (currentUser?.role !== 'admin') return;
    try {
      const data = await request('/api/auth/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentUser, refreshTrigger]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ overdue_days_threshold: threshold })
      });
      alert('Threshold settings updated and active transaction statuses recalculated!');
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    setSavingUser(true);
    try {
      await request('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role })
      });
      alert('Access account created successfully!');
      setName('');
      setEmail('');
      setPassword('');
      setRole('staff');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert('Failed to create account: ' + err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this staff user account?')) return;
    try {
      await request(`/api/auth/users/${userId}`, { method: 'DELETE' });
      alert('Account deleted successfully');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-background">System Settings</h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-1">Configure ledger billing thresholds and coordinate user access.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* General Config Card (1/3) */}
          <div className="bg-white p-5 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">tune</span>
              <span>Billing Parameters</span>
            </h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                  Overdue Days Threshold
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all"
                  required
                  min="1"
                />
                <p className="text-[10px] text-on-surface-variant mt-1.5">
                  Transactions with pending balances older than this number of days will auto-status as "overdue".
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-2 px-4 rounded-lg text-xs transition-colors"
              >
                {savingSettings ? 'Recalculating...' : 'Update Settings'}
              </button>
            </form>
          </div>

          {/* User Management Card (2/3) */}
          {currentUser?.role === 'admin' ? (
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-outline-variant/30 shadow-sm space-y-6">
              
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* User List */}
                <div className="flex-1 space-y-4">
                  <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">manage_accounts</span>
                    <span>Staff Accounts</span>
                  </h2>
                  <div className="border border-outline-variant/30 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-outline-variant/30 text-on-surface-variant font-semibold">
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Role</th>
                          <th className="p-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-on-surface">
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="p-2.5 font-bold">{u.name}</td>
                            <td className="p-2.5 text-on-surface-variant">{u.email}</td>
                            <td className="p-2.5 capitalize text-on-surface-variant">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                u.role === 'admin' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              {u.id !== currentUser.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-error hover:text-rose-700 transition-colors p-1"
                                  title="Delete Account"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Create User Form */}
                <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-outline-variant/30 pt-6 md:pt-0 md:pl-6 space-y-4">
                  <h2 className="text-sm font-bold text-primary">New Access Card</h2>
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="staff@paytrack.com"
                        className="w-full rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="password123"
                        className="w-full rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">System Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
                        className="w-full rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      >
                        <option value="staff">Staff (Edit Access)</option>
                        <option value="admin">Admin (Full Access)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                    >
                      {savingUser ? 'Creating...' : 'Create Account'}
                    </button>
                  </form>
                </div>

              </div>

            </div>
          ) : (
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-outline-variant/30 shadow-sm flex items-center justify-center py-16 text-center">
              <div>
                <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-45">lock</span>
                <h3 className="text-sm font-bold text-on-surface mt-2">Administrative Control Panel</h3>
                <p className="text-xs text-on-surface-variant mt-1">Staff accounts do not have permission to modify system users.</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
