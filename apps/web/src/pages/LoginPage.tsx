import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Shield, Home, ArrowRight, Loader2, AlertCircle, Phone, Lock } from 'lucide-react';
import { useAuth, User } from '../context/AuthContext';
import { DEMO_MODE } from '../config';

/** Where a user lands after signing in: the password screen first when they must set one */
export function homeFor(user: User): string {
  if (user.mustChangePassword) return '/password';
  if (user.role === 'GUARD') return '/guard';
  if (user.role === 'RESIDENT') return '/resident';
  return '/admin';
}

export const LoginPage: React.FC = () => {
  const { login, quickLogin } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const user = await login(phone, password);
      navigate(homeFor(user));
    } catch (err: any) {
      setError(err.message || 'Could not sign in. Please try again.');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoPhone: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const user = await quickLogin(demoPhone);
      navigate(homeFor(user));
    } catch (err: any) {
      setError(err.message || 'Demo sign-in failed. Run npm run db:seed to create the demo accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-mist dark:bg-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary text-sand flex items-center justify-center mx-auto shadow-xl border border-primary-dark">
          <Package className="w-9 h-9 stroke-[2.5]" />
        </div>
        <h2 className="mt-4 font-heading text-3xl font-black text-night dark:text-white tracking-tight">
          Welcome to Parcelo
        </h2>
        <p className="mt-1 text-sm text-sage dark:text-slate-400 font-medium">
          Society Parcel Room & Secure Handover Platform
        </p>
        <a href="/welcome/" className="inline-block mt-2 text-xs font-bold text-primary hover:underline">
          ← What is Parcelo?
        </a>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface dark:bg-slate-900 py-8 px-6 shadow-xl rounded-2xl border border-line dark:border-slate-800 sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 bg-brick-light dark:bg-brick-dark/30 border border-brick/40 rounded-xl flex items-start space-x-2 text-brick text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-phone" className="block text-sm font-bold text-night dark:text-slate-300 mb-1">
                Mobile number
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3 top-3 text-sage" aria-hidden="true" />
                <input
                  id="login-phone"
                  type="tel"
                  autoComplete="username"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-bold text-night dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-3 text-sage" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-base border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>
              <p className="text-xs text-sage mt-1 font-medium">
                New here or forgot it? Your society admin gives you a temporary password.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-touch w-full bg-coral hover:bg-coral-hover text-white font-heading font-extrabold text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins Section (dev / demo builds only) */}
          {DEMO_MODE && (
          <div className="pt-4 border-t border-line dark:border-slate-800">
            <div className="text-xs uppercase font-extrabold tracking-wider text-sage mb-2.5 text-center">
              One-Click Demo Profiles
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('+919876543210')}
                className="p-3 bg-mist hover:bg-sand/40 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-left border border-line dark:border-slate-700 transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary text-sand flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-night dark:text-white">Ramesh Kumar (Guard)</div>
                    <div className="text-[11px] text-sage">Society Gate PC & Tablet</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-coral">Sign in →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('+919876543212')}
                className="p-3 bg-mist hover:bg-sand/40 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-left border border-line dark:border-slate-700 transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-coral text-white flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-night dark:text-white">Arun Patel (Resident)</div>
                    <div className="text-[11px] text-sage">Flat Tower A - 1204</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-coral">Sign in →</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('+919876543211')}
                className="p-3 bg-mist hover:bg-sand/40 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl text-left border border-line dark:border-slate-700 transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-night text-sand flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-night dark:text-white">Priya Sharma (Admin)</div>
                    <div className="text-[11px] text-sage">Society Management</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-coral">Sign in →</span>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
