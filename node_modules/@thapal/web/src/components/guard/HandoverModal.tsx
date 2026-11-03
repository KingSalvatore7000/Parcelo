import React, { useState } from 'react';
import { X, CheckCircle2, AlertOctagon, Delete, RotateCcw, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface HandoverModalProps {
  isOpen: boolean;
  parcel: any | null;
  onClose: () => void;
  onSuccess: (updatedParcel: any) => void;
}

export const HandoverModal: React.FC<HandoverModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<any | null>(null);

  if (!isOpen || !parcel) return null;

  const handleDigitPress = (digit: string) => {
    if (code.length < 4) {
      setCode((prev) => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setCode((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setCode('');
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (code.length !== 4) {
      setError('Please enter the complete 4-digit handover code.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await api.parcels.completeHandover(parcel.id, code);
      setSuccessRecord(res.data);
      onSuccess(res.data);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface dark:bg-slate-900 border border-line dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header: Deep Teal */}
        <div className="bg-primary px-6 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-tight">Verify Handover Code</h2>
            <p className="text-xs text-sand/80">Enter the 4-digit code shown on the resident's screen</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sand hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Parcel summary card */}
          <div className="bg-mist dark:bg-slate-800/60 p-4 rounded-xl border border-line dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-coral">
                {parcel.courier}
              </span>
              <div className="text-xl font-heading font-extrabold text-night dark:text-white">
                Tower {parcel.flat.tower} - {parcel.flat.number}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-sand text-night border border-sand-dark">
                {parcel.handover?.mode === 'DOOR' ? '🚪 Door Delivery' : '📦 Counter Pickup'}
              </span>
              <div className="text-[11px] text-sage dark:text-slate-400 mt-1 font-medium">
                {parcel.handover?.slotStart
                  ? `Slot: ${new Date(parcel.handover.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Slot confirmed'}
              </div>
            </div>
          </div>

          {/* Success State */}
          {successRecord ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-leaf-light text-leaf mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold text-night dark:text-white">
                  Handover Completed!
                </h3>
                <p className="text-xs text-sage mt-1 font-medium">
                  Recorded at {new Date(successRecord.handover.completedAt).toLocaleTimeString('en-IN')} by Guard {successRecord.handover.completedBy?.name || 'Gate Guard'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="btn-touch w-full bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow transition"
              >
                Close & Return to Queue
              </button>
            </div>
          ) : (
            <>
              {/* Error Alert Box: Brick */}
              {error && (
                <div className="p-3.5 bg-brick-light border-2 border-brick rounded-xl flex items-start space-x-2.5 text-brick text-sm font-semibold animate-shake">
                  <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5 text-brick" />
                  <div className="flex-1">
                    <p className="font-bold">Handover Failed</p>
                    <p className="text-xs mt-0.5 text-brick-dark font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* 4-Digit Display Boxes */}
              <div className="flex justify-center items-center space-x-3 py-2">
                {[0, 1, 2, 3].map((idx) => {
                  const digit = code[idx] || '';
                  const isCurrent = code.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-14 h-16 rounded-xl border-2 flex items-center justify-center text-3xl font-heading font-black transition ${
                        digit
                          ? 'border-primary bg-sand/30 text-primary shadow-sm'
                          : isCurrent
                          ? 'border-coral bg-surface ring-4 ring-coral/20 animate-pulse'
                          : 'border-line bg-mist text-sage'
                      }`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>

              {/* Big Touch Keypad for Gate PC and tablet */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigitPress(num)}
                    className="btn-touch bg-mist hover:bg-sand/40 active:bg-sand text-night text-2xl font-heading font-extrabold rounded-xl border border-line shadow-sm transition"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn-touch bg-mist hover:bg-sand/30 text-sage hover:text-night text-xs font-bold rounded-xl border border-line transition flex flex-col items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4 mb-0.5" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDigitPress('0')}
                  className="btn-touch bg-mist hover:bg-sand/40 active:bg-sand text-night text-2xl font-heading font-extrabold rounded-xl border border-line shadow-sm transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="btn-touch bg-mist hover:bg-sand/30 text-sage hover:text-night rounded-xl border border-line transition flex items-center justify-center"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              {/* Action Button: Coral */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={code.length !== 4 || isSubmitting}
                  className="btn-touch w-full bg-coral hover:bg-coral-hover text-white font-heading font-extrabold text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying code...</span>
                    </>
                  ) : (
                    <span>Hand over</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
