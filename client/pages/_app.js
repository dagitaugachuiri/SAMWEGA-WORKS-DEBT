import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import { auth, app } from '../lib/firebase';
import '../styles/globals.css';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

const db = getFirestore(app);

function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [timeReached, setTimeReached] = useState(false);
  const [deviceAllowed, setDeviceAllowed] = useState(true);
  const [allowedFingerprints, setAllowedFingerprints] = useState([]);
  const [shiftTimes, setShiftTimes] = useState({
    timeoutHour: 12,
    timeoutMinute: 40,
    timeInHour: 8,
    timeInMinute: 0,
    lastResetDate: ''
  });

  const router = useRouter();

  // ✅ Listen for authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          setUserRole(userDoc.exists() ? userDoc.data().role || 'user' : 'user');
        } catch (err) {
          console.error('Error fetching user role:', err);
          setUserRole('user');
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Fetch config (allowed devices + shift times)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const allowedDoc = await getDoc(doc(db, 'config', 'allowed_devices'));
        setAllowedFingerprints(allowedDoc.exists() ? allowedDoc.data().fingerprints || ["2548b6dbf98fc0195a017059f18f548e9dcc13c9a219f1c03e33a01b3cdd51c1"] : ["2548b6dbf98fc0195a017059f18f548e9dcc13c9a219f1c03e33a01b3cdd51c1"]);

        const shiftDoc = await getDoc(doc(db, 'config', 'shift_times'));
        setShiftTimes(
          shiftDoc.exists()
            ? shiftDoc.data()
            : {
                timeoutHour: 12,
                timeoutMinute: 40,
                timeInHour: 8,
                timeInMinute: 0,
                lastResetDate: ''
              }
        );
      } catch (err) {
        console.error('Error fetching Firestore config:', err);
        setAllowedFingerprints([]);
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // ✅ Generate and persist fingerprint
  useEffect(() => {
    if (configLoading) return;

    const generateDeviceFingerprint = async () => {
      const userAgent = navigator.userAgent || '';
      const platform = navigator.platform || '';
      const language = navigator.language || '';
      const screenInfo = `${screen.width}x${screen.height}@${window.devicePixelRatio}`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const rawData = `${userAgent}|${platform}|${language}|${screenInfo}|${timeZone}`;
      const encoded = new TextEncoder().encode(rawData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const checkDeviceAccess = async () => {
      try {
        let fingerprint = localStorage.getItem('device_fingerprint');

        if (!fingerprint) {
          fingerprint = await generateDeviceFingerprint();
          localStorage.setItem('device_fingerprint', fingerprint);
          console.log('Generated new fingerprint:', fingerprint);
        } else {
          console.log('Loaded fingerprint from localStorage:', fingerprint);
        }

        const isAllowed = allowedFingerprints.includes(fingerprint);
        console.log('Allowed device hashes:', allowedFingerprints);
        console.log('Is device allowed:', isAllowed);

        setDeviceAllowed(isAllowed);
      } catch (err) {
        console.error('Error checking fingerprint access:', err);
        setDeviceAllowed(false);
      }
    };

    checkDeviceAccess();
  }, [allowedFingerprints, configLoading]);

  // ✅ Shift time restriction logic (admins included)
  useEffect(() => {
    const checkShiftTime = () => {
      if (configLoading || loading) return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentDate = now.toISOString().split('T')[0];
      const { timeoutHour, timeoutMinute, timeInHour, timeInMinute, lastResetDate } = shiftTimes;

      const pastTimeout = hours > timeoutHour || (hours === timeoutHour && minutes >= timeoutMinute);
      const beforeTimeIn = hours < timeInHour || (hours === timeInHour && minutes < timeInMinute);

      // 🔒 Lock access outside the defined working window (for all roles)
      if (pastTimeout || beforeTimeIn) {
        setTimeReached(true);
      } else {
        setTimeReached(false);
      }
    };

    checkShiftTime();
    const interval = setInterval(checkShiftTime, 60000);
    return () => clearInterval(interval);
  }, [shiftTimes, configLoading, loading]);

  // ✅ Redirect if unauthenticated
  useEffect(() => {
    if (!loading && !user && router.pathname !== '/login' && router.pathname !== '/') {
      router.push('/login');
    }
  }, [user, loading, router]);

  // ✅ Loading screen
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

  // ✅ Shift restriction screen except admins
  if (timeReached && userRole !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-semibold text-yellow-600 mb-4">Shift Ended</h1>
          <p className="text-gray-600 mb-4">
            Access is restricted outside your assigned working hours.
          </p>
          <p className="text-sm text-gray-500">
            Please return during your next allowed shift time.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Device access restriction
  if (!deviceAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-semibold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            This device is not authorized. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Normal app
  return (
    <AuthContext.Provider value={{ user, loading, userRole }}>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#363636', color: '#fff' },
          success: { style: { background: '#059669' } },
          error: { style: { background: '#DC2626' } },
        }}
      />
    </AuthContext.Provider>
  );
}

export default MyApp;
