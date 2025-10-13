import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Search, Users, Home, Phone, Store, MapPin, FileText, User, Calendar, CreditCard, AlertCircle, DollarSign, Send, Clock } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Utility function for retrying API calls with exponential backoff
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debtStatusFilter, setDebtStatusFilter] = useState('all');
  const [debtRange, setDebtRange] = useState({ min: '', max: '' });
  const [debtCountFilter, setDebtCountFilter] = useState('');
  const [isDisabled, setIsDisabled] = useState(false);
  const [unmatchedDebtCodes, setUnmatchedDebtCodes] = useState([]);
  const [unmatchedDebtTotal, setUnmatchedDebtTotal] = useState(null);
  const { user } = useAuth();
  const router = useRouter();

  // Current date for overdue calculations
  const currentDate = new Date();

 // Set search term from URL query parameter
  useEffect(() => {
    if (router.query.accountNumber) {
      setSearchTerm(decodeURIComponent(router.query.accountNumber));
    }
  }, [router.query.accountNumber]);

  const fetchCustomersAndDebts = async () => {
    try {
      setLoading(true);
      setUnmatchedDebtCodes([]);
      setUnmatchedDebtTotal(null);

      // Fetch customers and debts in parallel with retry
      const [customerResponse, debtResponse] = await Promise.all([
        retryWithBackoff(() => apiService.customers.getAll({ limit: 10000 })),
        retryWithBackoff(() => apiService.debts.getAll({ limit: 10000 }))
      ]);

      if (!customerResponse.data.success) {
        throw new Error('Failed to load customers');
      }
      if (!debtResponse.data.success) {
        throw new Error('Failed to load debts');
      }

      // Create a map of debts using debtCode
      const debtsMap = new Map();
      const debts = debtResponse.data.data || [];
      debts.forEach(debt => {
        if (debt.debtCode) {
          debtsMap.set(debt.debtCode, debt);
        } else {
          console.warn(`Debt with ID ${debt.id} missing debtCode`);
        }
      });

      // Track unmatched debt codes
      const unmatchedCodes = new Set();

      // Process customers and match debts using debtCode
      const customersWithDebt = customerResponse.data.data.map((customer) => {
        const debtIds = Array.isArray(customer.debtIds) ? customer.debtIds : [];
        const debts = [];
        let totalDebtOwed = 0;

        // Match debtIds (debtCodes) to fetched debts
        debtIds.forEach(debtCode => {
          const debt = debtsMap.get(debtCode);
          if (debt) {
            debts.push(debt);
            totalDebtOwed += (debt.remainingAmount || 0);
          } else {
            unmatchedCodes.add(debtCode);
            console.warn(`Debt code ${debtCode} not found for customer ${customer.phoneNumber} (${customer.name})`);
          }
        });

        return {
          ...customer,
          debtIds,
          totalDebtOwed,
          debts,
        };
      });

      setCustomers(customersWithDebt);
      setUnmatchedDebtCodes([...unmatchedCodes]);

      if (unmatchedCodes.size > 0) {
        console.warn(`Unmatched debts: ${unmatchedCodes.size} debt(s) with codes [${[...unmatchedCodes].join(', ')}]. Total: Unknown (no debt data available)`);
        toast.error(`Some debt data could not be matched for ${unmatchedCodes.size} debt(s) [${[...unmatchedCodes].slice(0, 5).join(', ')}${unmatchedCodes.size > 5 ? '...' : ''}]. Total unmatched: Unknown. Contact support to resolve missing debt records.`, {
          duration: 5000,
        });
      }

      // Log sample customer for debugging
      if (customersWithDebt.length > 0) {
        console.log('Sample customer:', customersWithDebt[0]);
      }
    } catch (error) {
      console.error('Error fetching customers or debts:', error);
      toast.error('Failed to load customers or debts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCustomersAndDebts();
    }
  }, [user]);

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

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.shopName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.location || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesDebtStatus = debtStatusFilter === 'all'
      ? true
      : customer.debts?.some(debt => debt.status === debtStatusFilter);

    const matchesDebtRange = debtRange.min || debtRange.max
      ? (debtRange.min ? customer.totalDebtOwed >= parseFloat(debtRange.min) : true) &&
        (debtRange.max ? customer.totalDebtOwed <= parseFloat(debtRange.max) : true)
      : true;

    const matchesDebtCount = debtCountFilter === '' || debtCountFilter === null
      ? true
      : customer.debtIds.length === parseInt(debtCountFilter);

    return matchesSearch && matchesDebtStatus && matchesDebtRange && matchesDebtCount;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatTimestamp = (timestamp) => {
    const date = timestamp?.seconds
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-GB');
  };

  // Calculate Average Days Overdue
  const calculateAverageDaysOverdue = () => {
    const overdueDebts = filteredCustomers.flatMap(customer =>
      customer.debts?.filter(debt => debt.status === 'overdue') || []
    );
    if (overdueDebts.length === 0) return '0 days';

    const totalDaysOverdue = overdueDebts.reduce((sum, debt) => {
      const dueDate = debt.dueDate?.seconds
        ? new Date(debt.dueDate.seconds * 1000)
        : new Date(debt.dueDate);
      if (isNaN(dueDate.getTime())) return sum;
      const daysOverdue = Math.max(0, Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24)));
      return sum + daysOverdue;
    }, 0);

    return `${Math.round(totalDaysOverdue / overdueDebts.length)} days`;
  };

  const handleCardClick = (customer) => {
    // Serialize customer data to JSON and encode it for the query parameter
    const customerData = JSON.stringify(customer);
    router.push(`/customer-debts?customer=${encodeURIComponent(customerData)}`);
  };

  const handleOpenSendMessage = () => {
    if (filteredCustomers.length === 0) {
      toast.error('No customers selected to send message to');
      return;
    }
    const phoneNumbers = filteredCustomers.map(c => c.phoneNumber).join(',');
    router.push(`/send-message?phoneNumbers=${encodeURIComponent(phoneNumbers)}`);
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

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Samwega Customers
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  data-tooltip-id="dashboard-tooltip"
                  onClick={() => router.push('/dashboard')}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Home className="h-4 w-4" />
                  <span>Dashboard</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto p-8">
          {unmatchedDebtCodes.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
              <p>Warning: Some debt data could not be matched for {unmatchedDebtCodes.length} debt(s) [{[...unmatchedDebtCodes].slice(0, 5).join(', ')}{unmatchedDebtCodes.length > 5 ? '...' : ''}]. Total unmatched: Unknown (no debt data available). Contact support to resolve missing debt records.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card bg-white p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-900">Total Customers</h3>
                <div className="p-2 bg-blue-100 mr-2 rounded-md">
                  <Users className="h-6 w-6 text-sky-600" />
                </div>
              </div>
              <p className="text-xl font-bold mt-2">{filteredCustomers.length}</p>
            </div>
            <div className="card bg-white p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-900">Total Outstanding</h3>
                <div className="p-2 bg-red-100 mr-2 rounded-md">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <p className="text-xl font-bold mt-2">{formatCurrency(filteredCustomers.reduce((sum, c) => sum + (c.totalDebtOwed || 0), 0))}</p>
            </div>
            <div className="card bg-white p-4 rounded-xl shadow-sm" data-tooltip-id="overdue-customers-tooltip">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-900">Customers with Overdue Debts</h3>
                <div className="p-2 bg-orange-100 mr-2 rounded-md">
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="text-xl font-bold mt-2">{filteredCustomers.filter(c => c.debts?.some(debt => debt.status === 'overdue')).length}</p>
            </div>
            <div className="card bg-white p-4 rounded-xl shadow-sm" data-tooltip-id="average-days-overdue-tooltip">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-900">Average Days Overdue</h3>
                <div className="p-2 bg-purple-100 mr-2 rounded-md">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-xl font-bold mt-2">{calculateAverageDaysOverdue()}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="relative" data-tooltip-id="search-tooltip">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="input-field pl-10 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative" data-tooltip-id="debt-status-filter-tooltip">
                <select
                  className="select-field w-full"
                  value={debtStatusFilter}
                  onChange={(e) => setDebtStatusFilter(e.target.value)}
                >
                  <option value="all">All Debt Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="flex items-center gap-2" data-tooltip-id="debt-range-filter-tooltip">
                <input
                  type="number"
                  placeholder="Min Debt"
                  className="input-field flex-1"
                  value={debtRange.min}
                  onChange={(e) => setDebtRange(prev => ({ ...prev, min: e.target.value }))}
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  placeholder="Max Debt"
                  className="input-field flex-1"
                  value={debtRange.max}
                  onChange={(e) => setDebtRange(prev => ({ ...prev, max: e.target.value }))}
                />
              </div>

              <div className="relative" data-tooltip-id="debt-count-filter-tooltip">
                <input
                  type="number"
                  placeholder="Number of Debts"
                  className="input-field w-full"
                  value={debtCountFilter}
                  onChange={(e) => setDebtCountFilter(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>

              <div className="flex items-center" data-tooltip-id="send-message-tooltip">
                <button
                  onClick={handleOpenSendMessage}
                  className="btn-primary text-sm px-4 py-2 rounded-md text-white hover:bg-blue-700 transition-colors w-full flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Send Message to {filteredCustomers.length} Customers</span>
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card loading">
                  <div className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search.' : 'No customers have been added yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.phoneNumber}
                  className="card relative bg-white p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-blue-200 cursor-pointer group"
                  onClick={() => handleCardClick(customer)}
                  data-tooltip-id={`customer-tooltip-${customer.phoneNumber}`}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-100 mr-2 rounded-md">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{customer.name}</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">{customer.phoneNumber}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Store className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">{customer.shopName || 'N/A'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">{customer.location || 'N/A'}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">Debts: {customer.debtIds.length}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">Total Owed: {formatCurrency(customer.totalDebtOwed)}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-700">Created: {formatTimestamp(customer.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      View Debt Details
                    </span>
                  </div>
                  <Tooltip
                    id={`customer-tooltip-${customer.phoneNumber}`}
                    place="top"
                    style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
                  >
                    View {customer.name}'s debt details
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </main>

        <Tooltip
          id="search-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Tafuta Wateja: Tumia jina, namba ya simu, jina la duka, au eneo
        </Tooltip>
        <Tooltip
          id="dashboard-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Rudi kwa Dashibodi
        </Tooltip>
        <Tooltip
          id="debt-status-filter-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Filter by Debt Status
        </Tooltip>
        <Tooltip
          id="debt-range-filter-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Filter by Total Debt Owed Range
        </Tooltip>
        <Tooltip
          id="debt-count-filter-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Enter exact number of debts to filter by
        </Tooltip>
        <Tooltip
          id="send-message-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Send a custom SMS to filtered customers
        </Tooltip>
        <Tooltip
          id="overdue-customers-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          This metric helps prioritize high-risk customers for outreach
        </Tooltip>
        <Tooltip
          id="average-days-overdue-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Average days overdue for customers with overdue debts
        </Tooltip>
        <Tooltip
          id="unmatched-debt-total-tooltip"
          place="top"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Total debt amount for debt codes not found in fetched debt data
        </Tooltip>
      </div>
    </Layout>
  );
}