import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Check, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { assetUrl } from '../../config';
import { COMMON_COURIERS } from '@parcelo/shared';

/** Downscale a photo to at most 1600px on its long side and re-encode as JPEG (~200-500 KB) */
async function toUploadableJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.8);
}

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
  // photoUrl: the stored path sent with the parcel; photoPreview: a signed link to show it now
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Camera on phones and tablets, file picker on desktops
  const handlePickPhoto = () => fileInputRef.current?.click();

  const handlePhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const dataUrl = await toUploadableJpeg(file);
      const res = await api.parcels.uploadPhoto(dataUrl);
      setPhotoUrl(res.photoUrl);
      setPhotoPreview(res.previewUrl);
    } catch (err: any) {
      setError(err.message || 'Could not upload the photo. Try again.');
    } finally {
      setIsUploading(false);
    }
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
                onClick={handlePickPhoto}
                disabled={isUploading}
                className="text-xs font-bold text-coral hover:underline disabled:opacity-50"
              >
                {photoUrl ? 'Retake' : '+ Photo'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handlePhotoChosen}
              className="hidden"
            />

            {isUploading ? (
              <div className="w-full py-4 border-2 border-dashed border-line dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-sage">
                <Loader2 className="w-6 h-6 mb-1 animate-spin" />
                <span className="text-xs font-semibold">Uploading photo...</span>
              </div>
            ) : photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-line dark:border-slate-700 h-28 bg-mist dark:bg-slate-800 flex items-center justify-center">
                <img src={assetUrl(photoPreview)} alt="Parcel preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setPhotoUrl(null); setPhotoPreview(null); }}
                  className="absolute top-2 right-2 bg-night/80 text-white p-1 rounded-full hover:bg-night"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePickPhoto}
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
              disabled={isSubmitting || isUploading}
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
