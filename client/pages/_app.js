import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import { auth, app } from '../lib/firebase';
import '../styles/globals.css';

// Auth context
import { createContext, useContext } from 'react';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

const db = getFirestore(app);

function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Tracks auth and role
  const [configLoading, setConfigLoading] = useState(true); // Tracks Firestore config
  const [userRole, setUserRole] = useState(null);
  const [timeReached, setTimeReached] = useState(false);
  const [ipAllowed, setIpAllowed] = useState(true); // Assume allowed until checked
  const [allowedIPs, setAllowedIPs] = useState([]);
  const [shiftTimes, setShiftTimes] = useState({
    timeoutHour: 12,
    timeoutMinute: 40,
    timeInHour: 8,
    timeInMinute: 0,
    lastResetDate: ''
  });
  const router = useRouter();

  // Authentication state listener and fetch user role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'user');
          } else {
            setUserRole('user');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch allowed IPs and shift times from Firestore
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch IPs
        const configDoc = await getDoc(doc(db, 'config', 'allowed_ips'));
        if (configDoc.exists()) {
          setAllowedIPs(configDoc.data().ips || []);
        } else {
          setAllowedIPs(['127.0.0.1', '::1','10.210.225.193']);
        }

        // Fetch shift times
        const shiftDoc = await getDoc(doc(db, 'config', 'shift_times'));
        if (shiftDoc.exists()) {
          setShiftTimes(shiftDoc.data());
        } else {
          setShiftTimes({
            timeoutHour: 12,
            timeoutMinute: 40,
            timeInHour: 8,
            timeInMinute: 0,
            lastResetDate: ''
          });
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        setAllowedIPs(['127.0.0.1', '::1']);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Check IP allowance client-side using the health check endpoint or fallback
  useEffect(() => {
    if (allowedIPs.length === 0 || configLoading) return; // Wait for IPs to load

    console.log('Allowed IPs:', allowedIPs); // Debug log
    const checkIpAccess = async () => {
      try {
        let clientIp;
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`, {
            headers: { 'Accept': 'application/json' },
          });
          const data = await response.json();
          clientIp = data.ip || data.clientIp;
        } catch (healthError) {
          console.warn('Health endpoint failed, falling back to ipify:', healthError);
          const response = await fetch('https://api.ipify.org?format=json', {
            headers: { 'Accept': 'application/json' },
          });
          const data = await response.json();
          clientIp = data.ip;
        }
        console.log('Fetched IP:', clientIp); // Debug log
        const isAllowed = allowedIPs.includes(clientIp.trim());
        console.log('Is IP Allowed:', isAllowed); // Debug log
        setIpAllowed(isAllowed);
      } catch (error) {
        console.error('Error checking IP access:', error);
        setIpAllowed(false); // Deny access on error
      }
    };

    checkIpAccess();
  }, [allowedIPs, configLoading]);

  // Time check logic
  useEffect(() => {
    const checkTime = () => {
      // Stay in shift until Firestore data is loaded
      if (configLoading || loading) {
        console.log('Firestore data not loaded, staying in shift');
        setTimeReached(false);
        return;
      }

      // Admins bypass time restrictions
      if (userRole === 'admin') {
        console.log('Admin user, bypassing time restrictions');
        setTimeReached(false);
        return;
      }

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentDate = now.toISOString().split('T')[0];

      const { timeoutHour, timeoutMinute, timeInHour, timeInMinute, lastResetDate } = shiftTimes;

      console.log('Time Check:', { hours, minutes, currentDate, shiftTimes, timeReached, userRole });

      // Check if we're past the timeout time
      const isPastTimeout = hours > timeoutHour || (hours === timeoutHour && minutes >= timeoutMinute);
      // Check if we're past the time-in (assuming next day)
      const isPastTimeIn = hours > timeInHour || (hours === timeInHour && minutes >= timeInMinute);

      if (isPastTimeout && (!lastResetDate || lastResetDate !== currentDate)) {
        console.log('Time threshold reached, setting timeReached to true');
        setTimeReached(true);
      } else if (isPastTimeIn && lastResetDate === currentDate) {
        console.log('Time-in reached, resetting timeReached to false');
        setTimeReached(false);
      } else {
        console.log('Time threshold not reached, maintaining timeReached:', timeReached);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [shiftTimes, userRole, configLoading, loading]);

  // Redirect to login if not authenticated and not on login or root page
  useEffect(() => {
    if (!loading && !user && router.pathname !== '/login' && router.pathname !== '/') {
      console.log('Redirecting to login: user not authenticated');
      router.push('/login');
    }
  }, [user, loading, router]);

  // Show loading screen if either auth/role or config is loading
  if (loading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Samwega Debt Management...</p>
        </div>
      </div>
    );
  }

  // Show Time Reached screen if time condition is met and user is not admin
  if (timeReached && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-lg w-full">
          <div className="mb-6 flex justify-center">
            <svg
              className="w-16 h-16 text-blue-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            End of Shift
          </h1>
          <p className="text-sm text-gray-500">
            You will be redirected to the login page shortly.
          </p>
        </div>
      </div>
    );
  }

  // Show Access Denied screen if IP is not allowed
  if (!ipAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-lg w-full">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Access Denied
          </h1>
        
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, userRole }}>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#059669',
            },
          },
          error: {
            style: {
              background: '#DC2626',
            },
          },
        }}
      />
    </AuthContext.Provider>
  );
}

export default MyApp;