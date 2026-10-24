import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { DEFAULT_OPERATORS } from '../utils/constants';
import { getUsers, adminSaveUser, adminDeleteUser } from '../services/api';
import { User } from '../types';
import {
  Lock,
  User as UserIcon,
  Shield,
  X,
  Check,
  AlertCircle,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  LogOut
} from 'lucide-react';

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkUserModal: React.FC<BulkUserModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, login, logout, language, showToast } = useBulkApp();
  
  // Auth state
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'auth' | 'admin'>('auth');

  // Admin Management State
  const [allUsers, setAllUsers] = useState<User[]>(() => getUsers());
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newPin, setNewPin] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPin, setEditPin] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPin('');
      setAllUsers(getUsers());
      if (currentUser?.role === 'admin') {
        setActiveTab('auth');
      } else {
        setActiveTab('auth');
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  const handleSelectQuickOperator = (opId: string) => {
    setUserId(opId);
    setError(null);
    // Focus the PIN input
    const pinInput = document.getElementById('bulk-auth-pin-input');
    if (pinInput) pinInput.focus();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'admin') {
      showToast('Only administrators can create users.', 'error');
      return;
    }
    if (!newName.trim() || !newPin.trim()) {
      showToast('Name and PIN are compulsory.', 'error');
      return;
    }
    const cleanId = (newId.trim() || newName.trim().toLowerCase().replace(/\s+/g, '_'));
    setLoading(true);
    try {
      await adminSaveUser(currentUser, cleanId, newName.trim(), newRole, newPin.trim());
      setAllUsers(getUsers());
      setNewName('');
      setNewId('');
      setNewPin('');
      showToast(`User ${newName} created successfully.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async (targetUser: User) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (!editPin.trim() || editPin.trim().length < 4) {
      showToast('PIN must be at least 4 digits.', 'error');
      return;
    }
    setLoading(true);
    try {
      await adminSaveUser(currentUser, targetUser.id || targetUser.name.toLowerCase(), targetUser.name, targetUser.role, editPin.trim());
      setAllUsers(getUsers());
      setEditingUserId(null);
      setEditPin('');
      showToast(`PIN updated for ${targetUser.name}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update PIN', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (targetId: string, targetName: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    if (targetId === 'admin') {
      showToast('Cannot delete primary administrator account.', 'error');
      return;
    }
    if (confirm(`Are you sure you want to remove user "${targetName}"?`)) {
      setLoading(true);
      try {
        await adminDeleteUser(currentUser, targetId);
        setAllUsers(getUsers());
        showToast(`User ${targetName} removed.`, 'info');
      } catch (err: any) {
        showToast(err.message || 'Failed to delete user', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider m-0">
                {language === 'ar' ? 'تسجيل دخول المشغلين' : 'USER AUTHENTICATION'}
              </h2>
              <p className="text-[11px] text-slate-400 m-0">
                {language === 'ar' ? 'المشغلين المعتمدين ومدراء المحطة' : 'Authorized Operators & Administrators'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher if Admin */}
        {currentUser?.role === 'admin' && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'auth'
                  ? 'text-amber-400 border-b-2 border-amber-500 bg-slate-900/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'حسابي والتبديل' : 'Account & Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2.5 text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'text-purple-400 border-b-2 border-purple-500 bg-slate-900/60'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>{language === 'ar' ? 'إدارة المشغلين (Admin)' : 'Admin User Control'}</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {activeTab === 'auth' && (
            <>
              {/* Signed In Profile Banner */}
              {currentUser && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                      {language === 'ar' ? 'الحساب الحالي:' : 'Currently signed in:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{currentUser.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase font-bold ${
                        currentUser.role === 'admin'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {currentUser.role}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setError(null);
                      setPin('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-red-300 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-2xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Operator Quick Selector Pills (Helpful for tablet/mobile without typing errors) */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-2">
                  {language === 'ar' ? 'اختر المشغل لتعبئة الحساب تلقائياً:' : 'Select Authorized Plant Operator:'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {DEFAULT_OPERATORS.map(op => {
                    const isSelected = userId.toLowerCase() === op.id.toLowerCase() || userId.toLowerCase() === op.name.toLowerCase();
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => handleSelectQuickOperator(op.id)}
                        className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${op.role === 'admin' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                          <span className="truncate">{op.name}</span>
                        </div>
                        {op.role === 'admin' && (
                          <span className="text-[9px] font-mono bg-purple-950 text-purple-300 px-1 py-0.2 rounded border border-purple-800/60 ml-1">
                            Admin
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1" autoComplete="off">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    {language === 'ar' ? 'اسم المستخدم / المعرف' : 'User ID / Username'}
                  </label>
                  <input
                    type="text"
                    name="username"
                    placeholder="e.g. ali_garni or admin"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    required
                    autoComplete="off"
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    {language === 'ar' ? 'رمز المرور / PIN' : 'Security PIN / Password'}
                  </label>
                  <input
                    id="bulk-auth-pin-input"
                    type="password"
                    name="password"
                    placeholder="Enter PIN (e.g. 1234 or Admin Password)"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>{language === 'ar' ? 'جارٍ التحقق...' : 'Verifying Credentials...'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-950" />
                      <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ADMIN MANAGEMENT TAB */}
          {activeTab === 'admin' && currentUser?.role === 'admin' && (
            <div className="space-y-4">
              {/* Create User Form */}
              <form onSubmit={handleCreateUser} className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Add New Authorized Operator / Admin</span>
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Mohammed Salem"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">User ID</label>
                    <input
                      type="text"
                      placeholder="e.g. mohammed_salem"
                      value={newId}
                      onChange={e => setNewId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Role</label>
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="user">Operator (Standard)</option>
                      <option value="admin">Administrator (Full Control)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Login PIN (4+ digits)</label>
                    <input
                      type="password"
                      placeholder="e.g. 1234"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
                >
                  Save User & Sync to Backend
                </button>
              </form>

              {/* Registered Users List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                  Existing Accounts ({allUsers.length})
                </span>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {allUsers.map(u => {
                    const isEditing = editingUserId === (u.id || u.name);
                    return (
                      <div
                        key={u.id || u.name}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${u.role === 'admin' ? 'bg-purple-400' : 'bg-emerald-400'}`} />
                            <span className="font-bold text-slate-200">{u.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">({u.id})</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase ${
                              u.role === 'admin' ? 'bg-purple-950 text-purple-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {u.role}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserId(isEditing ? null : (u.id || u.name));
                                setEditPin('');
                              }}
                              className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded cursor-pointer"
                              title="Reset PIN"
                            >
                              <Key className="w-3 h-3 inline mr-1 text-amber-400" />
                              Reset PIN
                            </button>

                            {u.id !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id || u.name, u.name)}
                                className="text-[10px] bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 p-1 rounded cursor-pointer"
                                title="Delete user"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Reset PIN Box */}
                        {isEditing && (
                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800">
                            <input
                              type="password"
                              placeholder="New 4+ digit PIN"
                              value={editPin}
                              onChange={e => setEditPin(e.target.value)}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdatePin(u)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Update PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
