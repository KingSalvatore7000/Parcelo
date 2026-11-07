import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

// Brand palette — inline styles for reliable Tailwind purge-safety
const C = {
  teal: '#0B5D5B',
  tealDark: '#084644',
  coral: '#F26B4E',
  sand: '#F6E7CB',
  leaf: '#3A9D5D',
  amber: '#E0A100',
  brick: '#C93C3C',
  night: '#10302F',
  sage: '#5E7371',
  mist: '#F5F7F6',
  white: '#FFFFFF',
  line: '#DCE5E3',
};

export const Navbar: React.FC = () => {
  const { user, logout, quickLogin } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = React.useState<boolean>(() => {
    return localStorage.getItem('parcelo_theme') === 'dark';
  });

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('parcelo_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('parcelo_theme', 'light');
    }
  };

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleRoleSwitch = async (phone: string, targetPath: string) => {
    try {
      await quickLogin(phone);
      navigate(targetPath);
    } catch (err) {
      console.error('Role switch failed:', err);
    }
  };

  return (
    <header
      style={{ background: C.teal, color: C.white, borderBottom: `1px solid ${C.tealDark}`, position: 'sticky', top: 0, zIndex: 40 }}
      className="shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo & Name */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div
              style={{ width: 40, height: 40, borderRadius: 12, background: C.coral, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Package style={{ width: 24, height: 24, color: C.white, strokeWidth: 2.5 }} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className="font-heading text-xl font-extrabold tracking-tight"
                  style={{ color: C.white }}
                >
                  Parcelo
                </span>
                <span
                  className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full font-mono"
                  style={{ background: C.sand, color: C.night }}
                >
                  Gate
                </span>
              </div>
              {user && (
                <p className="text-xs font-medium" style={{ color: `${C.sand}cc` }}>
                  {user.societyName || 'Greenwood Heights'}
                </p>
              )}
            </div>
          </div>

          {/* Quick Demo Role Switcher */}
          {user && (
            <div
              className="hidden md:flex items-center space-x-1.5 p-1 rounded-xl text-xs"
              style={{ background: `${C.tealDark}cc`, border: `1px solid rgba(246,231,203,0.15)` }}
            >
              <span className="px-2 font-medium" style={{ color: `${C.sand}99` }}>Switch view:</span>
              {[
                { label: '🛡️ Guard Desk', phone: '+919876543210', path: '/guard', role: 'GUARD' },
                { label: '🏠 Resident (A-1204)', phone: '+919876543212', path: '/resident', role: 'RESIDENT' },
                { label: '⚙️ Admin', phone: '+919876543211', path: '/admin', role: 'ADMIN' },
              ].map(({ label, phone, path, role }) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(phone, path)}
                  style={
                    user.role === role
                      ? { background: C.coral, color: C.white, padding: '6px 12px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer' }
                      : { background: 'transparent', color: `${C.sand}cc`, padding: '6px 12px', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* User Status & Actions */}
          <div className="flex items-center space-x-3">
            {/* Live Connection Dot */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 9999, fontWeight: 600,
                background: isConnected ? `${C.leaf}22` : `${C.amber}22`,
                color: isConnected ? C.leaf : C.amber,
                border: `1px solid ${isConnected ? C.leaf + '66' : C.amber + '66'}`,
              }}
              title={isConnected ? 'Live WebSocket Connected' : 'Connecting to WebSocket...'}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: isConnected ? C.leaf : C.amber,
                  display: 'inline-block',
                  animation: isConnected ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
                }}
              />
              <span className="hidden sm:inline font-mono">{isConnected ? 'LIVE' : 'SYNCING'}</span>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              style={{ padding: 8, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: `${C.sand}cc` }}
              title="Toggle theme"
            >
              {darkMode
                ? <Sun style={{ width: 20, height: 20, color: C.sand }} />
                : <Moon style={{ width: 20, height: 20, color: `${C.sand}cc` }} />
              }
            </button>

            {user ? (
              <div
                className="flex items-center space-x-2 pl-2"
                style={{ borderLeft: `1px solid rgba(246,231,203,0.2)` }}
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold" style={{ color: C.white }}>{user.name}</div>
                  <div className="text-xs font-medium" style={{ color: C.sand }}>
                    {user.role === 'GUARD' ? 'Security Gate' : user.role === 'ADMIN' ? 'Society Admin' : user.flat?.label || 'Resident'}
                  </div>
                </div>
                <button
                  onClick={logout}
                  style={{ padding: 8, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: `${C.sand}99` }}
                  title="Sign out"
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.brick; (e.currentTarget as HTMLButtonElement).style.color = C.white; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = `${C.sand}99`; }}
                >
                  <LogOut style={{ width: 20, height: 20 }} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                style={{ padding: '8px 20px', background: C.coral, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
