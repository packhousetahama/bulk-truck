import React, { useState } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { DEFAULT_OPERATORS } from '../utils/constants';
import { User, Shield, Check, X, User as UserIcon } from 'lucide-react';

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkUserModal: React.FC<BulkUserModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, language, showToast } = useBulkApp();
  const [customName, setCustomName] = useState('');

  if (!isOpen) return null;

  const handleSelect = (user: typeof DEFAULT_OPERATORS[0]) => {
    setCurrentUser(user);
    showToast(`Signed in as ${user.name} (${user.role})`, 'info');
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const name = customName.trim();
    const isAdmin = name.toLowerCase().includes('admin');
    setCurrentUser({
      name,
      role: isAdmin ? 'admin' : 'user'
    });
    showToast(`Signed in as ${name}`, 'info');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                {language === 'ar' ? 'اختيار المشغل أو المسؤول' : 'Switch Operator / Role'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'حدد اسمك لتسجيل عمليات التحميل' : 'Select your profile for load tracking'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of preset operators */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
            {DEFAULT_OPERATORS.map(op => {
              const isSelected = currentUser.name.toLowerCase() === op.name.toLowerCase();
              return (
                <button
                  key={op.name}
                  type="button"
                  onClick={() => handleSelect(op)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${op.role === 'admin' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                    <span>{op.name}</span>
                    {op.role === 'admin' && (
                      <span className="text-[10px] bg-purple-950 text-purple-400 px-1.5 py-0.2 rounded border border-purple-800">
                        Admin
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Name */}
          <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">
              {language === 'ar' ? 'أو اكتب اسماً آخر:' : 'Or type a custom name:'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Operator name..."
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={!customName.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition"
              >
                Set
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
