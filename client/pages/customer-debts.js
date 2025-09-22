import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { ArrowLeft, CreditCard, Calendar, DollarSign, FileText, User, Store, MapPin, MessageSquare, Send, Phone } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';

// Utility function for formatting currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
};

// Utility function for formatting timestamps
const formatTimestamp = (timestamp) => {
  const date = timestamp?.seconds
    ? new Date(timestamp.seconds * 1000)
    : new Date(timestamp);
  return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-GB');
};

// Utility function for status classes
const getStatusClass = (status) => {
  switch (status) {
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'partially_paid':
      return 'bg-yellow-100 text-yellow-800';
    case 'pending':
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

// Utility function for status text
const getStatusText = (status) => {
  return status ? status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'N/A';
};

export default function CustomerDebts() {
  const [customer, setCustomer] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { customer: customerData } = router.query;

  // Parse customer data from query parameter
  useEffect(() => {
    if (customerData) {
      try {
        const decodedCustomer = JSON.parse(decodeURIComponent(customerData));
        setCustomer(decodedCustomer);
      } catch (error) {
        console.error('Error parsing customer data:', error);
        toast.error('Failed to load customer data');
        router.push('/customers');
      }
    } else {
      router.push('/customers');
    }
  }, [customerData, router]);

  // Check user status
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

  // Placeholder for manual payment request
  const handleRequestManualPayment = () => {
    toast.success('Manual payment request sent');
  };

  // Placeholder for processing payment
  const handleProcessPayment = (debt) => {
    toast.success(`Processing payment for Debt #${debt.debtCode}`);
  };

  if (!user) {
    return null;
  }

  if (isDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600">Account Disabled</h1>
          <p className="mt-2 text-gray-600">Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/customers')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
                  data-tooltip-id="back-tooltip"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Customers</span>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Loading Customer Debts</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-8">
          <div className="grid grid-cols-1 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </main>
        <Tooltip
          id="back-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Return to Customers Page
        </Tooltip>
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/customers')}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
                  data-tooltip-id="back-tooltip"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Customers</span>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                  {customer.name}'s Debts
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-8">
          <div className="space-y-8">
            {/* Customer Information Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow duration-300 animate-fade-in">
              <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg px-4 py-2 mb-4">
                <h2 className="text-xl font-semibold">Customer Profile</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 group">
                    <User className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Name</span>
                      <p className="text-gray-900 font-medium">{customer.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <Phone className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Phone</span>
                      <p className="text-gray-900 font-medium">{customer.phoneNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <Store className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Shop Name</span>
                      <p className="text-gray-900 font-medium">{customer.shopName || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <MapPin className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Location</span>
                      <p className="text-gray-900 font-medium">{customer.location || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3 group">
                      <FileText className="h-5 w-5 text-green-500 group-hover:scale-110 transition-transform duration-200" />
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Total Debts</span>
                        <p className="text-gray-900 font-bold text-lg">{customer.debtIds.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3 group">
                      <DollarSign className="h-5 w-5 text-red-500 group-hover:scale-110 transition-transform duration-200" />
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Total Owed</span>
                        <p className="text-gray-900 font-bold text-lg">{formatCurrency(customer.totalDebtOwed)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <Calendar className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Created At</span>
                      <p className="text-gray-900 font-medium">{formatTimestamp(customer.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <Calendar className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Last Updated</span>
                      <p className="text-gray-900 font-medium">{formatTimestamp(customer.lastUpdatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Debts List */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Debt Information</h2>
              {customer.debts.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Debts Found</h3>
                  <p className="mt-1 text-sm text-gray-500">This customer has no recorded debts.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customer.debts.map((debt) => (
                    <div
                      key={debt.debtCode}
                      className="border rounded-lg p-4 hover:shadow transition-shadow cursor-pointer"
                      data-tooltip-id={`debt-tooltip-${debt.debtCode}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                          <span className={`font-mono text-sm font-bold ${debt.status === 'paid' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            #{debt.debtCode || 'N/A'}
                          </span>
                        </div>
                        <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${getStatusClass(debt.status)}`}>
                          {getStatusText(debt.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">{debt.storeOwner?.name || 'Unknown'}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{debt.store?.name || 'N/A'}, {debt.store?.location || 'N/A'}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{debt.description || 'N/A'}</span>
                      </div>

                      <div className="bg-gray-50 rounded p-2 mb-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total:</span>
                          <span className={`font-bold ${debt.status === 'paid' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {formatCurrency(debt.amount || 0)}
                          </span>
                        </div>
                        {debt.paidAmount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Paid:</span>
                            <span className="font-medium text-green-600">{formatCurrency(debt.paidAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Outstanding:</span>
                          <span className="font-bold text-red-600">{formatCurrency(debt.remainingAmount || 0)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Created On: {formatTimestamp(debt.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Due On: {formatTimestamp(debt.dueDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Created By: {debt.createdBy || 'N/A'}</span>
                      </div>

                      {debt.status !== 'paid' && (
                        <div className="flex gap-2">
                          {!debt.manualPaymentRequested ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestManualPayment();
                                }}
                                className="flex-1 flex items-center justify-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 rounded p-2"
                              >
                                <MessageSquare className="h-4 w-4" />
                                <span>Manual Payment</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowResendModal(true);
                                }}
                                className="flex-1 flex items-center justify-center gap-1 text-sm bg-green-100 hover:bg-green-200 rounded p-2"
                              >
                                <Send className="h-4 w-4" />
                                <span>Resend SMS</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProcessPayment(debt);
                              }}
                              className="w-full flex items-center justify-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 rounded p-2"
                            >
                              <DollarSign className="h-4 w-4" />
                              <span>Process Payment</span>
                            </button>
                          )}
                        </div>
                      )}

                      <Tooltip
                        id={`debt-tooltip-${debt.debtCode}`}
                        place="top"
                        style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
                      >
                        View details for Debt #{debt.debtCode}
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <Tooltip
          id="back-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Return to Customers Page
        </Tooltip>
      </div>
    </Layout>
  );
}