import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { DEFAULT_OPERATORS, BULK_BACKEND_URL } from '../utils/constants';
import { User, Shield, Check, X, User as UserIcon, Plus, Key, Trash2, Lock, UserCheck, ShieldAlert } from 'lucide-react';

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ManagedUser {
  id: string;
  name: string;
  role: 'admin' | 'user';
  pin?: string;
}

export const BulkUserModal: React.FC<BulkUserModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, language, showToast } = useBulkApp();
  const [activeView, setActiveView] = useState<'select' | 'manage'>('select');

  // Operators list initialized with the confirmed 6 operators + Admin
  const [operatorsList, setOperatorsList] = useState<ManagedUser[]>(() => {
    try {
      const saved = localStorage.getItem('spcc_bulk_operators_cache');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_OPERATORS.map(o => ({
      id: o.id || o.name.toLowerCase().replace(/\s+/g, '_'),
      name: o.name,
      role: o.role
    }));
  });

  // Admin PIN prompt if trying to open management
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(currentUser.role === 'admin');

  // New user form state
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPin, setNewPin] = useState('');

  // Password reset state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPin, setEditPin] = useState('');

  // Save operators list to local storage
  const saveOperators = (list: ManagedUser[]) => {
    setOperatorsList(list);
    localStorage.setItem('spcc_bulk_operators_cache', JSON.stringify(list));
  };

  useEffect(() => {
    if (currentUser.role === 'admin') {
      setIsAdminAuthenticated(true);
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleSelect = (user: ManagedUser) => {
    setCurrentUser({
      name: user.name,
      role: user.role
    });
    showToast(`Signed in as ${user.name} (${user.role})`, 'info');
    onClose();
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === 'Jaw@red') {
      setIsAdminAuthenticated(true);
      setActiveView('manage');
      showToast('Admin mode unlocked', 'success');
    } else {
      showToast('Incorrect Admin Master PIN', 'error');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPin.trim()) {
      showToast('Name and PIN are required.', 'error');
      return;
    }

    const cleanId = (newId.trim() || newName.trim().toLowerCase().replace(/\s+/g, '_'));
    const exists = operatorsList.some(u => u.id === cleanId);
    if (exists) {
      showToast('An operator with this ID already exists.', 'error');
      return;
    }

    const newUser: ManagedUser = {
      id: cleanId,
      name: newName.trim(),
      role: newRole,
      pin: newPin.trim()
    };

    const updated = [...operatorsList, newUser];
    saveOperators(updated);

    setNewName('');
    setNewId('');
    setNewPin('');
    showToast(`Operator "${newUser.name}" added successfully!`, 'success');
  };

  const handleUpdatePin = (userId: string) => {
    if (!editPin.trim() || editPin.trim().length < 4) {
      showToast('PIN must be at least 4 digits.', 'error');
      return;
    }

    const updated = operatorsList.map(u => {
      if (u.id === userId) {
        return { ...u, pin: editPin.trim() };
      }
      return u;
    });

    saveOperators(updated);
    setEditingUserId(null);
    setEditPin('');
    showToast('PIN updated successfully!', 'success');
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === 'admin') {
      showToast('Cannot delete primary Admin account.', 'error');
      return;
    }

    if (confirm('Are you sure you want to delete this operator?')) {
      const updated = operatorsList.filter(u => u.id !== userId);
      saveOperators(updated);
      showToast('Operator removed.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                {activeView === 'select'
                  ? language === 'ar' ? 'اختيار المشغل' : 'Switch Operator'
                  : language === 'ar' ? 'إدارة المشغلين وكلمات المرور' : 'Operator & Password Admin'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'شركة أسمنت المنطقة الجنوبية — محطة تهامة' : 'SPCC Tahama Bulk Operations'}
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

        {/* View Toggle Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveView('select')}
            className={`flex-1 py-2.5 text-center transition ${
              activeView === 'select'
                ? 'text-amber-400 border-b-2 border-amber-500 bg-slate-900/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'ar' ? 'المشغلين' : 'Select Operator'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isAdminAuthenticated) {
                setActiveView('manage');
              } else {
                setActiveView('manage');
              }
            }}
            className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1.5 ${
              activeView === 'manage'
                ? 'text-purple-400 border-b-2 border-purple-500 bg-slate-900/60'
                : 'text-slate-400 hover:text-purple-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>{language === 'ar' ? 'إدارة الحسابات (Admin)' : 'Admin User Control'}</span>
          </button>
        </div>

        {/* VIEW 1: SELECT OPERATOR */}
        {activeView === 'select' && (
          <div className="p-4 space-y-3 overflow-y-auto">
            <span className="text-[11px] font-bold text-slate-400 block">
              {language === 'ar' ? 'المشغلين المعتمدين في المحطة:' : 'Authorised Plant Operators:'}
            </span>

            <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {operatorsList.map(op => {
                const isSelected = currentUser.name.toLowerCase() === op.name.toLowerCase();
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => handleSelect(op)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${op.role === 'admin' ? 'bg-purple-400 shadow-sm shadow-purple-400/50' : 'bg-emerald-400'}`} />
                      <span className="text-sm font-semibold">{op.name}</span>
                      {op.role === 'admin' && (
                        <span className="text-[10px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800">
                          Admin
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: ADMIN MANAGEMENT */}
        {activeView === 'manage' && (
          <div className="p-4 space-y-4 overflow-y-auto">
            {!isAdminAuthenticated ? (
              <form onSubmit={handleAdminAuth} className="space-y-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
                <Lock className="w-8 h-8 text-purple-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-200">
                  {language === 'ar' ? 'مطلوب إذن المسؤول' : 'Admin Password Required'}
                </h3>
                <p className="text-xs text-slate-400">
                  Enter master PIN to manage operators and passwords
                </p>
                <input
                  type="password"
                  placeholder="Master PIN..."
                  value={adminPinInput}
                  onChange={e => setAdminPinInput(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm text-slate-100 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition"
                >
                  Unlock Admin Control
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Add New Operator Accordion / Form */}
                <form onSubmit={handleCreateUser} className="bg-slate-950/80 p-3.5 rounded-2xl border border-purple-500/30 space-y-2.5 text-xs">
                  <span className="font-bold text-purple-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-purple-400" />
                    <span>{language === 'ar' ? 'إضافة مشغل جديد' : 'Create New Operator'}</span>
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Operator Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Salim Ali"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Login PIN (4+ digits)</label>
                      <input
                        type="text"
                        placeholder="e.g. 1234"
                        value={newPin}
                        onChange={e => setNewPin(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="user">Role: Operator</option>
                      <option value="admin">Role: Admin</option>
                    </select>

                    <button
                      type="submit"
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition"
                    >
                      Add Operator
                    </button>
                  </div>
                </form>

                {/* Operators Table / List */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block">
                    Existing Operators ({operatorsList.length}):
                  </span>

                  <div className="divide-y divide-slate-800/80 bg-slate-950/40 rounded-2xl border border-slate-800 overflow-hidden text-xs">
                    {operatorsList.map(op => (
                      <div key={op.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <span>{op.name}</span>
                            {op.role === 'admin' && (
                              <span className="text-[9px] bg-purple-950 text-purple-400 px-1 py-0.2 rounded border border-purple-800">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">id: {op.id}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {editingUserId === op.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="New PIN"
                                value={editPin}
                                onChange={e => setEditPin(e.target.value)}
                                className="w-16 bg-slate-900 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-slate-100 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdatePin(op.id)}
                                className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUserId(null)}
                                className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(op.id);
                                setEditPin('');
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition"
                              title="Reset Password / PIN"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {op.id !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(op.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition"
                              title="Delete Operator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
