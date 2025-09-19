import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Send, X, Home } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function SendMessage() {
  const [customerNames, setCustomerNames] = useState([]);
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState('custom');
  const [template, setTemplate] = useState('default');
  const [isDisabled, setIsDisabled] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const reminderTemplates = {
    default: 'Dear [NAME], for debts total [TOTALDEBT], pay once through paybill 4142169, account number [PHONENUMBER]. For any inquiries dial 0113689071 Thank you.',
    friendly: 'Hello [NAME], your debts total [TOTALDEBT]. Please pay via paybill 4142169, account [PHONENUMBER]. Questions? Call 0113689071. Thanks for your prompt payment!',
    urgent: 'Dear [NAME], debts amounting to [TOTALDEBT] are due. Settle via paybill 4142169, account [PHONENUMBER]. Contact 0113689071 for queries. Thank you.',
    supportive: 'Dear [NAME], your debts total [TOTALDEBT]. Pay through paybill 4142169, account [PHONENUMBER]. Reach us at 0113689071 for assistance. Thank you!'
  };

  useEffect(() => {
    const checkUserStatus = async () => {
      if (user?.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsDisabled(userData.disabled || false);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
    };

    checkUserStatus();
  }, [user?.uid]);

  useEffect(() => {
    const fetchCustomerNames = async () => {
      const { phoneNumbers: phoneNumbersParam } = router.query;
      if (phoneNumbersParam) {
        const numbers = phoneNumbersParam.split(',');
        setPhoneNumbers(numbers);
        try {
          const namePromises = numbers.map(async (phone) => {
            const customerRef = doc(db, 'customers', phone);
            const customerSnap = await getDoc(customerRef);
            return customerSnap.exists() ? customerSnap.data().name : phone;
          });
          const names = await Promise.all(namePromises);
          setCustomerNames(names);
        } catch (error) {
          console.error('Error fetching customer names:', error);
          toast.error('Failed to load customer names');
        }
      }
    };

    if (user) {
      fetchCustomerNames();
    }
  }, [router.query, user]);

  useEffect(() => {
    if (messageType === 'reminder') {
      setMessage(reminderTemplates[template]);
    } else {
      setMessage('');
    }
  }, [messageType, template]);

  const handleSendMessage = async () => {
    try {
      if (phoneNumbers.length === 0) {
        throw new Error('No customers to send message to');
      }

      if (!message.trim()) {
        throw new Error('Please enter a message');
      }

      if (message.length < 5) {
        throw new Error('Message must be at least 5 characters long');
      }

      setSending(true);
      const response = await apiService.customers.sendCustomMessage({
        phoneNumbers,
        message,
        userId: user.uid,
        type: messageType
      });

      if (response.data.success) {
        toast.success(`Message sent to ${phoneNumbers.length} / ${phoneNumbers.length} customers`);
        router.push('/customers');
        setMessage('');
      } else {
        throw new Error(response.data.error || 'Failed to send messages');
      }
    } catch (error) {
      console.error('Error sending custom messages:', error);
      toast.error(error.message || 'Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return null;
  }

  if (isDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600">Account Disabled</h1>
          <p className="mt-2 text-gray-600">Your account has been disabled. Please contact support for assistance.</p>
        </div>
      </div>
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
                  Send Custom Message
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  data-tooltip-id="customers-tooltip"
                  onClick={() => router.push('/customers')}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Customers</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-8">
          <div className="bg-white rounded-xl p-8 shadow-2xl">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">
                <strong>Sending to:</strong> {phoneNumbers.length} customers
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {customerNames.length > 0 ? customerNames.join(', ').substring(0, 100) + '...' : 'Loading names...'}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Sidebar: Message Type and Settings */}
              <div className="lg:col-span-1 bg-gray-50 p-6 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Settings</h2>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Type
                  </label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                  >
                    <option value="custom">Custom Message</option>
                    <option value="reminder">Payment Reminder</option>
                    <option value="update">Account Update</option>
                  </select>
                </div>
                {messageType === 'reminder' && (
                  <>
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reminder Template
                      </label>
                      <select
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                      >
                        <option value="default">Default</option>
                        <option value="friendly">Friendly</option>
                        <option value="urgent">Urgent</option>
                        <option value="supportive">Supportive</option>
                      </select>
                    </div>
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Tip:</strong> For payment reminders, placeholders like [NAME], [DEBTCODES], [TOTALDEBT], and [PHONENUMBER] will be replaced with customer data. Ensure your message is clear and concise.
                      </p>
                    </div>
                  </>
                )}
              </div>
              {/* Right Section: Message Input and Actions */}
              <div className="lg:col-span-2">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your custom message here (max 350 characters)..."
                    maxLength={350}
                  ></textarea>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>Character count: {message.length}/350</span>
                    <span className={`font-medium ${message.length > 320 ? 'text-red-600' : 'text-green-600'}`}>
                      {message.length > 320 ? 'SMS may be split' : 'Standard SMS'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => router.push('/customers')}
                    className="px-8 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={sending}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || message.trim() === '' || message.length < 5 || phoneNumbers.length === 0}
                    className="px-8 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>{sending ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Tooltip
          id="customers-tooltip"
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Return to Customers
        </Tooltip>
      </div>
    </Layout>
  );
}