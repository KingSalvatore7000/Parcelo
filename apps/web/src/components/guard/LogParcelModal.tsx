import React, { useState, useEffect } from 'react';
import { X, Camera, Check, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { COMMON_COURIERS } from '@parcelo/shared';

interface LogParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParcelLogged: (parcel: any) => void;
}

export const LogParcelModal: React.FC<LogParcelModalProps> = ({
  isOpen,
  onClose,
  onParcelLogged,
}) => {
  const [courier, setCourier] = useState<string>('Amazon');
  const [customCourier, setCustomCourier] = useState<string>('');
  const [selectedFlatId, setSelectedFlatId] = useState<string>('');
  const [flatSearch, setFlatSearch] = useState<string>('');
  const [flats, setFlats] = useState<any[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load flats on modal open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      api.flats.getFlats()
        .then((res) => {
          setFlats(res.data);
          if (res.data.length > 0 && !selectedFlatId) {
            setSelectedFlatId(res.data[0].id);
          }
        })
        .catch((err) => setError(err.message));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter flats by search query
  const filteredFlats = flats.filter((f) => {
    const q = flatSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      f.number.toLowerCase().includes(q) ||
      f.tower.toLowerCase().includes(q) ||
      f.label.toLowerCase().includes(q)
    );
  });

  const selectedFlat = flats.find((f) => f.id === selectedFlatId);

  // Attach a mock package photo for demo testing
  const handleAttachMockPhoto = () => {
    const courierName = courier === 'Other' ? (customCourier || 'Package') : courier;
    const flatText = selectedFlat ? selectedFlat.label : 'Gate Parcel';
    const mockPhoto = `https://placehold.co/600x400/0B5D5B/ffffff?text=${encodeURIComponent(courierName)}+for+${encodeURIComponent(flatText)}`;
    setPhotoUrl(mockPhoto);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalCourier = courier === 'Other' ? customCourier.trim() : courier;
    if (!finalCourier) {
      setError('Please specify the courier company.');
      return;
    }

    if (!selectedFlatId) {
      setError('Please choose a valid flat destination.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.parcels.logParcel({
        flatId: selectedFlatId,
        courier: finalCourier,
        photoUrl: photoUrl || undefined,
      });

      onParcelLogged(res.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to log parcel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface dark:bg-slate-900 border border-line dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header: Deep Teal */}
        <div className="bg-primary px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight">Log Incoming Parcel</h2>
            <p className="text-xs text-sand/80">Notify the resident and store in the parcel room</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sand hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-brick-light border border-brick/40 rounded-xl flex items-start space-x-2 text-brick text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Flat Destination Picker */}
          <div>
            <label className="block text-sm font-bold text-night dark:text-slate-200 mb-2">
              1. Destination Flat
            </label>

            {/* Quick search input */}
            <input
              type="text"
              placeholder="Search flat (e.g. 1204 or Tower A)..."
              value={flatSearch}
              onChange={(e) => setFlatSearch(e.target.value)}
              className="w-full px-4 py-2.5 mb-2.5 text-base border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Flat Quick-Pills for high-speed tablet tapping */}
            <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1.5 bg-mist dark:bg-slate-800/50 rounded-xl border border-line dark:border-slate-700">
              {filteredFlats.map((flat) => {
                const isSelected = selectedFlatId === flat.id;
                return (
                  <button
                    key={flat.id}
                    type="button"
                    onClick={() => setSelectedFlatId(flat.id)}
                    className={`btn-touch px-3 py-2 rounded-xl text-sm font-bold border transition ${
                      isSelected
                        ? 'bg-sand text-night border-sand-dark shadow-sm'
                        : 'bg-surface dark:bg-slate-800 text-sage hover:text-night border-line dark:border-slate-700 hover:border-sand-dark'
                    }`}
                  >
                    {flat.tower}-{flat.number}
                  </button>
                );
              })}
              {filteredFlats.length === 0 && (
                <div className="col-span-3 text-center py-4 text-xs text-sage">
                  No flat matching "{flatSearch}"
                </div>
              )}
            </div>

            {selectedFlat && (
              <div className="mt-2 text-xs text-leaf font-bold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>Selected: Tower {selectedFlat.tower} - Flat {selectedFlat.number}</span>
              </div>
            )}
          </div>

          {/* 2. Courier Selection */}
          <div>
            <label className="block text-sm font-bold text-night dark:text-slate-200 mb-2">
              2. Courier Company
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {COMMON_COURIERS.map((c) => {
                const isSelected = courier === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourier(c)}
                    className={`btn-touch px-2 py-2 text-xs sm:text-sm font-bold rounded-xl border text-center transition ${
                      isSelected
                        ? 'bg-sand text-night border-sand-dark shadow-sm'
                        : 'bg-surface dark:bg-slate-800 text-sage hover:text-night border-line dark:border-slate-700 hover:border-sand-dark'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            {courier === 'Other' && (
              <input
                type="text"
                placeholder="Enter courier name..."
                value={customCourier}
                onChange={(e) => setCustomCourier(e.target.value)}
                className="mt-2.5 w-full px-4 py-2.5 text-sm border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            )}
          </div>

          {/* 3. Parcel Photo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-night dark:text-slate-200">
                3. Parcel Photo (Proof of Delivery)
              </label>
              <button
                type="button"
                onClick={handleAttachMockPhoto}
                className="text-xs font-bold text-coral hover:underline"
              >
                + Snapshot
              </button>
            </div>

            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-line dark:border-slate-700 h-28 bg-mist dark:bg-slate-800 flex items-center justify-center">
                <img src={photoUrl} alt="Parcel preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-2 right-2 bg-night/80 text-white p-1 rounded-full hover:bg-night"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAttachMockPhoto}
                className="w-full py-4 border-2 border-dashed border-line dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-sage hover:border-coral hover:text-coral transition"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-xs font-semibold">Tap to capture or attach photo</span>
              </button>
            )}
          </div>

          {/* Action Button: Coral */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-touch w-full bg-coral hover:bg-coral-hover text-white font-heading font-extrabold text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging parcel...</span>
                </>
              ) : (
                <span>Log parcel and notify resident</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
