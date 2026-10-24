import React, { useState, useEffect } from 'react';
import { useBulkApp } from '../context/BulkAppContext';
import { getUsers, adminSaveUser, adminDeleteUser } from '../services/api';
import { User } from '../types';
import {
  Lock,
  User as UserIcon,
  Shield,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Key
} from 'lucide-react';

interface BulkUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkUserModal: React.FC<BulkUserModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, login, logout, language, showToast } = useBulkApp();

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
      setActiveTab('auth');
    }
  }, [isOpen, currentUser]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header (Matches Truck-Entry) */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider m-0">
                {language === 'ar' ? 'تسجيل دخول المشغلين' : 'USER AUTHENTICATION'}
              </h3>
              <p className="text-[10px] text-slate-400 m-0">
                {language === 'ar' ? 'المشغلين المعتمدين ومدراء المحطة' : 'Authorized Operators & Administrators'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch for Admin if logged in */}
        {currentUser?.role === 'admin' && (
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('auth')}
              className={`flex-1 py-1.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'auth'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserIcon className="w-3 h-3" />
              <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-1.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-purple-300'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>{language === 'ar' ? 'إدارة المستخدمين' : 'Manage Users'}</span>
            </button>
          </div>
        )}

        {activeTab === 'auth' ? (
          <>
            {/* Current status (Matches Truck-Entry) */}
            {currentUser && (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {language === 'ar' ? 'الحساب الحالي:' : 'Currently signed in:'}
                  </span>
                  <span className="font-bold text-slate-100">{currentUser.name}</span>
                  <span className="text-amber-400 font-mono block text-[10px] uppercase font-bold">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800 text-red-300 font-semibold text-xs hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form (Matches Truck-Entry) */}
            <form onSubmit={handleSubmit} className="space-y-3 text-xs" autoComplete="off">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {language === 'ar' ? 'اسم المستخدم / المعرف' : 'User ID / Username'}
                </label>
                <input
                  type="text"
                  name="user_id"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="Enter User ID"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  {language === 'ar' ? 'رمز المرور / كلمة السر' : 'Security PIN / Password'}
                </label>
                <input
                  type="password"
                  name="security_pin"
                  autoComplete="new-password"
                  placeholder="Enter PIN or Password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                {loading
                  ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...')
                  : (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
              </button>
            </form>
          </>
        ) : (
          /* Admin Management Tab */
          <div className="space-y-4 text-xs">
            <form onSubmit={handleCreateUser} className="space-y-2.5 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
              <span className="font-bold text-slate-200 block text-[11px] uppercase tracking-wider">
                Create New Operator / Admin
              </span>
              <input
                type="text"
                placeholder="Full Display Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="User ID (login)"
                  value={newId}
                  onChange={e => setNewId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 font-mono text-xs"
                />
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 text-xs"
                >
                  <option value="user">Operator (User)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <input
                type="password"
                placeholder="Initial PIN (e.g. 1234)"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </form>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 block px-1">
                Active System Users ({allUsers.length})
              </span>
              {allUsers.map(u => (
                <div
                  key={u.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-2 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200 text-xs">{u.name}</span>
                      <span className={`text-[9px] font-mono px-1 rounded uppercase ${
                        u.role === 'admin' ? 'bg-purple-950 text-purple-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 block">ID: {u.id}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {editingUserId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="password"
                          placeholder="New PIN"
                          value={editPin}
                          onChange={e => setEditPin(e.target.value)}
                          className="w-20 bg-slate-900 border border-purple-500 rounded px-1.5 py-0.5 text-xs font-mono text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdatePin(u)}
                          className="p-1 rounded bg-purple-600 text-white hover:bg-purple-500 cursor-pointer text-[10px] font-bold"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingUserId(null)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Reset PIN"
                          onClick={() => {
                            setEditingUserId(u.id || u.name);
                            setEditPin('');
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        {u.id !== 'admin' && (
                          <button
                            type="button"
                            title="Delete user"
                            onClick={() => handleDeleteUser(u.id || u.name, u.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
