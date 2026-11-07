import React, { useState, useEffect } from 'react';
import { PackagePlus, Search, RefreshCw, CheckCircle2, Clock, ShieldCheck, Box, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { assetUrl } from '../config';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { LogParcelModal } from '../components/guard/LogParcelModal';
import { HandoverModal } from '../components/guard/HandoverModal';

export const GuardDeskPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [parcels, setParcels] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'ALL' | 'LOGGED' | 'SCHEDULED' | 'HANDED_OVER'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [handoverParcel, setHandoverParcel] = useState<any | null>(null);

  // Fetch parcels
  const fetchParcels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.parcels.getParcels(
        filterTab === 'ALL' ? undefined : filterTab,
        searchQuery || undefined
      );
      setParcels(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load parcel list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, [filterTab]);

  // Real-time socket event listeners with deduplication
  useEffect(() => {
    if (!socket) return;

    const handleParcelLogged = (newParcel: any) => {
      console.log('⚡ Socket event [parcel:logged]:', newParcel);
      setParcels((prev) => {
        if (prev.some((p) => p.id === newParcel.id)) {
          return prev.map((p) => (p.id === newParcel.id ? newParcel : p));
        }
        return [newParcel, ...prev];
      });
    };

    const handleParcelScheduled = (updatedParcel: any) => {
      console.log('⚡ Socket event [parcel:scheduled]:', updatedParcel);
      setParcels((prev) =>
        prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p))
      );
    };

    const handleParcelHandedOver = (handedParcel: any) => {
      console.log('⚡ Socket event [parcel:handed_over]:', handedParcel);
      setParcels((prev) =>
        prev.map((p) => (p.id === handedParcel.id ? handedParcel : p))
      );
    };

    socket.off('parcel:logged');
    socket.off('parcel:scheduled');
    socket.off('parcel:handed_over');

    socket.on('parcel:logged', handleParcelLogged);
    socket.on('parcel:scheduled', handleParcelScheduled);
    socket.on('parcel:handed_over', handleParcelHandedOver);

    return () => {
      socket.off('parcel:logged', handleParcelLogged);
      socket.off('parcel:scheduled', handleParcelScheduled);
      socket.off('parcel:handed_over', handleParcelHandedOver);
    };
  }, [socket]);

  // Quick stats
  const activeCount = parcels.filter((p) => p.status === 'LOGGED' || p.status === 'SCHEDULED').length;
  const readyCount = parcels.filter((p) => p.status === 'SCHEDULED').length;
  const handedTodayCount = parcels.filter((p) => p.status === 'HANDED_OVER').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6" style={{ color: '#10302F' }}>
      {/* 1. TOP BANNER: Deep Teal (#0B5D5B) with Coral button (#F26B4E) */}
      <div
        className="rounded-2xl p-6 sm:p-7 shadow-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-5 text-white"
        style={{ backgroundColor: '#0B5D5B', borderColor: '#084846' }}
      >
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(246, 231, 203, 0.18)' }}>
              <ShieldCheck className="w-7 h-7" style={{ color: '#F6E7CB' }} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Guard Desk
                </h1>
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full font-mono"
                  style={{ backgroundColor: '#F6E7CB', color: '#10302F' }}
                >
                  GATE LIVE
                </span>
              </div>
              <p className="text-sm mt-1 font-medium" style={{ color: '#F6E7CB', opacity: 0.9 }}>
                Gate Parcel Intake & Handover Verification • Society:{' '}
                <span className="font-bold underline decoration-white/40">
                  {user?.societyName || 'Greenwood Heights'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Big Action: Coral (#F26B4E) Button */}
        <button
          onClick={() => setIsLogModalOpen(true)}
          className="btn-touch w-full md:w-auto px-7 py-3 text-white font-heading font-black text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2.5 shrink-0 hover:opacity-95 active:scale-95"
          style={{ backgroundColor: '#F26B4E' }}
        >
          <PackagePlus className="w-5 h-5 stroke-[2.5]" />
          <span>Log Incoming Parcel</span>
        </button>
      </div>

      {/* 2. METRICS BAR: White surface (#FFFFFF) with Deep Teal & Leaf numbers */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        <div
          className="p-5 rounded-2xl shadow-sm border"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#DCE5E3' }}
        >
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5E7371' }}>
            In Parcel Room
          </div>
          <div className="text-3xl sm:text-4xl font-heading font-black mt-1" style={{ color: '#0B5D5B' }}>
            {activeCount}
          </div>
          <div className="text-[11px] font-semibold mt-1" style={{ color: '#5E7371' }}>
            Awaiting pickup/delivery
          </div>
        </div>

        <div
          className="p-5 rounded-2xl shadow-sm border"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#DCE5E3' }}
        >
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5E7371' }}>
            Ready With Code
          </div>
          <div className="text-3xl sm:text-4xl font-heading font-black mt-1" style={{ color: '#3A9D5D' }}>
            {readyCount}
          </div>
          <div className="text-[11px] font-semibold mt-1" style={{ color: '#3A9D5D' }}>
            Slot confirmed by resident
          </div>
        </div>

        <div
          className="p-5 rounded-2xl shadow-sm border"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#DCE5E3' }}
        >
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5E7371' }}>
            Handed Over
          </div>
          <div className="text-3xl sm:text-4xl font-heading font-black mt-1" style={{ color: '#10302F' }}>
            {handedTodayCount}
          </div>
          <div className="text-[11px] font-semibold mt-1" style={{ color: '#5E7371' }}>
            Completed handovers
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR: Search & Sand (#F6E7CB) Filter Chips */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl shadow-sm border"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#DCE5E3' }}
      >
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-5 h-5 absolute left-3.5 top-3" style={{ color: '#5E7371' }} />
          <input
            type="text"
            placeholder="Search flat (1204) or courier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchParcels()}
            className="w-full pl-11 pr-4 py-2.5 text-sm rounded-xl font-medium focus:outline-none focus:ring-2"
            style={{
              backgroundColor: '#F5F7F6',
              borderColor: '#DCE5E3',
              borderWidth: '1px',
              color: '#10302F',
            }}
          />
        </div>

        {/* Filter Pills with Sand (#F6E7CB) selected style */}
        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'SCHEDULED', 'LOGGED', 'HANDED_OVER'] as const).map((tab) => {
            const isSelected = filterTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border"
                style={{
                  backgroundColor: isSelected ? '#F6E7CB' : '#F5F7F6',
                  color: '#10302F',
                  borderColor: isSelected ? '#DCE5E3' : 'transparent',
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {tab === 'ALL'
                  ? 'All Parcels'
                  : tab === 'SCHEDULED'
                  ? 'Ready for Handover'
                  : tab === 'LOGGED'
                  ? 'Awaiting Resident'
                  : 'Handed Over'}
              </button>
            );
          })}

          <button
            onClick={fetchParcels}
            className="p-2.5 rounded-xl transition hover:opacity-80 border"
            style={{ backgroundColor: '#F5F7F6', borderColor: '#DCE5E3', color: '#5E7371' }}
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ color: '#F26B4E' }} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="p-4 rounded-xl text-sm font-semibold flex items-center space-x-2 border"
          style={{ backgroundColor: '#faeded', borderColor: '#C93C3C', color: '#C93C3C' }}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. PARCEL CARDS GRID */}
      {isLoading && parcels.length === 0 ? (
        <div className="py-20 text-center" style={{ color: '#5E7371' }}>
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: '#F26B4E' }} />
          <p className="text-sm font-bold">Loading parcels from the gate queue...</p>
        </div>
      ) : parcels.length === 0 ? (
        <div
          className="py-16 rounded-2xl text-center p-8 space-y-3 border"
          style={{ backgroundColor: '#FFFFFF', borderColor: '#DCE5E3' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ backgroundColor: '#F6E7CB', color: '#0B5D5B' }}
          >
            <Box className="w-8 h-8" />
          </div>
          <h3 className="font-heading text-xl font-bold" style={{ color: '#10302F' }}>
            No parcels found in this queue
          </h3>
          <p className="text-xs max-w-sm mx-auto" style={{ color: '#5E7371' }}>
            When delivery couriers arrive at the gate, click "Log Incoming Parcel" above to record the package and alert the resident.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {parcels.map((parcel) => {
            const isHandedOver = parcel.status === 'HANDED_OVER';
            const isScheduled = parcel.status === 'SCHEDULED';
            const isOlderThan2Days =
              !isHandedOver &&
              Date.now() - new Date(parcel.loggedAt).getTime() > 2 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={parcel.id}
                className="rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between border"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: isScheduled ? '#3A9D5D' : isOlderThan2Days ? '#E0A100' : '#DCE5E3',
                  borderWidth: isScheduled || isOlderThan2Days ? '2px' : '1.5px',
                }}
              >
                <div>
                  {/* Card Header: Courier Pill + Status Tag */}
                  <div className="flex items-center justify-between mb-3.5">
                    {/* Courier Tag: Sand (#F6E7CB) */}
                    <span
                      className="font-heading text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg border"
                      style={{
                        backgroundColor: '#F6E7CB',
                        color: '#10302F',
                        borderColor: '#ebd6b0',
                      }}
                    >
                      {parcel.courier}
                    </span>

                    {/* Status Badge */}
                    {isHandedOver ? (
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1.5 border"
                        style={{
                          backgroundColor: '#eaf6ef',
                          color: '#3A9D5D',
                          borderColor: '#3A9D5D',
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Handed Over</span>
                      </span>
                    ) : isScheduled ? (
                      <span
                        className="text-xs font-black px-3 py-1 rounded-full flex items-center space-x-1.5 border animate-pulse"
                        style={{
                          backgroundColor: '#eaf6ef',
                          color: '#3A9D5D',
                          borderColor: '#3A9D5D',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3A9D5D' }} />
                        <span>Ready with Code</span>
                      </span>
                    ) : isOlderThan2Days ? (
                      <span
                        className="text-xs font-black px-3 py-1 rounded-full flex items-center space-x-1.5 border"
                        style={{
                          backgroundColor: '#fdf6e6',
                          color: '#E0A100',
                          borderColor: '#E0A100',
                        }}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>2+ Days in Room</span>
                      </span>
                    ) : (
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center space-x-1.5 border"
                        style={{
                          backgroundColor: '#fdeee9',
                          color: '#F26B4E',
                          borderColor: '#F26B4E',
                        }}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Waiting for Resident</span>
                      </span>
                    )}
                  </div>

                  {/* Destination Flat: Big Night Teal (#10302F) */}
                  <div className="my-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#5E7371' }}>
                      Destination Flat
                    </div>
                    <div
                      className="text-3xl font-heading font-black tracking-tight"
                      style={{ color: '#10302F' }}
                    >
                      Tower {parcel.flat.tower} - {parcel.flat.number}
                    </div>
                  </div>

                  {/* Parcel Photo Preview */}
                  {parcel.photoUrl && (
                    <div
                      className="my-3 rounded-xl overflow-hidden h-28 border"
                      style={{ borderColor: '#DCE5E3' }}
                    >
                      <img src={assetUrl(parcel.photoUrl)} alt="Parcel Proof" className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Handover Mode & Slot Box */}
                  {parcel.handover && (
                    <div
                      className="mt-3.5 p-3 rounded-xl border text-xs space-y-1.5"
                      style={{
                        backgroundColor: '#F5F7F6',
                        borderColor: '#DCE5E3',
                        color: '#10302F',
                      }}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span style={{ color: '#5E7371' }}>Handover Mode:</span>
                        <span style={{ color: '#0B5D5B' }} className="font-extrabold">
                          {parcel.handover.mode === 'DOOR' ? '🚪 Door Delivery (₹20)' : '📦 Free Counter Pickup'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span style={{ color: '#5E7371' }}>Time Slot:</span>
                        <span style={{ color: '#10302F' }} className="font-bold">
                          {new Date(parcel.handover.slotStart).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(parcel.handover.slotEnd).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Handover Completed details */}
                  {isHandedOver && parcel.handover?.completedAt && (
                    <div className="mt-3 text-xs font-medium" style={{ color: '#5E7371' }}>
                      Handed over on{' '}
                      {new Date(parcel.handover.completedAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      by {parcel.handover.completedBy?.name || 'Gate Guard'}
                    </div>
                  )}
                </div>

                {/* Handover Action Button: Deep Teal or Leaf */}
                <div className="mt-5 pt-3.5 border-t" style={{ borderColor: '#DCE5E3' }}>
                  {isHandedOver ? (
                    <div
                      className="text-center py-2.5 text-xs font-black rounded-xl border"
                      style={{
                        backgroundColor: '#eaf6ef',
                        color: '#3A9D5D',
                        borderColor: '#3A9D5D',
                      }}
                    >
                      ✓ HANDOVER RECORD COMPLETED
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHandoverParcel(parcel)}
                      className="btn-touch w-full rounded-xl font-heading font-black text-sm tracking-wide text-white transition shadow-sm hover:opacity-95 active:scale-98"
                      style={{
                        backgroundColor: isScheduled ? '#3A9D5D' : '#0B5D5B',
                      }}
                    >
                      {isScheduled ? 'Enter 4-Digit Code to Hand Over' : 'Hand Over with Code'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <LogParcelModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onParcelLogged={(newParcel) => {
          setParcels((prev) => {
            if (prev.some((p) => p.id === newParcel.id)) return prev;
            return [newParcel, ...prev];
          });
        }}
      />

      <HandoverModal
        isOpen={!!handoverParcel}
        parcel={handoverParcel}
        onClose={() => setHandoverParcel(null)}
        onSuccess={(updatedParcel) => {
          setParcels((prev) =>
            prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p))
          );
        }}
      />
    </div>
  );
};
