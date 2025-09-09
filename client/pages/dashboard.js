import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  LogOut, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Settings,
  TestTube,
  Send,
  FileText,
  Car,
  Calendar,
  UserPlus,
  Users,
  Package
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import DebtCard from '../components/DebtCard';
import PaymentModal from '../components/PaymentModal';
import TestModal from '../components/TestModal';
import Layout from '../components/Layout';
import { doc, getDoc } from 'firebase/firestore';

export default function Dashboard() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehiclePlateFilter, setVehiclePlateFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false); // State for user menu dropdown
  const { user } = useAuth();
    const [isDisabled, setIsDisabled] = useState(false);

  const router = useRouter();

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const response = await apiService.debts.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 600
      });
      
      if (response.data.success) {
        setDebts(response.data.data);
      } else {
        toast.error('Failed to load debts');
      }
    } catch (error) {
      console.error('Error fetching debts:', error);
      toast.error('Failed to load debts');
    } finally {
      setLoading(false);
    }
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
        } catch (error)   {
          console.error('Error checking user status:', error);
        }
      }
    };

    checkUserStatus();
  }, [user?.uid]);
  useEffect(() => {
    if (user) {
      fetchDebts();
    }
  }, [user, statusFilter]);

  useEffect(() => {
    const handleRouteChange = () => {
      if (user) {
        fetchDebts();
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [user, router.events]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  // Handle user menu actions
  const handleCreateUser = () => {
    setShowUserMenu(false);
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    router.push('/create-user');
  };

  const handleManageUsers = () => {
    setShowUserMenu(false);
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    router.push('/manage-users');
  };
  const handleManageSystem = () => {
    setShowUserMenu(false);
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    router.push('/system-management');
  };

  const filteredDebts = debts.filter(debt => {
    const matchesSearch = (
      debt.storeOwner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.salesRep?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (debt.debtCode || debt.sixDigitCode || '').includes(searchTerm) ||
      debt.store.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesVehiclePlate = vehiclePlateFilter
      ? debt.vehiclePlate?.toLowerCase().includes(vehiclePlateFilter.toLowerCase())
      : true;

    const matchesDate = dateRange.start && dateRange.end
      ? (() => {
          const startDate = new Date(dateRange.start).getTime() / 1000;
          const endDate = new Date(dateRange.end).getTime() / 1000; 
          const debtDate = debt.createdAt?.seconds || 0;
          return debtDate >= startDate && debtDate <= endDate;
        })()
      : true;

    return matchesSearch && matchesVehiclePlate && matchesDate;
  });

  const stats = {
    total: filteredDebts.length,
    totalIssued: filteredDebts.reduce((sum, debt) => sum + debt.amount, 0),
    paid: filteredDebts.filter(d => d.status === 'paid').length,
    totalPaid: filteredDebts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0),
    totalOutstanding: filteredDebts.reduce((sum, debt) => sum + (debt.remainingAmount || 0), 0)
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-GB');
  };

  const handlePaymentClick = (debt) => {
    setSelectedDebt(debt);
    setShowPaymentModal(true);
  };

  const handlePaymentProcessed = () => {
    setShowPaymentModal(false);
    setSelectedDebt(null);
    fetchDebts();
    toast.success('Payment processed successfully!');
  };

  const handleCardClick = (debt) => {
    setSelectedDebt(debt);
    setShowDetailModal(true);
  };

  const handleReportsClick = () => {
    router.push('/reports');
  };

  if (!user) {
    return null;
  }
  useEffect(() => {
    const checkUserStatus = async () => {
      if (user.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsDisabled(userData.disabled || false);
          }
        } catch (error)   {
          console.error('Error checking user status:', error);
        }
      }
    };

    checkUserStatus();
  }, [user.uid]);

  const handleManageSupplierDebts = () => {
  setShowUserMenu(false);
  if (isDisabled) {
    toast.error('Your account is disabled. Please contact support.');
    return;
  }
  router.push('/manage-supplier-debts');
};

   if (isDisabled) {
    return (
      <>
       
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-red-600">Account Disabled</h1>
            <p className="mt-2 text-gray-600">Your account has been disabled. Please contact support for assistance.</p>
          </div>
        </div>
      </>
    );
  }
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header section with Reports button and User Menu */}
       <header className="bg-white shadow-sm border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Samwega Debt Management
        </h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <button
          data-tooltip-id="reports-tooltip"
          onClick={handleReportsClick}
          className="btn-secondary flex items-center space-x-2"
        >
          <FileText className="h-4 w-4" />
          <span>Reports</span>
        </button>
        
        <button
          data-tooltip-id="supplier-debts-tooltip"
          onClick={handleManageSupplierDebts}
          className="btn-secondary flex items-center space-x-2"
        >
          <Package className="h-4 w-4" />
          <span>Manage Supplier Debts</span>
        </button>
        
        <div className="relative">
          <button
            data-tooltip-id="user-menu-tooltip"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
          >
            <span>{user.email}</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
              <button
                onClick={handleCreateUser}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
                data-tooltip-id="create-user-tooltip"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create User</span>
              </button>
              <button
                onClick={handleManageUsers}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
                data-tooltip-id="manage-users-tooltip"
              >
                <Users className="h-4 w-4" />
                <span>Manage Users</span>
              </button>
              <button
                onClick={handleManageSystem}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
                data-tooltip-id="manage-system-tooltip"
              >
                <Settings className="h-4 w-4" />
                <span>Manage System</span>
              </button>
              <button
                data-tooltip-id="logout-tooltip"
                onClick={handleLogout}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
</header>
        <main className="p-8">
          {/* Rest of the dashboard content remains unchanged */}
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-1 gap-6 mb-8">
            <div className="card" data-tooltip-id="total-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Debts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="card" data-tooltip-id="paid-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-success-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
                </div>
              </div>
            </div>

            <div className="card" data-tooltip-id="outstanding-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-danger-100 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-danger-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Outstanding</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(stats.totalOutstanding)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card" data-tooltip-id="total-paid-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-success-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Paid Amount</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(stats.totalPaid)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md" data-tooltip-id="search-tooltip">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search debts..."
                  className="input-field pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="relative" data-tooltip-id="filter-tooltip">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="select-field pl-10 pr-10"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Waiting Payment</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="relative flex-1 max-w-md" data-tooltip-id="vehicle-plate-filter-tooltip">
                <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by vehicle plate number"
                  className="input-field pl-10"
                  value={vehiclePlateFilter}
                  onChange={(e) => setVehiclePlateFilter(e.target.value)}
                />
              </div>

              <div className="flex gap-2 items-center" data-tooltip-id="date-filter-tooltip">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    className="input-field pl-10"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <span className="text-gray-500">to</span>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    className="input-field pl-10"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <button
              data-tooltip-id="create-debt-tooltip"
              onClick={() =>  router.push('/create-debt')}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create Debt</span>
            </button>
          </div>

          {/* Debts List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card loading">
                  <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : filteredDebts.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No debts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || vehiclePlateFilter || dateRange.start || dateRange.end
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating a new debt record.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && !vehiclePlateFilter && !dateRange.start && !dateRange.end && (
                <div className="mt-6">
                  <button
                    data-tooltip-id="create-first-debt-tooltip"
                    onClick={() => router.push('/create-debt')}
                    className="btn-primary flex items-center space-x-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create First Debt</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDebts.map((debt) => (
                <DebtCard
                  key={debt.id}
                  debt={debt}
                  onPaymentClick={handlePaymentClick}
                  onRefresh={fetchDebts}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </main>
        </div>
        {/* Payment Modal */}
        {showPaymentModal && selectedDebt && (
          <PaymentModal
            debt={selectedDebt}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedDebt(null);
            }}
            onSuccess={handlePaymentProcessed}
          />
        )}

        {/* Test Modal */}
        {showTestModal && (
          <TestModal
            onClose={() => setShowTestModal(false)}
          />
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedDebt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-2xl overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Debt Details</h2>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setShowDetailModal(false)}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3 text-gray-700">Debt Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Code:</strong> #{selectedDebt.debtCode}</p>
                    <p><strong>Status:</strong> <span className={`inline-block px-2 py-1 rounded ${selectedDebt.status === 'paid' ? 'bg-green-100 text-green-800' : selectedDebt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{selectedDebt.status}</span></p>
                    <p><strong>Total Amount:</strong> {formatCurrency(selectedDebt.amount)}</p>
                    <p><strong>Paid:</strong> {formatCurrency(selectedDebt.paidAmount || 0)}</p>
                    <p><strong>Outstanding:</strong> {formatCurrency(selectedDebt.remainingAmount || 0)}</p>
                    <p><strong>Due Date:</strong> {formatTimestamp(selectedDebt.dueDate.seconds)}</p>
                    <p><strong>Created At:</strong> {formatTimestamp(selectedDebt.createdAt.seconds)}</p>
                    <p><strong>Last Updated:</strong> {formatTimestamp(selectedDebt.lastUpdatedAt.seconds)}</p>
                    <p><strong>Last SMS Sent:</strong> {
                      selectedDebt.lastInvoiceSMSSent 
                        ? formatTimestamp(selectedDebt.lastInvoiceSMSSent.seconds)
                        : 'Not sent yet'
                    }</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3 text-gray-700">Store Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {selectedDebt.store.name}</p>
                    <p><strong>Location:</strong> {selectedDebt.store.location}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                  <h3 className="font-semibold text-lg mb-3 text-gray-700">Owner Information</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Name:</strong> {selectedDebt.storeOwner.name}</p>
                    <p><strong>Email:</strong> {selectedDebt.storeOwner.email}</p>
                    <p><strong>Phone:</strong> {selectedDebt.storeOwner.phoneNumber}</p>
                  </div>
                </div>

                {selectedDebt.vehiclePlate && (
                  <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
                    <h3 className="font-semibold text-lg mb-3 text-gray-700">Vehicle Information</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Plate Number:</strong> {selectedDebt.vehiclePlate || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 mt-4 flex justify-end space-x-3">
                {selectedDebt.status !== 'paid' && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await apiService.debts.resendInvoiceSMS(selectedDebt.id);
                        if (response.data.success) {
                          toast.success('Invoice SMS resent successfully!');
                          fetchDebts();
                        }
                      } catch (error) {
                        toast.error('Failed to resend invoice SMS');
                      }
                    }}
                    className="btn-outline flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Resend Invoice SMS</span>
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tooltip Components */}
        <Tooltip 
          id="total-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Madeni: {stats.total} madeni
        </Tooltip>
        <Tooltip 
          id="total-paid-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Malipo Yaliyofanywa: {formatCurrency(stats.totalPaid)}
        </Tooltip>
        <Tooltip 
          id="paid-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Madeni Yaliyolipwa: {stats.paid} madeni
        </Tooltip>
        <Tooltip 
          id="outstanding-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Madeni Yanayobaki: {formatCurrency(stats.totalOutstanding)}
        </Tooltip>
        <Tooltip 
          id="search-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Tafuta Madeni
        </Tooltip>
        <Tooltip 
          id="filter-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Chagua Hali ya Madeni
        </Tooltip>
        <Tooltip 
          id="vehicle-plate-filter-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Chuja kwa Namba ya Pasi ya Gari
        </Tooltip>
        <Tooltip 
          id="date-filter-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Chuja kwa Tarehe
        </Tooltip>
        <Tooltip 
          id="create-debt-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Unda Deni Jipya
        </Tooltip>
        <Tooltip 
          id="create-first-debt-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Unda Deni la Kwanza
        </Tooltip>
        <Tooltip 
          id="test-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jaribu Mfumo
        </Tooltip>
        <Tooltip 
          id="logout-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Toka
        </Tooltip>
        <Tooltip 
          id="reports-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          View Reports
        </Tooltip>
        <Tooltip 
          id="user-menu-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          User Menu
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
          id="manage-users-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Manage Existing Users
        </Tooltip>
        <Tooltip 
            id="supplier-debts-tooltip" 
            place="top"
            effect="solid"
            style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
          >
            Manage Supplier Debts
          </Tooltip>
      </Layout>
    );
}
