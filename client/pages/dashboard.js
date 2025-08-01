import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
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
  TestTube
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';

// Components
import DebtCard from '../components/DebtCard';
import PaymentModal from '../components/PaymentModal';
import TestModal from '../components/TestModal';
import Layout from '../components/Layout';

export default function Dashboard() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const { user } = useAuth();
  const router = useRouter();

  // Fetch debts
  const fetchDebts = async () => {
    try {
      setLoading(true);
      const response = await apiService.debts.getAll({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100
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

  const filteredDebts = debts.filter(debt => 
    debt.storeOwner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debt.store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (debt.debtCode || debt.sixDigitCode || '').includes(searchTerm) ||
    debt.store.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: debts.length,
    pending: debts.filter(d => d.status === 'pending').length,
    paid: debts.filter(d => d.status === 'paid').length,
    partiallyPaid: debts.filter(d => d.status === 'partially_paid').length,
    overdue: debts.filter(d => d.status === 'overdue').length,
    totalAmount: debts.reduce((sum, debt) => sum + debt.amount, 0),
    totalPaid: debts.reduce((sum, debt) => sum + (debt.paidAmount || 0), 0),
    totalOutstanding: debts.reduce((sum, debt) => sum + (debt.remainingAmount || debt.amount), 0)
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
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

  if (!user) {
    return null;
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
                  data-tooltip-id="test-tooltip"
                  onClick={() => setShowTestModal(true)}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <TestTube className="h-4 w-4" />
                  <span>Test System</span>
                </button>
                
                <div className="text-sm text-gray-600">
                  {user.email}
                </div>
                
                <button
                  data-tooltip-id="logout-tooltip"
                  onClick={handleLogout}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

            <div className="card" data-tooltip-id="pending-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-warning-100 rounded-lg">
                  <Clock className="h-6 w-6 text-warning-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
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
          </div>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
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

              {/* Filter */}
              <div className="relative" data-tooltip-id="filter-tooltip">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  className="select-field pl-10 pr-10"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            {/* Create Debt Button */}
            <button
              data-tooltip-id="create-debt-tooltip"
              onClick={() => router.push('/create-debt')}
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
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filter.' 
                  : 'Get started by creating a new debt record.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
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
                  onPaymentClick={() => handlePaymentClick(debt)}
                  onRefresh={fetchDebts}
                />
              ))}
            </div>
          )}
        </main>

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
          <TestModal
            onClose={() => setShowTestModal(false)}
          />
        )}

        {/* Tooltip Component */}
        <Tooltip 
          id="total-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Madeni: {stats.total} madeni
        </Tooltip>
        <Tooltip 
          id="pending-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Madeni Yanayosubiri: {stats.pending} madeni
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
      </div>
    </Layout>
  );
}