import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../pages/_app';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  CreditCard, 
  CheckCircle, 
  Package, 
  AlertCircle 
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Layout from '../components/Layout';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ManageSupplierDebts() {
  const [supplierDebts, setSupplierDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDisabled, setIsDisabled] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDebt, setNewDebt] = useState({
    supplierName: '',
    amount: '',
    description: '',
    dueDate: '',
  });
  const { user } = useAuth();
  const router = useRouter();

  // Check user status for disabled account
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
          toast.error('Failed to verify user status');
        }
      }
    };
    checkUserStatus();
  }, [user?.uid]);

  // Fetch supplier debts directly from Firestore
  const fetchSupplierDebts = async () => {
    try {
      setLoading(true);
      const debtsCollection = collection(db, 'supplierDebts');
      let debtsQuery = debtsCollection;
      
      if (statusFilter !== 'all') {
        debtsQuery = query(debtsCollection, where('status', '==', statusFilter));
      }

      const querySnapshot = await getDocs(debtsQuery);
      const debtsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSupplierDebts(debtsData);
    } catch (error) {
      console.error('Error fetching supplier debts:', error);
      toast.error('Failed to load supplier debts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSupplierDebts();
    }
  }, [user, statusFilter]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewDebt((prev) => ({ ...prev, [name]: value }));
  };

  // Handle creating a new supplier debt directly in Firestore
  const handleCreateDebt = async (e) => {
    e.preventDefault();
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    try {
      const debtsCollection = collection(db, 'supplierDebts');
      await addDoc(debtsCollection, {
        supplierName: newDebt.supplierName,
        amount: parseFloat(newDebt.amount),
        description: newDebt.description,
        dueDate: { seconds: new Date(newDebt.dueDate).getTime() / 1000 },
        status: 'pending',
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        lastUpdatedAt: { seconds: Math.floor(Date.now() / 1000) },
      });
      toast.success('Supplier debt created successfully!');
      setNewDebt({ supplierName: '', amount: '', description: '', dueDate: '' });
      setShowCreateForm(false);
      fetchSupplierDebts();
    } catch (error) {
      console.error('Error creating supplier debt:', error);
      toast.error('Failed to create supplier debt');
    }
  };

  // Handle marking a debt as paid directly in Firestore
  const handleMarkAsPaid = async (debtId) => {
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    try {
      const debtDocRef = doc(db, 'supplierDebts', debtId);
      await updateDoc(debtDocRef, {
        status: 'paid',
        lastUpdatedAt: { seconds: Math.floor(Date.now() / 1000) },
      });
      toast.success('Supplier debt marked as paid!');
      fetchSupplierDebts();
    } catch (error) {
      console.error('Error marking debt as paid:', error);
      toast.error('Failed to mark debt as paid');
    }
  };

  // Filter supplier debts for display (includes paid debts based on statusFilter)
  const filteredDebts = supplierDebts.filter((debt) =>
    (statusFilter === 'all' || debt.status === statusFilter) &&
    (debt.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     debt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter unpaid debts for statistics
  const unpaidDebts = supplierDebts.filter((debt) =>
    debt.status === 'pending' &&
    (statusFilter === 'all' || debt.status === statusFilter) &&
    (debt.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     debt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Compute statistics
  const stats = {
    total: unpaidDebts.length, // Only unpaid debts
    totalAmount: unpaidDebts.reduce((sum, debt) => sum + (debt.amount || 0), 0), // Sum of unpaid debts
    paid: supplierDebts.filter(d => d.status === 'paid').length, // Total paid debts
    totalPaid: supplierDebts.filter(d => d.status === 'paid').reduce((sum, debt) => sum + (debt.amount || 0), 0), // Sum of paid debts
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-GB');
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
              <h1 className="text-2xl font-bold text-gray-900">
                Manage Supplier Debts
              </h1>
              <div className="flex items-center space-x-4">
                <button
                  data-tooltip-id="create-supplier-debt-tooltip"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{showCreateForm ? 'Hide Create Debt' : 'Create Debt'}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 p-1 gap-6 mb-8">
            <div className="card" data-tooltip-id="total-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Supplier Debts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="card" data-tooltip-id="total-amount-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <CreditCard className="h-6 w-6 text-primary-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Amount</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="card" data-tooltip-id="paid-debts-tooltip">
              <div className="flex items-center">
                <div className="p-2 bg-success-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-success-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Paid Debts</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
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
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalPaid)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Supplier Debt Form (Conditionally Rendered) */}
          {showCreateForm && (
            <div className="mb-8 bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Supplier Debt</h2>
              <form onSubmit={handleCreateDebt} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
                  <input
                    type="text"
                    name="supplierName"
                    value={newDebt.supplierName}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Enter supplier name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount (KES)</label>
                  <input
                    type="number"
                    name="amount"
                    value={newDebt.amount}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Enter amount"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    name="description"
                    value={newDebt.description}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Enter description"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    value={newDebt.dueDate}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  />
                </div>
                <div className="md:col-span-2 flex space-x-4">
                  <button
                    type="submit"
                    className="btn-primary flex items-center space-x-2"
                    data-tooltip-id="submit-debt-tooltip"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Debt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="btn-secondary flex items-center space-x-2"
                    data-tooltip-id="cancel-create-tooltip"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md" data-tooltip-id="search-tooltip">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search supplier debts..."
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
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Supplier Debts List */}
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No supplier debts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating a new supplier debt.'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="card bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center mb-2">
                    <Package className="h-6 w-6 text-primary-600" />
                    <h3 className="ml-2 text-lg font-semibold text-gray-900">
                      {debt.supplierName}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600"><strong>Amount:</strong> {formatCurrency(debt.amount)}</p>
                  <p className="text-sm text-gray-600"><strong>Description:</strong> {debt.description}</p>
                  <p className="text-sm text-gray-600"><strong>Due Date:</strong> {formatTimestamp(debt.dueDate.seconds)}</p>
                  <p className="text-sm text-gray-600">
                    <strong>Status:</strong> 
                    <span className={`inline-block px-2 py-1 rounded ml-2 ${debt.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {debt.status}
                    </span>
                  </p>
                  {debt.status !== 'paid' && (
                    <button
                      onClick={() => handleMarkAsPaid(debt.id)}
                      className="btn-primary mt-4 flex items-center space-x-2"
                      data-tooltip-id="mark-paid-tooltip"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Mark as Paid</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Tooltips */}
        <Tooltip 
          id="create-supplier-debt-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          {showCreateForm ? 'Hide Create Debt Form' : 'Show Create Debt Form'}
        </Tooltip>
        <Tooltip 
          id="submit-debt-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Create New Supplier Debt
        </Tooltip>
        <Tooltip 
          id="cancel-create-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Cancel Debt Creation
        </Tooltip>
        <Tooltip 
          id="search-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Search Supplier Debts
        </Tooltip>
        <Tooltip 
          id="filter-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Filter by Status
        </Tooltip>
        <Tooltip 
          id="mark-paid-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Mark Debt as Paid
        </Tooltip>
        <Tooltip 
          id="total-debts-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Madeni ya Wauzaji: {stats.total} madeni
        </Tooltip>
        <Tooltip 
          id="total-amount-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Kiasi: {formatCurrency(stats.totalAmount)}
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
          id="total-paid-tooltip" 
          place="top"
          effect="solid"
          style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
        >
          Jumla ya Kiasi Kilicholipwa: {formatCurrency(stats.totalPaid)}
        </Tooltip>
      </div>
    </Layout>
  );
}