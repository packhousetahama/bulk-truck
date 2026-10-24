import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { Lock, User as UserIcon, X, AlertCircle } from 'lucide-react';

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkUserModal: React.FC<BulkUserModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, login, logout, language } = useBulkApp();

  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPin('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId.trim() || !pin.trim()) {
      setError(language === 'ar' ? 'يرجى إدخال اسم المستخدم ورمز المرور.' : 'Please enter User ID and PIN.');
      return;
    }

    setLoading(true);
    const res = await login(userId.trim(), pin.trim());
    setLoading(false);

    if (res.success) {
      setUserId('');
      setPin('');
      onClose();
    } else {
      setError(res.message || (language === 'ar' ? 'اسم المستخدم أو رمز المرور غير صحيح.' : 'Invalid User ID or PIN.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider m-0">
                {language === 'ar' ? 'تسجيل دخول المشغل' : 'USER AUTHENTICATION'}
              </h3>
              <p className="text-[10px] text-slate-400 m-0">
                {language === 'ar' ? 'المشغلين والمشرفين المصرح لهم' : 'Authorized Operators & Supervisors'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status */}
        {currentUser && (
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex items-center justify-between text-xs shadow-inner">
            <div className="space-y-0.5">
              <span className="text-slate-400 block text-[10px]">
                {language === 'ar' ? 'مسجل الدخول حالياً:' : 'Currently signed in:'}
              </span>
              <span className="font-bold text-slate-100 block">{currentUser.name}</span>
              <span className="text-amber-400 font-mono block text-[10px] uppercase font-bold tracking-wider">
                {currentUser.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
              }}
              className="px-3 py-1.5 rounded-xl bg-red-950/70 border border-red-700/60 text-red-300 font-bold text-xs hover:bg-red-900/80 hover:text-white transition cursor-pointer shadow-sm active:scale-95"
            >
              {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs" autoComplete="off">
          <div>
            <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ar' ? 'اسم المستخدم / رقم المشغل' : 'User ID / Username'}</span>
            </label>
            <input
              type="text"
              name="user_id"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              placeholder={language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter User ID (e.g. ali_garni)'}
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ar' ? 'رمز المرور الأمني' : 'Security PIN / Password'}</span>
            </label>
            <input
              type="password"
              name="security_pin"
              autoComplete="new-password"
              placeholder={language === 'ar' ? 'أدخل رمز المرور' : 'Enter PIN or Password'}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
          >
            {loading
              ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')
              : (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
};
