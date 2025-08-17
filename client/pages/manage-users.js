import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Users, CheckCircle, XCircle, Eye, EyeOff, Lock, Unlock, Key } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false); // State to toggle password form
  const { user } = useAuth();
  const router = useRouter();

  // Fetch user role from Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          console.log('Fetching user role for UID:', user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'user');
            console.log('User role:', userDoc.data().role);
          } else {
            setUserRole('user');
            console.log('No Firestore document found, defaulting to user role');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          toast.error('Failed to load user role');
          setUserRole('user');
        }
      }
      setRoleLoading(false);
    };

    fetchUserRole();
  }, [user]);

  // Fetch all users from Firestore (for admins)
  const fetchUsers = async () => {
    try {
      console.log('Fetching users from Firestore...');
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Fetched users:', usersData);
      setUsers(usersData);
      if (usersData.length === 0) {
        console.log('No users found in Firestore');
        toast.info('No users found in the database.');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
      console.log('Loading state set to false');
    }
  };

  useEffect(() => {
    if (user && userRole === 'admin' && !roleLoading) {
      console.log('User is admin, fetching users...');
      fetchUsers();
    } else {
      console.log('User is not admin or role still loading');
      setLoading(false);
    }
  }, [user, userRole, roleLoading]);

  // Toggle user role (admin only)
  const toggleUserRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      console.log(`Updating user ${userId} role to ${newRole}`);
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error(`Failed to update user role: ${error.message}`);
    }
  };

  // Toggle user disabled status (admin only)
  const toggleUserDisabled = async (userId, currentDisabled) => {
    const newDisabled = !currentDisabled;
    try {
      console.log(`Updating user ${userId} disabled status to ${newDisabled}`);
      await updateDoc(doc(db, 'users', userId), { disabled: newDisabled });
      toast.success(`User ${newDisabled ? 'disabled' : 'enabled'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user disabled status:', error);
      toast.error(`Failed to update user status: ${error.message}`);
    }
  };

  // Toggle password visibility for a user (admin only)
  const togglePasswordVisibility = (userId) => {
    setShowPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Handle password change (for both admin and non-admin)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
  }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      // Update password in Firebase Authentication
      await updatePassword(auth.currentUser, newPassword);
      // Update password in Firestore
      await updateDoc(doc(db, 'users', user.uid), { password: newPassword });
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false); // Hide form after successful update
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(`Failed to update password: ${error.message}`);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Show loading state while fetching role or user is not logged in
  if (!user || roleLoading) {
    return (
      <Layout userId={user?.uid}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Loading...</h2>
            <p className="text-gray-600 mb-6">Fetching user permissions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Non-admin view: Password change form
  if (userRole !== 'admin') {
    return (
      <Layout userId={user.uid}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Change Password
                  </h1>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn-secondary flex items-center space-x-2"
                  data-tooltip-id="back-tooltip"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </div>
          </header>

          <main className="p-8">
            <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="new-password"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="Enter new password"
                      disabled={passwordLoading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                    Confirm Password
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Confirm new password"
                      disabled={passwordLoading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className={`btn-primary flex items-center justify-center space-x-2 w-full ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  data-tooltip-id="change-password-tooltip"
                >
                  <Key className="h-4 w-4" />
                  <span>{passwordLoading ? 'Updating...' : 'Change Password'}</span>
                </button>
              </form>
            </div>
          </main>

          <Tooltip
            id="back-tooltip"
            place="top"
            effect="solid"
            style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
          >
            Return to Dashboard
          </Tooltip>
          <Tooltip
            id="change-password-tooltip"
            place="top"
            effect="solid"
            style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
          >
            Update Password
          </Tooltip>
        </div>
      </Layout>
    );
  }

  // Admin view: Button-triggered password change form and user management table
  return (
    <Layout userId={user.uid}>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Users
                </h1>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn-secondary flex items-center space-x-2"
                data-tooltip-id="back-tooltip"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="max-w-4xl mx-auto">
            {/* Password Change Section for Admins */}
            <div className="mb-8 bg-white p-6 rounded-lg shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Change Your Password</h2>
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="btn-primary flex items-center space-x-2"
                  data-tooltip-id="toggle-password-form-tooltip"
                >
                  <Key className="h-4 w-4" />
                  <span>{showPasswordForm ? 'Hide Password Form' : 'Change Password'}</span>
                </button>
              </div>
              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div>
                    <label htmlFor="new-password-admin" className="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="new-password-admin"
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field"
                        placeholder="Enter new password"
                        disabled={passwordLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password-admin" className="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="confirm-password-admin"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field"
                        placeholder="Confirm new password"
                        disabled={passwordLoading}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className={`btn-primary flex items-center justify-center space-x-2 w-full ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-tooltip-id="change-password-tooltip"
                    >
                      <Key className="h-4 w-4" />
                      <span>{passwordLoading ? 'Updating...' : 'Change Password'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="btn-outline flex items-center justify-center space-x-2 w-full"
                      data-tooltip-id="cancel-password-tooltip"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* User Management Table */}
            {loading ? (
              <div className="grid grid-cols-1 gap-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="card loading">
                    <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a new user to get started.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/create-user')}
                    className="btn-primary flex items-center space-x-2 mx-auto"
                    data-tooltip-id="create-user-tooltip"
                  >
                    <Users className="h-4 w-4" />
                    <span>Create User</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Password</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-block px-2 py-1 rounded ${u.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <span>{showPasswords[u.id] ? u.password || 'N/A' : '••••••••'}</span>
                            <button
                              onClick={() => togglePasswordVisibility(u.id)}
                              className="text-gray-500 hover:text-gray-700"
                              data-tooltip-id={`password-toggle-tooltip-${u.id}`}
                            >
                              {showPasswords[u.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Tooltip
                            id={`password-toggle-tooltip-${u.id}`}
                            place="top"
                            effect="solid"
                            style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
                          >
                            {showPasswords[u.id] ? 'Hide Password' : 'Show Password'}
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-block px-2 py-1 rounded ${u.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {u.disabled ? 'Disabled' : 'Enabled'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col space-y-2">
                            <button
                              onClick={() => toggleUserRole(u.id, u.role)}
                              className={`flex items-center space-x-2 ${u.role === 'admin' ? 'btn-outline text-red-600' : 'btn-primary'}`}
                              data-tooltip-id={u.role === 'admin' ? 'remove-admin-tooltip' : 'make-admin-tooltip'}
                              disabled={u.id === user.uid}
                            >
                              {u.role === 'admin' ? (
                                <>
                                  <XCircle className="h-4 w-4" />
                                  <span>Remove Admin</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Make Admin</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => toggleUserDisabled(u.id, u.disabled)}
                              className={`flex items-center space-x-2 ${u.disabled ? 'btn-primary' : 'btn-outline text-red-600'}`}
                              data-tooltip-id={u.disabled ? 'enable-user-tooltip' : 'disable-user-tooltip'}
                              disabled={u.id === user.uid}
                            >
                              {u.disabled ? (
                                <>
                                  <Unlock className="h-4 w-4" />
                                  <span>Enable User</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4" />
                                  <span>Disable User</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        <Tooltip
          id="back-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Return to Dashboard
        </Tooltip>
        <Tooltip
          id="create-user-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Create New User
        </Tooltip>
        <Tooltip
          id="make-admin-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Grant Admin Privileges
        </Tooltip>
        <Tooltip
          id="remove-admin-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Remove Admin Privileges
        </Tooltip>
        <Tooltip
          id="disable-user-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Disable User Account
        </Tooltip>
        <Tooltip
          id="enable-user-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Enable User Account
        </Tooltip>
        <Tooltip
          id="change-password-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Update Password
        </Tooltip>
        <Tooltip
          id="toggle-password-form-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          {showPasswordForm ? 'Hide Password Form' : 'Show Password Form'}
        </Tooltip>
        <Tooltip
          id="cancel-password-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Cancel Password Change
        </Tooltip>
      </div>
    </Layout>
  );
}