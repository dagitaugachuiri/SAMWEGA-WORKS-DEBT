import { useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Redirect if already logged in
  if (user) {
    router.push('/dashboard');
    return null;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Query Firestore for user by email (case-insensitive)
      const usersCollection = collection(db, 'users');
      const qEmail = query(
        usersCollection,
        where('email', '==', identifier.toLowerCase())
      );
      const emailSnapshot = await getDocs(qEmail);

      let userDoc = null;
      if (!emailSnapshot.empty) {
        userDoc = emailSnapshot.docs[0];
      } else {
        // Fetch all users for case-insensitive name matching
        const allUsersSnapshot = await getDocs(usersCollection);
        userDoc = allUsersSnapshot.docs.find(
          (doc) => doc.data().name.toLowerCase() === identifier.toLowerCase()
        );
      }

      if (!userDoc) {
        throw new Error('auth/user-not-found');
      }

      const userData = userDoc.data();
      if (userData.disabled) {
        throw new Error('auth/user-disabled');
      }

      // Use the email from Firestore for authentication
      const email = userData.email;
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful for:', email,password);
      
      toast.success('Successfully logged in!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (error.message === 'auth/user-not-found' || error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this username or email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.message === 'auth/user-disabled') {
        errorMessage = 'This account is disabled. Please contact support.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Samwega Works Ltd.
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Debt Management System
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Sign in to your account to manage debt records
          </p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                Username or Email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="email username"
                required
                className="input-field"
                placeholder="Enter your username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !identifier || !password}
              className="btn-primary w-full flex justify-center items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 Samwega Works Ltd. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Gilgil Town, Kenya
          </p>
        </div>
      </div>
    </div>
  );
}