import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Building2, Users, Upload, RefreshCw, AlertCircle, CheckCircle2,
  Trash2, Loader2, Plus, Clock, PackageCheck, Package, Truck, Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError, AdminStats, AdminFlat, AdminUser, Role } from '../services/api';
import { formatFee } from '../config';

type Tab = 'overview' | 'flats' | 'people' | 'import';

const ROLE_LABEL: Record<Role, string> = { RESIDENT: 'Resident', GUARD: 'Guard', ADMIN: 'Admin' };
const STATUS_LABEL: Record<string, string> = {
  LOGGED: 'Waiting', SCHEDULED: 'Code ready', UNCLAIMED: 'Unclaimed', HANDED_OVER: 'Handed over', RETURNED: 'Returned',
};

const input =
  'w-full px-3 py-2 text-sm border border-line rounded-xl bg-white text-night placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold disabled:opacity-50 transition';
const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40';

// ─── Small pieces ────────────────────────────────────────────────────────────
const Notice: React.FC<{ kind: 'error' | 'ok'; children: React.ReactNode; onClose?: () => void }> = ({ kind, children, onClose }) => (
  <div
    className={`p-3 rounded-xl border flex items-start gap-2 text-sm font-semibold ${
      kind === 'error' ? 'bg-brick-light border-brick/40 text-brick' : 'bg-leaf-light border-leaf/40 text-leaf'
    }`}
  >
    {kind === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
    <div className="flex-1">{children}</div>
    {onClose && (
      <button onClick={onClose} className="text-xs underline opacity-70 hover:opacity-100">
        dismiss
      </button>
    )}
  </div>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode; tone?: 'teal' | 'amber' | 'leaf' | 'coral' }> = ({
  label, value, sub, icon, tone = 'teal',
}) => {
  const color = { teal: 'text-primary', amber: 'text-amber', leaf: 'text-leaf', coral: 'text-coral' }[tone];
  return (
    <div className="bg-white border border-line rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-sage">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <div className={`mt-1 font-heading text-3xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs text-sage mt-0.5">{sub}</div>}
    </div>
  );
};

const errMsg = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

// ─── Overview ────────────────────────────────────────────────────────────────
const Overview: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setStats((await api.admin.getStats()).data);
    } catch (err) {
      setError(errMsg(err, 'Could not load the dashboard.'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleReturn = async (p: AdminStats['overdueParcels'][number]) => {
    if (!window.confirm(`Return the ${p.courier} parcel for ${p.flat.label} to the courier?`)) return;
    setBusyId(p.id);
    try {
      await api.parcels.returnParcel(p.id);
      await load();
    } catch (err) {
      setError(errMsg(err, 'Could not return the parcel.'));
    } finally {
      setBusyId(null);
    }
  };

  if (error && !stats) return <Notice kind="error">{error}</Notice>;
  if (!stats) return <div className="py-16 text-center text-sage"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;

  const { parcels, people, doorDeliveriesThisMonth: door } = stats;
  return (
    <div className="space-y-6">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="In parcel room" value={parcels.inRoom} sub={`${parcels.byStatus.SCHEDULED} with a code`} icon={<Package className="w-5 h-5" />} />
        <StatCard label="Overdue (2+ days)" value={parcels.overdue} sub="still in the room" icon={<Clock className="w-5 h-5" />} tone={parcels.overdue ? 'amber' : 'teal'} />
        <StatCard label="Handed over today" value={parcels.handedOverToday} sub={`${parcels.loggedToday} logged today`} icon={<PackageCheck className="w-5 h-5" />} tone="leaf" />
        <StatCard label="Door deliveries" value={door.count} sub={`${formatFee(door.feesPaise)} this month`} icon={<Truck className="w-5 h-5" />} tone="coral" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          ['Flats', people.flats], ['Residents', people.residents], ['Guards', people.guards], ['Admins', people.admins],
        ].map(([label, n]) => (
          <div key={label as string} className="bg-mist border border-line rounded-xl py-2.5">
            <div className="font-heading text-xl font-black text-night">{n}</div>
            <div className="text-xs font-semibold text-sage">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-heading font-extrabold text-night">Overdue parcels</h3>
          <button onClick={load} className={`${btnGhost} text-sage hover:bg-mist`}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
        {stats.overdueParcels.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-sage">Nothing has waited more than 2 days. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs uppercase tracking-wider text-sage">
                <tr>
                  <th className="text-left px-4 py-2">Flat</th>
                  <th className="text-left px-4 py-2">Courier</th>
                  <th className="text-left px-4 py-2">Waiting</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {stats.overdueParcels.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-4 py-2.5 font-bold text-night">{p.flat.label}</td>
                    <td className="px-4 py-2.5">{p.courier}</td>
                    <td className="px-4 py-2.5 font-bold text-amber">{p.daysInRoom} days</td>
                    <td className="px-4 py-2.5 text-sage">{STATUS_LABEL[p.status] ?? p.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleReturn(p)}
                        disabled={busyId === p.id}
                        className={`${btnGhost} text-sage hover:bg-mist`}
                      >
                        {busyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↩'} Return to courier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Flats ───────────────────────────────────────────────────────────────────
const Flats: React.FC = () => {
  const [flats, setFlats] = useState<AdminFlat[] | null>(null);
  const [tower, setTower] = useState('');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setFlats((await api.admin.listFlats()).data);
    } catch (err) {
      setError(errMsg(err, 'Could not load flats.'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setOk(null); setBusy(true);
    try {
      const res = await api.admin.createFlat({ tower, number });
      setOk(`${res.data.label} added.`);
      setNumber('');
      await load();
    } catch (err) {
      setError(errMsg(err, 'Could not add the flat.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: AdminFlat) => {
    if (!window.confirm(`Delete ${f.label}?`)) return;
    setError(null); setOk(null);
    try {
      await api.admin.deleteFlat(f.id);
      setOk(`${f.label} deleted.`);
      await load();
    } catch (err) {
      setError(errMsg(err, 'Could not delete the flat.'));
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (flats ?? []).filter((f) => !q || f.label.toLowerCase().includes(q) || f.residents?.some((r) => r.name.toLowerCase().includes(q)));
  }, [flats, query]);

  return (
    <div className="space-y-4">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {ok && <Notice kind="ok" onClose={() => setOk(null)}>{ok}</Notice>}

      <form onSubmit={add} className="bg-white border border-line rounded-2xl p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1 text-xs font-bold text-sage">Tower
          <input className={`${input} mt-1`} value={tower} onChange={(e) => setTower(e.target.value)} placeholder="A" required maxLength={20} />
        </label>
        <label className="flex-1 text-xs font-bold text-sage">Flat number
          <input className={`${input} mt-1`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1204" required maxLength={20} />
        </label>
        <button className={btnPrimary} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add flat</button>
      </form>

      <input className={input} placeholder="Search flats or residents" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="bg-white border border-line rounded-2xl overflow-x-auto">
        {flats === null ? (
          <div className="py-10 text-center text-sage"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-mist text-xs uppercase tracking-wider text-sage">
              <tr>
                <th className="text-left px-4 py-2">Flat</th>
                <th className="text-left px-4 py-2">Residents</th>
                <th className="text-left px-4 py-2">In room</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} className="border-t border-line align-top">
                  <td className="px-4 py-2.5 font-bold text-night whitespace-nowrap">{f.label}</td>
                  <td className="px-4 py-2.5 text-night">
                    {f.residents?.length ? f.residents.map((r) => r.name).join(', ') : <span className="text-sage">No residents</span>}
                  </td>
                  <td className="px-4 py-2.5">{f.parcelsInRoom || <span className="text-sage">0</span>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(f)} className={`${btnGhost} text-brick hover:bg-brick-light`} title="Delete flat">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sage">No flats match.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── People ──────────────────────────────────────────────────────────────────
const PersonRow: React.FC<{
  u: AdminUser; flats: AdminFlat[]; isSelf: boolean; onSaved: (msg: string) => void; onError: (msg: string) => void;
}> = ({ u, flats, isSelf, onSaved, onError }) => {
  const [role, setRole] = useState<Role>(u.role);
  const [flatId, setFlatId] = useState<string>(u.flatId ?? '');
  const [busy, setBusy] = useState(false);
  const dirty = role !== u.role || flatId !== (u.flatId ?? '');

  const save = async () => {
    setBusy(true);
    try {
      await api.admin.updateUser(u.id, { role, flatId: flatId || null });
      onSaved(`${u.name} updated.`);
    } catch (err) {
      onError(errMsg(err, 'Could not save changes.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${u.name} (${u.phone})? They will be signed out immediately.`)) return;
    setBusy(true);
    try {
      await api.admin.deleteUser(u.id);
      onSaved(`${u.name} removed.`);
    } catch (err) {
      onError(errMsg(err, 'Could not remove this person.'));
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-2.5 font-bold text-night">{u.name}{isSelf && <span className="ml-1.5 text-xs text-sage font-semibold">(you)</span>}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-night whitespace-nowrap">{u.phone}</td>
      <td className="px-4 py-2.5">
        <select className={`${input} py-1.5`} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf || busy}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5">
        <select className={`${input} py-1.5`} value={flatId} onChange={(e) => setFlatId(e.target.value)} disabled={busy}>
          <option value="">No flat</option>
          {flats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {dirty && (
          <button onClick={save} disabled={busy} className={`${btnGhost} text-white bg-primary hover:bg-primary-hover mr-1`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        )}
        <button onClick={remove} disabled={isSelf || busy} className={`${btnGhost} text-brick hover:bg-brick-light`} title={isSelf ? 'You cannot remove yourself' : 'Remove'}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};

const People: React.FC = () => {
  const { user } = useAuth();
  const [people, setPeople] = useState<AdminUser[] | null>(null);
  const [flats, setFlats] = useState<AdminFlat[]>([]);
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', role: 'RESIDENT' as Role, flatId: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, f] = await Promise.all([api.admin.listUsers(), api.admin.listFlats()]);
      setPeople(u.data);
      setFlats(f.data);
    } catch (err) {
      setError(errMsg(err, 'Could not load people.'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setOk(null); setBusy(true);
    try {
      await api.admin.createUser({ ...form, flatId: form.flatId || null });
      setOk(`${form.name} added. They can sign in with ${form.phone}.`);
      setForm({ ...form, name: '', phone: '' });
      await load();
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? err.details.map((d: any) => d.message).join(' ') : '';
      setError(details || errMsg(err, 'Could not add this person.'));
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter(
      (u) => (roleFilter === 'ALL' || u.role === roleFilter) &&
        (!q || u.name.toLowerCase().includes(q) || u.phone.includes(q) || (u.flatLabel ?? '').toLowerCase().includes(q))
    );
  }, [people, roleFilter, query]);

  return (
    <div className="space-y-4">
      {error && <Notice kind="error" onClose={() => setError(null)}>{error}</Notice>}
      {ok && <Notice kind="ok" onClose={() => setOk(null)}>{ok}</Notice>}

      <form onSubmit={add} className="bg-white border border-line rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
        <label className="text-xs font-bold text-sage sm:col-span-1">Name
          <input className={`${input} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={80} />
        </label>
        <label className="text-xs font-bold text-sage">Mobile
          <input className={`${input} mt-1`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" required type="tel" />
        </label>
        <label className="text-xs font-bold text-sage">Role
          <select className={`${input} mt-1`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-sage">Flat
          <select className={`${input} mt-1`} value={form.flatId} onChange={(e) => setForm({ ...form, flatId: e.target.value })} required={form.role === 'RESIDENT'}>
            <option value="">{form.role === 'RESIDENT' ? 'Choose a flat' : 'No flat'}</option>
            {flats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <button className={btnPrimary} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add person</button>
      </form>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1 bg-mist border border-line rounded-xl p-1">
          {(['ALL', 'RESIDENT', 'GUARD', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${roleFilter === r ? 'bg-primary text-white' : 'text-sage hover:text-night'}`}
            >
              {r === 'ALL' ? 'Everyone' : `${ROLE_LABEL[r]}s`}
            </button>
          ))}
        </div>
        <input className={`${input} flex-1`} placeholder="Search name, phone or flat" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="bg-white border border-line rounded-2xl overflow-x-auto">
        {people === null ? (
          <div className="py-10 text-center text-sage"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-mist text-xs uppercase tracking-wider text-sage">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Mobile</th>
                <th className="text-left px-4 py-2 w-36">Role</th>
                <th className="text-left px-4 py-2 w-48">Flat</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <PersonRow
                  key={`${u.id}:${u.role}:${u.flatId}`}
                  u={u}
                  flats={flats}
                  isSelf={u.id === user?.id}
                  onSaved={(m) => { setError(null); setOk(m); load(); }}
                  onError={(m) => { setOk(null); setError(m); }}
                />
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sage">No one matches.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Import ──────────────────────────────────────────────────────────────────
const Import: React.FC = () => {
  const [csv, setCsv] = useState('');
  const [createMissingFlats, setCreateMissingFlats] = useState(true);
  const [busy, setBusy] = useState<'check' | 'import' | null>(null);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string; rows?: { line: number; message: string }[] } | null>(null);
  const [checked, setChecked] = useState(false);

  const run = async (dryRun: boolean) => {
    setBusy(dryRun ? 'check' : 'import');
    setResult(null);
    try {
      const res = await api.admin.importResidents({ csv, createMissingFlats, dryRun });
      const d = res.data;
      const flatsText = d.newFlats ? ` and ${d.newFlats} new flat${d.newFlats === 1 ? '' : 's'}` : '';
      if (dryRun) {
        setChecked(true);
        setResult({ kind: 'ok', text: `All ${d.residents} row${d.residents === 1 ? '' : 's'} look good: ${d.residents} resident${d.residents === 1 ? '' : 's'}${flatsText} will be added.` });
      } else {
        setResult({ kind: 'ok', text: `Imported ${d.residents} resident${d.residents === 1 ? '' : 's'}${flatsText}. They can sign in with their mobile numbers now.` });
        setCsv('');
        setChecked(false);
      }
    } catch (err) {
      const rows = err instanceof ApiError ? (err.details as any)?.errors : undefined;
      setResult({ kind: 'error', text: errMsg(err, 'Import failed.'), rows });
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsv(await file.text());
    setChecked(false);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-line rounded-2xl p-4 space-y-3">
        <div>
          <h3 className="font-heading font-extrabold text-night">Import residents from a spreadsheet</h3>
          <p className="text-sm text-sage mt-1">
            One resident per line: <code className="bg-mist px-1.5 py-0.5 rounded text-night">name,phone,tower,flat</code>. A header row is fine.
            Export from Excel or Google Sheets as CSV, then choose the file or paste it below. Nothing is saved unless every row is valid.
          </p>
        </div>
        <label className={`${btnGhost} border border-line text-night hover:bg-mist cursor-pointer w-fit`}>
          <Upload className="w-3.5 h-3.5" /> Choose CSV file
          <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
        </label>
        <textarea
          className={`${input} font-mono text-xs h-48`}
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setChecked(false); }}
          placeholder={'name,phone,tower,flat\nAnita Desai,9876501234,A,1206\nRahul Menon,+91 98765 01235,B,403'}
        />
        <label className="flex items-center gap-2 text-sm text-night">
          <input type="checkbox" checked={createMissingFlats} onChange={(e) => { setCreateMissingFlats(e.target.checked); setChecked(false); }} />
          Create flats that don't exist yet
        </label>
        <div className="flex gap-2">
          <button onClick={() => run(true)} disabled={!csv.trim() || !!busy} className={`${btnPrimary} bg-night hover:bg-primary`}>
            {busy === 'check' && <Loader2 className="w-4 h-4 animate-spin" />} Check rows
          </button>
          <button onClick={() => run(false)} disabled={!checked || !!busy} className={btnPrimary} title={checked ? '' : 'Check the rows first'}>
            {busy === 'import' && <Loader2 className="w-4 h-4 animate-spin" />} Import
          </button>
        </div>
      </div>

      {result && (
        <Notice kind={result.kind}>
          {result.text}
          {result.rows && (
            <ul className="mt-2 space-y-0.5 font-normal text-night max-h-64 overflow-auto">
              {result.rows.map((r) => (
                <li key={`${r.line}:${r.message}`}><span className="font-mono font-bold">Line {r.line}:</span> {r.message}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'flats', label: 'Flats', icon: <Building2 className="w-4 h-4" /> },
    { id: 'people', label: 'People', icon: <Users className="w-4 h-4" /> },
    { id: 'import', label: 'Import', icon: <Upload className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5 text-night">
      <div className="bg-primary text-white p-6 rounded-2xl shadow-lg">
        <h1 className="font-heading text-2xl font-black">Society Admin</h1>
        <p className="text-sm mt-1 text-sand/90">{user?.name} · {user?.societyName}</p>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white border border-line rounded-2xl p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
              tab === t.id ? 'bg-primary text-white' : 'text-sage hover:bg-mist hover:text-night'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview />}
      {tab === 'flats' && <Flats />}
      {tab === 'people' && <People />}
      {tab === 'import' && <Import />}
    </div>
  );
};
