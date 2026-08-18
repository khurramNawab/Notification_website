import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../utils/api';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (role: 'admin' | 'staff') => {
    if (role === 'admin') {
      setEmail('admin@paytrack.com');
      setPassword('admin123');
    } else {
      setEmail('staff@paytrack.com');
      setPassword('staff123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-level-2 border border-outline-variant/30 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-2xl">account_balance</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary">PayTrack CRM</h1>
            <p className="text-xs text-on-surface-variant">Consultancy Edition</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-on-background mb-4 text-center">Log In to Your Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              placeholder="e.g. admin@paytrack.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-surface-tint text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm active:opacity-90 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">login</span>
                <span>Log In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-outline-variant/30 pt-4 text-center">
          <p className="text-xs text-on-surface-variant mb-2">Quick Access Demo Roles</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => fillCredentials('admin')}
              className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs rounded transition-colors"
            >
              Admin Role
            </button>
            <button
              onClick={() => fillCredentials('staff')}
              className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs rounded transition-colors"
            >
              Staff Role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
