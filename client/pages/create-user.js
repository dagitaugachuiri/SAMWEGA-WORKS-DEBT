import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { toast } from 'react-hot-toast';
import { UserPlus, ArrowLeft, CheckCircle, Copy, X } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';

export default function CreateUser() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const { user } = useAuth();
  const router = useRouter();
  const [creatorName, setCreatorName] = useState('Unknown');

  // Fetch user role and creator name from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          console.log('Fetching user data for UID:', user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'user');
            setCreatorName(userDoc.data().name || 'Unknown');
            console.log('User role:', userDoc.data().role, 'Name:', userDoc.data().name);
          } else {
            setUserRole('user');
            setCreatorName('Unknown');
            console.log('No Firestore document found, defaulting to user role and unknown name');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          toast.error('Failed to load user data');
          setUserRole('user');
          setCreatorName('Unknown');
        }
      }
      setRoleLoading(false);
    };

    fetchUserData();
  }, [user]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      setShowPasswordPrompt(true);
      return;
    }

    setLoading(true);

    try {
      // Store admin's email for re-authentication
      const adminEmail = user.email;

      // Sign out the current user
      await signOut(auth);

      // Create new user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Store user data in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        email,
        name: name || '',
        role,
        phoneNumber: phoneNumber || '',
        disabled: false,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        createdByName: creatorName
      });

      // Sign the admin back in
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      // Show credentials in modal
      setCredentials({ email, password });
      setShowCredentialsModal(true);
      setShowPasswordPrompt(false);
      setAdminPassword('');
      toast.success('User created successfully!');
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
      // Attempt to sign the admin back in if creation fails
      if (user?.email) {
        try {
          await signInWithEmailAndPassword(auth, user.email, adminPassword);
        } catch (signInError) {
          console.error('Error signing admin back in:', signInError);
          toast.error('Failed to restore admin session. Please sign in again.');
          router.push('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `Email: ${credentials.email}\nPassword: ${credentials.password}\nPhone Number: ${phoneNumber || 'Not provided'}`;
    navigator.clipboard.writeText(text);
    toast.success('Credentials copied to clipboard!');
  };

  // Show loading state while fetching role
  if (!user || roleLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Loading...</h2>
            <p className="text-gray-600 mb-6">Fetching user permissions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if user is admin
  if (userRole !== 'admin') {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">Only admins can access this page.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="btn-primary flex items-center space-x-2 mx-auto"
              data-tooltip-id="back-tooltip"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Create New User
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
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="mt-1 relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="Enter user email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Name (Optional)
                </label>
                <div className="mt-1 relative">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    placeholder="Enter user name"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                    placeholder="Enter user password"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  Phone Number (Optional)
                </label>
                <div className="mt-1 relative">
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="input-field"
                    placeholder="Enter user phone number"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <div className="mt-1 relative">
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="select-field"
                    disabled={loading}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`btn-primary flex items-center justify-center space-x-2 w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                data-tooltip-id="create-user-tooltip"
              >
                <UserPlus className="h-4 w-4" />
                <span>{loading ? 'Creating...' : 'Create User'}</span>
              </button>
            </form>
          </div>
        </main>

        {/* Admin Password Prompt Modal */}
        {showPasswordPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Enter Admin Password</h2>
                <button
                  onClick={() => setShowPasswordPrompt(false)}
                  className="text-gray-500 hover:text-gray-700"
                  data-tooltip-id="close-password-prompt-tooltip"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Please enter your admin password to proceed with user creation.
                </p>
                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                    Admin Password
                  </label>
                  <input
                    id="adminPassword"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="input-field w-full"
                    placeholder="Enter your password"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPasswordPrompt(false)}
                    className="btn-secondary flex items-center space-x-2"
                    data-tooltip-id="cancel-password-tooltip"
                  >
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={!adminPassword || loading}
                    className={`btn-primary flex items-center space-x-2 ${!adminPassword || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    data-tooltip-id="confirm-password-tooltip"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Confirm</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {showCredentialsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">User Credentials</h2>
                <button
                  onClick={() => {
                    setShowCredentialsModal(false);
                    router.push('/manage-users');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  data-tooltip-id="close-modal-tooltip"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  The user has been created successfully. Below are the credentials. Please save them securely.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p><strong>Email:</strong> {credentials.email}</p>
                  <p><strong>Password:</strong> {credentials.password}</p>
                  <p><strong>Phone Number:</strong> {phoneNumber || 'Not provided'}</p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCopyCredentials}
                    className="btn-outline flex items-center space-x-2"
                    data-tooltip-id="copy-credentials-tooltip"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy Credentials</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCredentialsModal(false);
                      router.push('/manage-users');
                    }}
                    className="btn-primary flex items-center space-x-2"
                    data-tooltip-id="done-tooltip"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
          id="copy-credentials-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Copy User Credentials
        </Tooltip>
        <Tooltip
          id="close-modal-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Close Modal
        </Tooltip>
        <Tooltip
          id="done-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Close and Return to Manage Users
        </Tooltip>
        <Tooltip
          id="close-password-prompt-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Cancel User Creation
        </Tooltip>
        <Tooltip
          id="cancel-password-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Cancel User Creation
        </Tooltip>
        <Tooltip
          id="confirm-password-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Confirm Admin Password and Create User
        </Tooltip>
      </div>
    </Layout>
  );
}