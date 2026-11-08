import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homeFor } from './LoginPage';

const input =
  'w-full px-4 py-2.5 text-base border border-line rounded-xl bg-mist text-night focus:outline-none focus:ring-2 focus:ring-primary';

/** Set your own password: required after an admin sets a temporary one, available any time after */
export const ChangePasswordPage: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== repeat) {
      setError('The two new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const updated = await changePassword(current, next);
      navigate(homeFor(updated), { replace: true });
    } catch (err: any) {
      const detail = Array.isArray(err?.details) ? err.details.map((d: any) => d.message).join(' ') : '';
      setError(detail || err.message || 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-white border border-line rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
          <div>
            <h1 className="font-heading text-xl font-black text-night">{forced ? 'Set your own password' : 'Change password'}</h1>
            <p className="text-sm text-sage">
              {forced ? 'You signed in with a temporary password. Choose one only you know.' : user?.phone}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-brick-light border border-brick/40 rounded-xl flex items-start gap-2 text-brick text-sm font-semibold" role="alert">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="pw-current" className="block text-sm font-bold text-night mb-1">
              {forced ? 'Temporary password' : 'Current password'}
            </label>
            <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="pw-new" className="block text-sm font-bold text-night mb-1">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className={input} aria-describedby="pw-rules" />
            <p id="pw-rules" className="text-xs text-sage mt-1">At least 8 characters, with letters as well as numbers. Not your phone number.</p>
          </div>
          <div>
            <label htmlFor="pw-repeat" className="block text-sm font-bold text-night mb-1">New password again</label>
            <input id="pw-repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} className={input} />
          </div>
          <button type="submit" disabled={busy} className="btn-touch w-full bg-primary hover:bg-primary-hover text-white font-heading font-extrabold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-5 h-5 animate-spin" />} Save password
          </button>
        </form>

        <p className="text-xs text-sage">
          Saving signs you out on your other devices.{' '}
          {forced && <button type="button" onClick={logout} className="underline font-semibold">Sign out instead</button>}
        </p>
      </div>
    </div>
  );
};
