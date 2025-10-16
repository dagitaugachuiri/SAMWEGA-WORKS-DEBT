import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Plus, FileText, CreditCard, Users } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';
import StatsGrid from '../components/StatsGrid';
import Filters from '../components/Filters';
import DebtsGrid from '../components/DebtsGrid';
import DebtDetailModal from '../components/DebtDetailModal';
import PaymentModal from '../components/PaymentModal';
import TestModal from '../components/TestModal';
import UserMenu from '../components/UserMenu';
import { doc, getDoc } from 'firebase/firestore';

export default function Dashboard() {
  // State
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [vehiclePlateFilter, setVehiclePlateFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user } = useAuth();
  const [isDisabled, setIsDisabled] = useState(false);
  const [userData, setUserData] = useState(null);
  const router = useRouter();

  // Set search term from URL query parameter
  useEffect(() => {
    if (router.query.accountNumber) {
      setSearchTerm(decodeURIComponent(router.query.accountNumber));
    }
  }, [router.query.accountNumber]);

  // API Functions
  const fetchDebts = async () => {
    try {
      console.log('Fetching all debts');
      setLoading(true);
      const response = await apiService.debts.getAll({ limit: 10000 });
      
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

  // Effects
  useEffect(() => {
    if (user) {
      fetchDebts();
    }
  }, [user]);

  // useEffect(() => {
  //   const handleRouteChange = () => {
  //     if (user) {
  //       fetchDebts();
  //     }
  //   };

  //   router.events.on('routeChangeComplete', handleRouteChange);
  //   return () => {
  //     router.events.off('routeChangeComplete', handleRouteChange);
  //   };
  // }, [user, router.events]);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (user?.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserData(userDoc.data());
            setIsDisabled(userDoc.data().disabled || false);
            
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
    };

    checkUserStatus();
  }, [user?.uid]);

  // Handlers
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

  const handleCreateDebt = () => router.push('/create-debt');

  const handleReportsClick = () => router.push('/reports');
  const handlePaymentsClick = () => router.push('/payment-logs');
  const handleManageCustomers = () => router.push('/customers');

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

  // Filtering Logic
  const filteredDebts = debts.filter(debt => {
    const matchesSearch = (
      debt.storeOwner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.salesRep?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debt.createdBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

    const bankOptions = ['Equity', 'Old KCB', 'New KCB', 'Old Absa', 'New Absa', 'Family'];
    const matchesMethod = methodFilter === 'all'
      ? true
      : methodFilter === 'mpesa_paybill' || methodFilter === 'manual_mpesa' || methodFilter === 'cash'
        ? debt.paidPaymentMethod === methodFilter
        : methodFilter === 'cheque'
          ? debt.paymentMethod === methodFilter
          : bankOptions.includes(methodFilter) && debt.bankDetails?.some(detail => detail.bankName === methodFilter);

    const matchesStatus = statusFilter === 'all'
      ? true
      : debt.status === statusFilter;

    return matchesSearch && matchesVehiclePlate && matchesDate && matchesMethod && matchesStatus;
  });

  // Stats Calculation
  const stats = {
    total: filteredDebts.length,
    totalIssued: filteredDebts.reduce((sum, debt) => sum + debt.amount, 0),
    paid: filteredDebts.filter(d => d.status === 'paid').length,
    totalPaid: filteredDebts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0),
    totalOutstanding: filteredDebts.reduce((sum, debt) => sum + (debt.remainingAmount || 0), 0)
  };

  // Utility Functions
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

  // Render
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
        {/* Header */}
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
                {userData?.role === 'admin' && (
                  <>
                   <button
                  data-tooltip-id="reports-tooltip"
                  onClick={handlePaymentsClick}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>User Payments</span>
                </button>
               
                  </> 
                  )
                }
                <button
                  onClick={handleManageCustomers}
                  className="btn-secondary flex items-center space-x-2"
                  data-tooltip-id="customers-tooltip"
                >
                  <Users className="h-4 w-4" />
                  <span>Customers</span>
                </button>
                
                <UserMenu 
                  user={user}
                  isDisabled={isDisabled}
                  onLogout={handleLogout}
                  showUserMenu={showUserMenu}
                  setShowUserMenu={setShowUserMenu}
                />
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          <StatsGrid stats={stats} formatCurrency={formatCurrency} userData={userData} />
          
          <Filters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            methodFilter={methodFilter}
            onMethodChange={setMethodFilter}
            vehiclePlateFilter={vehiclePlateFilter}
            onVehiclePlateChange={setVehiclePlateFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            createDebtHandler={handleCreateDebt}
          />
          
          <DebtsGrid
            debts={debts}
            filteredDebts={filteredDebts}
            loading={loading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            methodFilter={methodFilter}
            vehiclePlateFilter={vehiclePlateFilter}
            dateRange={dateRange}
            onRefresh={fetchDebts}
            onPaymentClick={handlePaymentClick}
            onCardClick={handleCardClick}
          />
        </main>
      </div>

      {/* Modals */}
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

      {showTestModal && (
        <TestModal onClose={() => setShowTestModal(false)} />
      )}

      {showDetailModal && selectedDebt && (
        <DebtDetailModal
          selectedDebt={selectedDebt}
          onClose={() => setShowDetailModal(false)}
          formatCurrency={formatCurrency}
          formatTimestamp={formatTimestamp}
          onRefresh={fetchDebts}
        />
      )}

      {/* Tooltips */}
      <Tooltips stats={stats} formatCurrency={formatCurrency} />
    </Layout>
  );
}

// Separate Tooltips Component
function Tooltips({ stats, formatCurrency }) {
  return (
    <>
      <Tooltip id="total-debts-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Jumla ya Madeni: {stats.total} madeni
      </Tooltip>
      <Tooltip id="total-paid-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Jumla ya Malipo Yaliyofanywa: {formatCurrency(stats.totalPaid)}
      </Tooltip>
      <Tooltip id="paid-debts-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Madeni Yaliyolipwa: {stats.paid} madeni
      </Tooltip>
      <Tooltip id="outstanding-debts-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Madeni Yanayobaki: {formatCurrency(stats.totalOutstanding)}
      </Tooltip>
      <Tooltip id="search-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Tafuta Madeni: Tumia jina la mmiliki, jina la duka, namba ya deni, namba ya plate, jina la muundaji wa deni au eneo
      </Tooltip>
      <Tooltip id="filter-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Chagua Hali ya Madeni
      </Tooltip>
      <Tooltip id="method-filter-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Chagua Aina ya Malipo
      </Tooltip>
      <Tooltip id="vehicle-plate-filter-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Chuja kwa Namba ya Pasi ya Gari
      </Tooltip>
      <Tooltip id="date-filter-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Chuja kwa Tarehe
      </Tooltip>
      <Tooltip id="create-debt-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Unda Deni Jipya
      </Tooltip>
      <Tooltip id="create-first-debt-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Unda Deni la Kwanza
      </Tooltip>
      <Tooltip id="reports-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        View Reports
      </Tooltip>
      <Tooltip id="user-menu-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        User Menu
      </Tooltip>
      <Tooltip id="create-user-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Create New User
      </Tooltip>
      <Tooltip id="manage-users-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Manage Existing Users
      </Tooltip>
      <Tooltip id="supplier-debts-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Manage Supplier Debts
      </Tooltip>
      <Tooltip id="logout-tooltip" place="top" effect="solid" style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}>
        Toka
      </Tooltip>
    </>
  );
}