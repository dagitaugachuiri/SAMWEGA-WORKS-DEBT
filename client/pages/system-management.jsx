import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../lib/firebase';
import { useAuth } from './_app';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import { MessageSquare, Server, Database } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

const db = getFirestore(app);

export default function SystemManagement() {
  const { user } = useAuth();
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
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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