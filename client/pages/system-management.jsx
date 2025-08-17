import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from '../lib/firebase';
import { useAuth } from './_app';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import { DollarSign, Server, Database, MessageSquare, BarChart2, Cpu, MemoryStick, Network } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

const db = getFirestore(app);

// Sample metrics (replace with actual API calls if credentials available)
const renderMetrics = {
  cpuUsage: 45.5, // % CPU usage
  memoryUsage: 512, // MB used
  httpRequests: 1200, // Requests per hour
};

const firebaseMetrics = {
  dbReads: 1500, // Read operations per hour
  dbWrites: 300, // Write operations per hour
  activeConnections: 25, // Current active connections
};

export default function SystemManagement() {
  const { user } = useAuth();
  const [smsBalance, setSmsBalance] = useState(null);
  const [estimatedSmsLeft, setEstimatedSmsLeft] = useState(null);
  const [systemStats, setSystemStats] = useState({
    usersCount: 0,
    debtsCount: 0,
    paymentsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

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
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    if (role === 'admin') {
      fetchSmsBalance();
      fetchSystemStats();
    }
    setLoading(false);
  }, [role]);

  const fetchSmsBalance = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_TEXTSMS_API_KEY;
      const partnerID = process.env.NEXT_PUBLIC_TEXTSMS_PARTNER_ID;

      if (!apiKey || !partnerID) {
        throw new Error('Missing API key or partner ID');
      }

      const response = await fetch('https://sms.textsms.co.ke/api/services/getbalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apikey: apiKey,
          partnerID: partnerID,
        }),
      });

      if (!response.ok) {
        throw new Error(`TextSMS API responded with status ${response.status}`);
      }

      const data = await response.json();
      const balance = parseFloat(data.balance); // Adjust if response format differs
      setSmsBalance(balance);
      setEstimatedSmsLeft(Math.floor(balance / 0.3));
    } catch (error) {
      console.error('Error fetching SMS balance:', error);
      toast.error('Failed to fetch SMS balance');
    }
  };

  const fetchSystemStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const debtsSnap = await getDocs(collection(db, 'debts'));
      const paymentsSnap = await getDocs(collection(db, 'payment_logs'));

      setSystemStats({
        usersCount: usersSnap.size,
        debtsCount: debtsSnap.size,
        paymentsCount: paymentsSnap.size,
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
      toast.error('Failed to fetch system stats');
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
          System Management Dashboard
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* SMS Service Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="sms-tooltip"
          >
            <div className="flex items-center mb-4">
              <MessageSquare className="h-8 w-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">SMS Service (TextSMS)</h2>
            </div>
            {smsBalance !== null ? (
              <div className="space-y-2">
                <p className="text-gray-600">
                  <span className="font-medium">Balance:</span>{' '}
                  {smsBalance.toFixed(2)} KSH
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Estimated SMS Left:</span>{' '}
                  {estimatedSmsLeft}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Cost per SMS:</span> 0.3 KSH
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Loading SMS balance...</p>
            )}
          </div>

          {/* Render Cloud Server Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="render-tooltip"
          >
            <div className="flex items-center mb-4">
              <Server className="h-8 w-8 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">
                Cloud Server (Render.com)
              </h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600 flex items-center">
                <Cpu className="h-5 w-5 mr-2 text-green-500" />
                <span className="font-medium">CPU Usage:</span>{' '}
                {renderMetrics.cpuUsage.toFixed(1)}%
              </p>
              <p className="text-gray-600 flex items-center">
                <MemoryStick className="h-5 w-5 mr-2 text-green-500" />
                <span className="font-medium">Memory Usage:</span>{' '}
                {renderMetrics.memoryUsage} MB
              </p>
              <p className="text-gray-600 flex items-center">
                <Network className="h-5 w-5 mr-2 text-green-500" />
                <span className="font-medium">HTTP Requests:</span>{' '}
                {renderMetrics.httpRequests}/hr
              </p>
              <p className="text-gray-600">
                <a
                  href="https://dashboard.render.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Billing in Render Dashboard
                </a>
              </p>
            </div>
          </div>

          {/* Firebase Database Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="firebase-tooltip"
          >
            <div className="flex items-center mb-4">
              <Database className="h-8 w-8 text-orange-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">
                Database (Firebase)
              </h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">
                <span className="font-medium">DB Reads:</span>{' '}
                {firebaseMetrics.dbReads}/hr
              </p>
              <p className="text-gray-600">
                <span className="font-medium">DB Writes:</span>{' '}
                {firebaseMetrics.dbWrites}/hr
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Active Connections:</span>{' '}
                {firebaseMetrics.activeConnections}
              </p>
              <p className="text-gray-600">
                <a
                  href="https://console.cloud.google.com/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View Billing in Google Cloud Console
                </a>
              </p>
            </div>
          </div>

          {/* System Stats Card */}
          <div
            className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300"
            data-tooltip-id="stats-tooltip"
          >
            <div className="flex items-center mb-4">
              <BarChart2 className="h-8 w-8 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">
                System Statistics
              </h2>
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">
                <span className="font-medium">Users:</span>{' '}
                {systemStats.usersCount}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Debts:</span>{' '}
                {systemStats.debtsCount}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Payments:</span>{' '}
                {systemStats.paymentsCount}
              </p>
            </div>
          </div>

          {/* Total Expenses Card */}
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 col-span-1 sm:col-span-2 lg:col-span-3"
            data-tooltip-id="expenses-tooltip"
          >
            <div className="flex items-center mb-4">
              <DollarSign className="h-8 w-8 text-white mr-3" />
              <h2 className="text-xl font-semibold">Total Running Expenses</h2>
            </div>
            <div className="space-y-2">
              <p>
                <span className="font-medium">SMS Expenses:</span>{' '}
                {smsBalance !== null
                  ? `~${(smsBalance / 0.3).toFixed(0)} SMS sent`
                  : 'N/A'}
              </p>
              <p>
                <span className="font-medium">Server Costs:</span> Check Render
                Dashboard
              </p>
              <p>
                <span className="font-medium">Database Costs:</span> Check Google
                Cloud Console
              </p>
              <p>
                <span className="font-medium">Total:</span> [Aggregate data not
                available]
              </p>
            </div>
          </div>
        </div>

        {/* Tooltips */}
        <Tooltip
          id="sms-tooltip"
          content="SMS service balance and estimated usage"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="render-tooltip"
          content="Cloud server resource usage and billing"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="firebase-tooltip"
          content="Database usage and billing"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="stats-tooltip"
          content="Overall system statistics"
          className="bg-gray-800 text-white rounded-md p-2"
        />
        <Tooltip
          id="expenses-tooltip"
          content="Aggregated running expenses"
          className="bg-gray-800 text-white rounded-md p-2"
        />
      </div>
    </Layout>
  );
}