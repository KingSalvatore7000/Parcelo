import React, { useEffect, useState, useCallback } from 'react';
import {
  Package, Clock, CheckCircle2, Calendar, Truck, AlertCircle,
  RefreshCw, ChevronRight, X, Loader2, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';

// ─── Brand palette (inline style constants) ───────────────────────────────────
const C = {
  teal: '#0B5D5B',
  coral: '#F26B4E',
  sand: '#F6E7CB',
  sandBorder: '#e6d4a8',
  leaf: '#3A9D5D',
  leafLight: '#e8f5ee',
  amber: '#E0A100',
  amberLight: '#fdf3d0',
  brick: '#C93C3C',
  brickLight: '#fde8e8',
  mist: '#F5F7F6',
  white: '#FFFFFF',
  night: '#10302F',
  sage: '#5E7371',
  line: '#DCE5E3',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Parcel {
  id: string;
  courier: string;
  status: 'LOGGED' | 'SCHEDULED' | 'HANDED_OVER' | 'UNCLAIMED' | 'RETURNED';
  loggedAt: string;
  flat: { tower: string; number: string; label: string };
  photoUrl?: string | null;
  handover?: {
    mode: 'PICKUP' | 'DOOR';
    slotStart?: string;
    slotEnd?: string;
    fee: number;
    completedAt?: string;
  } | null;
}

interface HandoverStamp {
  parcelId: string;
  courier: string;
  flat: string;
  mode: 'PICKUP' | 'DOOR';
  slotStart: string;
  slotEnd: string;
  fee: number;
  code: string;
  expiresAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/** Build today's available 2-hour slots (rounded up to the next even hour). */
function buildTodaySlots(): { label: string; start: string; end: string }[] {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(now.getHours() + 1, 0, 0, 0); // at least 1h from now

  const slots: { label: string; start: string; end: string }[] = [];
  const hours = [8, 10, 12, 14, 16, 18, 20]; // 8am–10pm in 2h blocks
  for (const h of hours) {
    const slotStart = new Date(now);
    slotStart.setHours(h, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(h + 2);

    if (slotStart < cutoff) continue; // skip past slots
    if (slotEnd.getDate() !== now.getDate()) continue; // no overnight

    slots.push({
      label: `${h}:00 – ${h + 2}:00`,
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });
  }
  return slots;
}

// ─── Schedule Slot Modal ──────────────────────────────────────────────────────
const ScheduleModal: React.FC<{
  parcel: Parcel;
  onClose: () => void;
  onScheduled: (stamp: HandoverStamp) => void;
}> = ({ parcel, onClose, onScheduled }) => {
  const [mode, setMode] = useState<'PICKUP' | 'DOOR'>('PICKUP');
  const [slotIdx, setSlotIdx] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = buildTodaySlots();

  const handleConfirm = async () => {
    if (slots.length === 0) {
      setError('No available slots today. Try again tomorrow.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const chosen = slots[slotIdx];
      const res = await api.parcels.scheduleParcel(parcel.id, {
        mode,
        slotStart: chosen.start,
        slotEnd: chosen.end,
      });
      onScheduled(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to schedule parcel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(16,48,47,0.6)', backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: C.teal, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 20, fontWeight: 800, color: C.white, margin: 0 }}>
              Schedule Pickup
            </h2>
            <p style={{ fontSize: 12, color: `${C.sand}cc`, margin: '2px 0 0' }}>
              {parcel.courier} · Tower {parcel.flat.tower}-{parcel.flat.number}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.sand, padding: 6, borderRadius: 8 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ padding: '12px 14px', background: C.brickLight, border: `1px solid ${C.brick}55`, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertCircle style={{ width: 18, height: 18, color: C.brick, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: C.brick, fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {/* Mode toggle */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.night, marginBottom: 10 }}>How would you like to receive it?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                { value: 'PICKUP', icon: '📦', label: 'Counter Pickup', sub: 'Free · Pick up at gate' },
                { value: 'DOOR', icon: '🚪', label: 'Door Delivery', sub: '₹20 · Guard brings it up' },
              ] as const).map(({ value, icon, label, sub }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  style={{
                    padding: '14px 12px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${mode === value ? C.teal : C.line}`,
                    background: mode === value ? `${C.teal}0f` : C.mist,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: mode === value ? C.teal : C.night }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.sage, marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Slot picker */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.night, marginBottom: 10 }}>
              Today's available slots
            </p>
            {slots.length === 0 ? (
              <div style={{ padding: 16, background: C.amberLight, borderRadius: 12, border: `1px solid ${C.amber}44`, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>No slots left for today.</p>
                <p style={{ fontSize: 11, color: C.sage, marginTop: 4 }}>Slots reset tomorrow from 8:00 AM.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => setSlotIdx(i)}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: `2px solid ${slotIdx === i ? C.coral : C.line}`,
                      background: slotIdx === i ? `${C.coral}18` : C.mist,
                      color: slotIdx === i ? C.coral : C.sage,
                      transition: 'all 0.15s',
                    }}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fee summary */}
          <div style={{ padding: '10px 14px', background: C.sand, borderRadius: 12, border: `1px solid ${C.sandBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.night }}>
              {mode === 'DOOR' ? '🚪 Door Delivery fee' : '📦 Counter Pickup'}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: mode === 'DOOR' ? C.coral : C.leaf }}>
              {mode === 'DOOR' ? '₹20' : 'Free'}
            </span>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || slots.length === 0}
            style={{
              padding: '14px 24px', background: isSubmitting ? `${C.coral}88` : C.coral,
              color: C.white, border: 'none', borderRadius: 14, fontFamily: 'Bricolage Grotesque, sans-serif',
              fontWeight: 800, fontSize: 16, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                Confirming slot...
              </>
            ) : (
              'Confirm slot and get code'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Postal Stamp Code Card ───────────────────────────────────────────────────
const StampCard: React.FC<{ stamp: HandoverStamp; onDismiss: () => void }> = ({ stamp, onDismiss }) => {
  // Countdown to expiry
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(stamp.expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(16,48,47,0.75)', backdropFilter: 'blur(6px)' }}>
      {/* Stamp card */}
      <div style={{
        background: C.white, borderRadius: 20, width: '100%', maxWidth: 380,
        boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden',
        border: `3px solid ${C.teal}`,
      }}>
        {/* Stamp header with perforated edge effect */}
        <div style={{
          background: C.teal, padding: '20px 24px 16px', position: 'relative',
          backgroundImage: 'radial-gradient(circle at 0 100%, transparent 12px, #0B5D5B 12px), radial-gradient(circle at 100% 100%, transparent 12px, #0B5D5B 12px)',
          backgroundSize: '20px 100%, 20px 100%', backgroundRepeat: 'no-repeat',
          backgroundPosition: '0 bottom, right bottom',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Package style={{ width: 24, height: 24, color: C.coral }} />
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 18, fontWeight: 900, color: C.white, letterSpacing: '-0.02em' }}>
              Thapal Handover Stamp
            </span>
          </div>
          <div style={{ fontSize: 12, color: `${C.sand}cc`, display: 'flex', gap: 16 }}>
            <span>📦 {stamp.courier}</span>
            <span>🏠 {stamp.flat}</span>
          </div>
        </div>

        {/* Perforated divider dots */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 16px', marginTop: -1 }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.mist, border: `1px solid ${C.line}`, marginTop: -3 }} />
          ))}
        </div>

        <div style={{ padding: '20px 24px 24px' }}>
          {/* 4-digit code */}
          <p style={{ fontSize: 11, fontWeight: 700, color: C.sage, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Your 4-Digit Handover Code
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
            {stamp.code.split('').map((d, i) => (
              <div
                key={i}
                style={{
                  width: 64, height: 72, borderRadius: 14, border: `2px solid ${C.brick}`,
                  background: C.brickLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bricolage Grotesque, monospace', fontSize: 38, fontWeight: 900, color: C.brick,
                  boxShadow: `0 4px 12px ${C.brick}22`,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: '10px 12px', background: C.mist, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 10, color: C.sage, fontWeight: 600, marginBottom: 2 }}>MODE</p>
              <p style={{ fontSize: 13, color: C.night, fontWeight: 800 }}>
                {stamp.mode === 'PICKUP' ? '📦 Counter Pickup' : '🚪 Door Delivery'}
              </p>
            </div>
            <div style={{ padding: '10px 12px', background: C.mist, borderRadius: 10, border: `1px solid ${C.line}` }}>
              <p style={{ fontSize: 10, color: C.sage, fontWeight: 600, marginBottom: 2 }}>FEE</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: stamp.fee > 0 ? C.coral : C.leaf }}>
                {stamp.fee > 0 ? `₹${stamp.fee}` : 'Free'}
              </p>
            </div>
            <div style={{ padding: '10px 12px', background: C.mist, borderRadius: 10, border: `1px solid ${C.line}`, gridColumn: '1 / -1' }}>
              <p style={{ fontSize: 10, color: C.sage, fontWeight: 600, marginBottom: 2 }}>SLOT</p>
              <p style={{ fontSize: 13, color: C.night, fontWeight: 800 }}>
                Today, {fmtTime(stamp.slotStart)} – {fmtTime(stamp.slotEnd)}
              </p>
            </div>
          </div>

          {/* Countdown */}
          <div style={{
            padding: '10px 14px', background: secondsLeft < 600 ? C.brickLight : C.amberLight,
            borderRadius: 12, border: `1px solid ${secondsLeft < 600 ? C.brick + '44' : C.amber + '44'}`,
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          }}>
            <Clock style={{ width: 16, height: 16, color: secondsLeft < 600 ? C.brick : C.amber, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: secondsLeft < 600 ? C.brick : C.amber }}>
                Code expires in {hh}:{mm}:{ss}
              </p>
              <p style={{ fontSize: 10, color: C.sage, marginTop: 2 }}>Show this screen to the guard at the gate</p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            style={{
              width: '100%', padding: '12px', background: C.teal, color: C.white, border: 'none',
              borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Got it — close stamp card
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Parcel Status Badge ──────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: Parcel['status'] }> = ({ status }) => {
  const map: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    LOGGED:      { label: 'Waiting',    bg: `${C.amber}22`,   color: C.amber,  icon: '⏳' },
    SCHEDULED:   { label: 'Code Ready', bg: `${C.coral}18`,   color: C.coral,  icon: '🔑' },
    HANDED_OVER: { label: 'Received',   bg: C.leafLight,       color: C.leaf,   icon: '✅' },
    UNCLAIMED:   { label: 'Unclaimed',  bg: C.brickLight,      color: C.brick,  icon: '⚠️' },
    RETURNED:    { label: 'Returned',   bg: `${C.sage}22`,     color: C.sage,   icon: '↩️' },
  };
  const s = map[status] || map.LOGGED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {s.icon} {s.label}
    </span>
  );
};

// ─── Parcel Card ──────────────────────────────────────────────────────────────
const ParcelCard: React.FC<{
  parcel: Parcel;
  onSchedule: (p: Parcel) => void;
  onViewCode: (p: Parcel) => void;
}> = ({ parcel, onSchedule, onViewCode }) => {
  const daysAgo = Math.floor((Date.now() - new Date(parcel.loggedAt).getTime()) / 86400000);
  const isOld = daysAgo >= 2;

  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1px solid ${isOld && parcel.status === 'LOGGED' ? C.amber : C.line}`,
      boxShadow: '0 2px 8px rgba(11,93,91,0.06)', overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Top stripe by status */}
      <div style={{ height: 4, background: parcel.status === 'HANDED_OVER' ? C.leaf : parcel.status === 'SCHEDULED' ? C.coral : parcel.status === 'LOGGED' && isOld ? C.amber : C.teal }} />

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {parcel.courier}
            </span>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 18, fontWeight: 800, color: C.night, marginTop: 2 }}>
              Tower {parcel.flat.tower} – {parcel.flat.number}
            </div>
          </div>
          <StatusBadge status={parcel.status} />
        </div>

        {/* Arrived / slot info */}
        <div style={{ fontSize: 12, color: C.sage, display: 'flex', gap: 16, marginBottom: 14 }}>
          <span>📅 Arrived {fmtDate(parcel.loggedAt)}</span>
          {parcel.handover?.slotStart && (
            <span>🕐 Slot {fmtTime(parcel.handover.slotStart)}–{fmtTime(parcel.handover.slotEnd!)}</span>
          )}
          {parcel.handover?.completedAt && (
            <span style={{ color: C.leaf }}>✅ Received {fmtDate(parcel.handover.completedAt)}</span>
          )}
        </div>

        {/* Old parcel warning */}
        {isOld && parcel.status === 'LOGGED' && (
          <div style={{ padding: '8px 12px', background: C.amberLight, border: `1px solid ${C.amber}44`, borderRadius: 10, marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Info style={{ width: 14, height: 14, color: C.amber, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>
              In room {daysAgo} day{daysAgo !== 1 ? 's' : ''} — please collect soon
            </span>
          </div>
        )}

        {/* Action buttons */}
        {parcel.status === 'LOGGED' && (
          <button
            onClick={() => onSchedule(parcel)}
            style={{
              width: '100%', padding: '10px 16px', background: C.coral, color: C.white,
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Calendar style={{ width: 16, height: 16 }} />
            Schedule Pickup
          </button>
        )}

        {parcel.status === 'SCHEDULED' && (
          <button
            onClick={() => onViewCode(parcel)}
            style={{
              width: '100%', padding: '10px 16px', background: C.teal, color: C.white,
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <ChevronRight style={{ width: 16, height: 16 }} />
            {parcel.handover?.mode === 'DOOR' ? 'Door Delivery Booked' : 'Pickup Booked'} · View code
          </button>
        )}

        {parcel.status === 'HANDED_OVER' && (
          <div style={{ padding: '10px 14px', background: C.leafLight, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 style={{ width: 18, height: 18, color: C.leaf }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.leaf }}>
              Parcel received — {parcel.handover?.completedAt ? fmtDateTime(parcel.handover.completedAt) : 'today'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main ResidentPage ────────────────────────────────────────────────────────
export const ResidentPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Parcel | null>(null);
  const [activeStamp, setActiveStamp] = useState<HandoverStamp | null>(null);
  const [viewCodeParcel, setViewCodeParcel] = useState<Parcel | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'LOGGED' | 'SCHEDULED' | 'HANDED_OVER'>('ALL');

  const loadParcels = useCallback(async () => {
    try {
      const res = await api.parcels.getParcels();
      setParcels(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load parcels.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadParcels(); }, [loadParcels]);

  // Socket listeners for live updates
  useEffect(() => {
    if (!socket) return;

    const onNew = (parcel: Parcel) => {
      setParcels((prev) => {
        if (prev.find((p) => p.id === parcel.id)) return prev;
        return [parcel, ...prev];
      });
    };

    const onScheduled = (parcel: Parcel) => {
      setParcels((prev) => prev.map((p) => (p.id === parcel.id ? { ...p, ...parcel } : p)));
    };

    const onHandedOver = (parcel: Parcel) => {
      setParcels((prev) => prev.map((p) => (p.id === parcel.id ? { ...p, ...parcel } : p)));
    };

    socket.off('parcel:new', onNew);
    socket.off('parcel:scheduled', onScheduled);
    socket.off('parcel:handed_over', onHandedOver);
    socket.on('parcel:new', onNew);
    socket.on('parcel:scheduled', onScheduled);
    socket.on('parcel:handed_over', onHandedOver);

    return () => {
      socket.off('parcel:new', onNew);
      socket.off('parcel:scheduled', onScheduled);
      socket.off('parcel:handed_over', onHandedOver);
    };
  }, [socket]);

  const handleScheduled = (stamp: HandoverStamp) => {
    setScheduleTarget(null);
    setActiveStamp(stamp);
    // Optimistically update parcel status
    setParcels((prev) =>
      prev.map((p) =>
        p.id === stamp.parcelId
          ? { ...p, status: 'SCHEDULED', handover: { mode: stamp.mode, slotStart: stamp.slotStart, slotEnd: stamp.slotEnd, fee: stamp.fee } }
          : p
      )
    );
  };

  const handleViewCode = (parcel: Parcel) => {
    // For already-scheduled parcels: we can't show code (not stored plaintext).
    // Show info telling them to reschedule if they need the code.
    setViewCodeParcel(parcel);
  };

  const filteredParcels = parcels.filter((p) => filter === 'ALL' || p.status === filter);

  const counts = {
    waiting: parcels.filter((p) => p.status === 'LOGGED').length,
    scheduled: parcels.filter((p) => p.status === 'SCHEDULED').length,
    received: parcels.filter((p) => p.status === 'HANDED_OVER').length,
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header card */}
      <div style={{ background: C.teal, borderRadius: 20, padding: '20px 24px', color: C.white }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 26, fontWeight: 900, color: C.white, margin: 0 }}>
              My Parcels
            </h1>
            <p style={{ fontSize: 13, color: `${C.sand}cc`, marginTop: 4 }}>
              {user?.name} · {user?.flat?.label || 'Your flat'}
            </p>
          </div>
          <button
            onClick={loadParcels}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: `${C.sand}cc`, padding: 8, borderRadius: 8 }}
            title="Refresh"
          >
            <RefreshCw style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
          {[
            { label: 'Waiting', value: counts.waiting, color: C.amber },
            { label: 'Code Ready', value: counts.scheduled, color: C.coral },
            { label: 'Received', value: counts.received, color: C.leaf },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 28, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, color: `${C.sand}99`, fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {(['ALL', 'LOGGED', 'SCHEDULED', 'HANDED_OVER'] as const).map((f) => {
          const labels: Record<string, string> = { ALL: 'All Parcels', LOGGED: 'Waiting', SCHEDULED: 'Code Ready', HANDED_OVER: 'Received' };
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                border: `2px solid ${active ? C.teal : C.line}`,
                background: active ? C.teal : C.white,
                color: active ? C.white : C.sage,
                transition: 'all 0.15s',
              }}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '14px 16px', background: C.brickLight, border: `1px solid ${C.brick}44`, borderRadius: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertCircle style={{ width: 18, height: 18, color: C.brick }} />
          <span style={{ fontSize: 13, color: C.brick, fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.sage }}>
          <Loader2 style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', margin: '0 auto 12px', color: C.teal }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Loading your parcels...</p>
        </div>
      ) : filteredParcels.length === 0 ? (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '60px 24px', background: C.white, borderRadius: 16, border: `1px solid ${C.line}` }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.sand, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Package style={{ width: 32, height: 32, color: C.teal }} />
          </div>
          <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 18, fontWeight: 800, color: C.night, margin: '0 0 8px' }}>
            No parcels yet
          </h3>
          <p style={{ fontSize: 13, color: C.sage, maxWidth: 280, margin: '0 auto' }}>
            {filter === 'ALL'
              ? "When a guard logs a parcel for your flat, it'll appear here instantly."
              : `No ${filter.toLowerCase().replace('_', ' ')} parcels right now.`}
          </p>
        </div>
      ) : (
        /* Parcel list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredParcels.map((p) => (
            <ParcelCard
              key={p.id}
              parcel={p}
              onSchedule={setScheduleTarget}
              onViewCode={handleViewCode}
            />
          ))}
        </div>
      )}

      {/* Delivery note */}
      <div style={{ padding: '12px 16px', background: `${C.teal}0a`, borderRadius: 12, border: `1px solid ${C.teal}22`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Truck style={{ width: 16, height: 16, color: C.teal, flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: C.sage, margin: 0 }}>
          <strong style={{ color: C.teal }}>How it works:</strong> When a parcel arrives, tap "Schedule Pickup" to choose counter pickup (free) or door delivery (₹20). You'll get a 4-digit code to show the guard.
        </p>
      </div>

      {/* Modals */}
      {scheduleTarget && (
        <ScheduleModal
          parcel={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onScheduled={handleScheduled}
        />
      )}

      {activeStamp && (
        <StampCard stamp={activeStamp} onDismiss={() => setActiveStamp(null)} />
      )}

      {/* "View Code" info for already-scheduled parcels (code not re-displayable) */}
      {viewCodeParcel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(16,48,47,0.6)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: C.white, borderRadius: 20, width: '100%', maxWidth: 380, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.sand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22 }}>🔑</span>
              </div>
              <div>
                <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 17, fontWeight: 800, color: C.night, margin: 0 }}>Slot already booked</h3>
                <p style={{ fontSize: 12, color: C.sage, margin: '2px 0 0' }}>{viewCodeParcel.courier} · Tower {viewCodeParcel.flat.tower}-{viewCodeParcel.flat.number}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: C.sage, marginBottom: 16, lineHeight: 1.6 }}>
              Your 4-digit code was shown when you first scheduled this parcel.
              {viewCodeParcel.handover?.slotStart && (
                <> Your slot is today {fmtTime(viewCodeParcel.handover.slotStart)}–{fmtTime(viewCodeParcel.handover.slotEnd!)}.</>
              )}
            </p>
            <p style={{ fontSize: 13, color: C.sage, marginBottom: 20, lineHeight: 1.6 }}>
              If you've lost the code, you can reschedule to generate a new one.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setViewCodeParcel(null); setScheduleTarget(viewCodeParcel); }}
                style={{ flex: 1, padding: '10px', background: C.coral, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Reschedule
              </button>
              <button
                onClick={() => setViewCodeParcel(null)}
                style={{ flex: 1, padding: '10px', background: C.mist, color: C.night, border: `1px solid ${C.line}`, borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
