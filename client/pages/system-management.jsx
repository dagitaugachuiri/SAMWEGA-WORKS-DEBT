import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app } from '../lib/firebase';
import { useAuth } from './_app';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import { MessageSquare, Server, Database, Plus, Trash2, Clock, Loader2 } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

const db = getFirestore(app);

export default function SystemManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [allowedIPs, setAllowedIPs] = useState([]);
  const [newIP, setNewIP] = useState('');
  const [shiftTimes, setShiftTimes] = useState({
    timeoutHour: 0,
    timeoutMinute: 0,
    timeInHour: 0,
    timeInMinute: 0,
  });
  const [isAddingIP, setIsAddingIP] = useState(false);
  const [isRemovingIP, setIsRemovingIP] = useState(null); // Track IP being removed
  const [isUpdatingShiftTimes, setIsUpdatingShiftTimes] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role || 'user');
          } else {
            setRole('user');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          toast.error('Failed to load user role');
          setRole('user');
        }
      }
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  // Fetch allowed IPs and shift times from Firestore
  useEffect(() => {
    if (role === 'admin') {
      const fetchConfig = async () => {
        try {
          // Fetch IPs
          const configDoc = await getDoc(doc(db, 'config', 'allowed_ips'));
          if (configDoc.exists()) {
            setAllowedIPs(configDoc.data().ips || []);
          } else {
            await setDoc(doc(db, 'config', 'allowed_ips'), { ips: ['127.0.0.1', '::1'] });
            setAllowedIPs(['127.0.0.1', '::1']);
          }

          // Fetch shift times
          const shiftDoc = await getDoc(doc(db, 'config', 'shift_times'));
          if (shiftDoc.exists()) {
            setShiftTimes(shiftDoc.data());
          } else {
            const defaultTimes = { timeoutHour: 12, timeoutMinute: 30, timeInHour: 8, timeInMinute: 0 };
            await setDoc(doc(db, 'config', 'shift_times'), defaultTimes);
            setShiftTimes(defaultTimes);
          }
        } catch (error) {
          console.error('Error fetching config:', error);
          toast.error('Failed to load configuration');
        }
      };

      fetchConfig();
    }
  }, [role]);

  const validateIP = (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  const addIP = async () => {
    if (!newIP.trim()) {
      toast.error('Please enter an IP address');
      return;
    }
    if (!validateIP(newIP.trim())) {
      toast.error('Please enter a valid IPv4 or IPv6 address');
      return;
    }

    setIsAddingIP(true);
    try {
      await updateDoc(doc(db, 'config', 'allowed_ips'), {
        ips: arrayUnion(newIP.trim())
      });
      setAllowedIPs([...allowedIPs, newIP.trim()]);
      setNewIP('');
      toast.success('IP added successfully');
    } catch (error) {
      console.error('Error adding IP:', error);
      toast.error('Failed to add IP');
    } finally {
      setIsAddingIP(false);
    }
  };

  const removeIP = async (ipToRemove) => {
    setIsRemovingIP(ipToRemove);
    try {
      await updateDoc(doc(db, 'config', 'allowed_ips'), {
        ips: arrayRemove(ipToRemove)
      });
      setAllowedIPs(allowedIPs.filter(ip => ip !== ipToRemove));
      toast.success('IP removed successfully');
    } catch (error) {
      console.error('Error removing IP:', error);
      toast.error('Failed to remove IP');
    } finally {
      setIsRemovingIP(null);
    }
  };

  const updateShiftTimes = async () => {
    const { timeoutHour, timeoutMinute, timeInHour, timeInMinute } = shiftTimes;
    if (
      !Number.isInteger(timeoutHour) || timeoutHour < 0 || timeoutHour > 23 ||
      !Number.isInteger(timeoutMinute) || timeoutMinute < 0 || timeoutMinute > 59 ||
      !Number.isInteger(timeInHour) || timeInHour < 0 || timeInHour > 23 ||
      !Number.isInteger(timeInMinute) || timeInMinute < 0 || timeInMinute > 59
    ) {
      toast.error('Please enter valid hours (0-23) and minutes (0-59)');
      return;
    }

    setIsUpdatingShiftTimes(true);
    try {
      await updateDoc(doc(db, 'config', 'shift_times'), {
        timeoutHour,
        timeoutMinute,
        timeInHour,
        timeInMinute,
        lastResetDate: new Date().toISOString().split('T')[0]
      });
      toast.success('Shift times updated successfully');
    } catch (error) {
      console.error('Error updating shift times:', error);
      toast.error('Failed to update shift times');
    } finally {
      setIsUpdatingShiftTimes(false);
    }
  };

  if (loading || !user) {
    return (
      <Layout userId={user?.uid}>
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-xl font-semibold text-gray-700">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (role !== 'admin') {
    return (
      <Layout userId={user.uid}>
        <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-xl font-semibold text-red-600">Access denied. Admin only.</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout userId={user.uid}>
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8">
          System Services
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* TextSMS Service Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="sms-tooltip"
          >
            <div className="flex items-center mb-4">
              <MessageSquare className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">SMS Service (TextSMS)</h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">
                <a
                  href="https://sms.textsms.co.ke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View TextSMS Dashboard
                </a>
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Credentials:</span>
              </p>
              <p className="text-gray-600">Username: eApps</p>
              <p className="text-gray-600">Password: RfBcDX</p>
            </div>
          </div>

          {/* Render.com Service Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="render-tooltip"
          >
            <div className="flex items-center mb-4">
              <Server className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">Cloud Server (Render.com)</h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">
                <a
                  href="https://dashboard.render.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Render Dashboard
                </a>
              </p>
            </div>
          </div>

          {/* Firebase Service Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="firebase-tooltip"
          >
            <div className="flex items-center mb-4">
              <Database className="h-8 w-8 text-orange-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">Database (Firebase)</h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Firebase Console
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* IP Management Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Allowed Computers and Phones IPs</h2>
          
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
              placeholder="Enter IP address (e.g., 192.168.1.100)"
              disabled={isAddingIP}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={addIP}
              disabled={isAddingIP}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isAddingIP ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add IP
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-medium text-gray-700">Current Allowed IPs:</h3>
            {allowedIPs.length === 0 ? (
              <p className="text-gray-500">No allowed IPs configured.</p>
            ) : (
              <ul className="space-y-1">
                {allowedIPs.map((ip) => (
                  <li
                    key={ip}
                    className="flex justify-between items-center bg-gray-50 p-2 rounded-md"
                  >
                    <span className="text-gray-700">{ip}</span>
                    <button
                      onClick={() => removeIP(ip)}
                      disabled={isRemovingIP === ip}
                      className="text-red-600 hover:text-red-800 flex items-center gap-1 disabled:text-red-400 disabled:cursor-not-allowed"
                    >
                      {isRemovingIP === ip ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Removing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Shift Times Management Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Shift Times Management
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
             <div>
              <label className="block text-gray-700 font-medium mb-2">Start time</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={shiftTimes.timeInHour}
                  onChange={(e) => setShiftTimes({ ...shiftTimes, timeInHour: parseInt(e.target.value) || 0 })}
                  placeholder="Hour (0-23)"
                  min="0"
                  max="23"
                  disabled={isUpdatingShiftTimes}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  value={shiftTimes.timeInMinute}
                  onChange={(e) => setShiftTimes({ ...shiftTimes, timeInMinute: parseInt(e.target.value) || 0 })}
                  placeholder="Minute (0-59)"
                  min="0"
                  max="59"
                  disabled={isUpdatingShiftTimes}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Exit Time</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={shiftTimes.timeoutHour}
                  onChange={(e) => setShiftTimes({ ...shiftTimes, timeoutHour: parseInt(e.target.value) || 0 })}
                  placeholder="Hour (0-23)"
                  min="0"
                  max="23"
                  disabled={isUpdatingShiftTimes}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  value={shiftTimes.timeoutMinute}
                  onChange={(e) => setShiftTimes({ ...shiftTimes, timeoutMinute: parseInt(e.target.value) || 0 })}
                  placeholder="Minute (0-59)"
                  min="0"
                  max="59"
                  disabled={isUpdatingShiftTimes}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
           
          </div>

          <button
            onClick={updateShiftTimes}
            disabled={isUpdatingShiftTimes}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isUpdatingShiftTimes ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Update Shift Times
              </>
            )}
          </button>
        </div>

        {/* Tooltips */}
        <Tooltip
          id="sms-tooltip"
          content="TextSMS service for sending SMS notifications"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="render-tooltip"
          content="Render.com cloud hosting platform"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="firebase-tooltip"
          content="Firebase Firestore database service"
          className="bg-gray-800 text-white rounded-md p-2"
        />
      </div>
    </Layout>
  );
}