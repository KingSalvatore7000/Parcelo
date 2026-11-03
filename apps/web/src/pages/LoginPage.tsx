import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Shield, Home, ArrowRight, Loader2, AlertCircle, Phone, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const LoginPage: React.FC = () => {
  const { loginWithOtp, quickLogin } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState<string>('+919876543210');
  const [otp, setOtp] = useState<string>('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.auth.requestOtp(phone);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
      setStep('OTP');
    } catch (err: any) {
      setError(err.message || 'Failed to request verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await loginWithOtp(phone, otp);
      if (user.role === 'GUARD') {
        navigate('/guard');
      } else if (user.role === 'RESIDENT') {
        navigate('/resident');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoPhone: string, targetPath: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await quickLogin(demoPhone);
      navigate(targetPath);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
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
          Welcome to Thapal
        </h2>
        <p className="mt-1 text-sm text-sage dark:text-slate-400 font-medium">
          Society Parcel Room & Secure Handover Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface dark:bg-slate-900 py-8 px-6 shadow-xl rounded-2xl border border-line dark:border-slate-800 sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 bg-brick-light dark:bg-brick-dark/30 border border-brick/40 rounded-xl flex items-start space-x-2 text-brick text-sm font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'PHONE' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-night dark:text-slate-300 mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-3 top-3 text-sage" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full pl-10 pr-4 py-2.5 text-base border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 placeholder:text-sage focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>
                <p className="text-xs text-sage mt-1 font-medium">Enter your registered 10-digit Indian mobile number</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-touch w-full bg-coral hover:bg-coral-hover text-white font-heading font-extrabold text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-night dark:text-slate-300">
                    Enter Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('PHONE')}
                    className="text-xs text-coral hover:underline font-bold"
                  >
                    Change phone
                  </button>
                </div>

                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-3 top-3 text-sage" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 text-xl font-heading font-black tracking-widest text-center border border-line dark:border-slate-700 rounded-xl bg-mist dark:bg-slate-800 text-night dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {devOtp && (
                  <p className="text-xs text-leaf font-bold mt-1">
                    Demo Mode: OTP auto-filled as [{devOtp}]
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-touch w-full bg-coral hover:bg-coral-hover text-white font-heading font-extrabold text-base tracking-wide rounded-xl shadow-lg transition flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify and Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Logins Section */}
          <div className="pt-4 border-t border-line dark:border-slate-800">
            <div className="text-xs uppercase font-extrabold tracking-wider text-sage mb-2.5 text-center">
              One-Click Demo Profiles
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('+919876543210', '/guard')}
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
                onClick={() => handleQuickDemoLogin('+919876543212', '/resident')}
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
                onClick={() => handleQuickDemoLogin('+919876543211', '/admin')}
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
        </div>
      </div>
    </div>
  );
};
