import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { CreditCard, Calendar, DollarSign, User, Cpu, AlertTriangle, Mail, Phone, User2, ArrowLeft, Store, Truck, MapPin, Edit, Trash2, FileText } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, app } from '../lib/firebase';

const db = getFirestore(app);

export default function DebtLogsPage() {
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [debtDetails, setDebtDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createdBy, setCreatedBy] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editForm, setEditForm] = useState({
    storeName: '',
    storeOwnerName: '',
    storeOwnerEmail: '',
    storeLocation: '',
    dueDate: '',
    amount: 0,
  });
  const router = useRouter();
  const { debtId } = router.query;

  useEffect(() => {
    const checkUserRole = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(userData.role === 'admin');
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          toast.error('Failed to verify user role');
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkUserRole();
  }, []);

  const fetchDebtAndCustomer = async (debtId) => {
    try {
      const debtRef = doc(db, 'debts', debtId);
      const debtSnap = await getDoc(debtRef);
      if (debtSnap.exists()) {
        const debtData = debtSnap.data();
        console.log('Fetched debt data:', debtData);
        
        setCreatedBy(debtData.createdBy || 'Unknown');
        setCustomer({
          name: debtData.storeOwner?.name || 'N/A',
          email: debtData.storeOwner?.email || 'N/A',
          phone: debtData.storeOwner?.phoneNumber || 'N/A',
        });
        setDebtDetails({
          storeName: debtData.store?.name || 'N/A',
          storeLocation: debtData.store?.location || 'N/A',
          vehiclePlate: debtData.vehiclePlate || 'N/A',
          salesRep: debtData.salesRep || 'N/A',
          amount: debtData.amount || 0,
          remainingAmount: debtData.remainingAmount || 0,
          dueDate: debtData.dueDate || 'N/A',
          status: debtData.status || 'N/A',
          locationCoordinates: debtData.locationCoordinates || { latitude: 0, longitude: 0 },
        });
        setEditForm({
          storeName: debtData.store?.name || '',
          storeOwnerName: debtData.storeOwner?.name || '',
          storeOwnerEmail: debtData.storeOwner?.email || '',
          storeLocation: debtData.store?.location || '',
          dueDate: debtData.dueDate ? new Date(debtData.dueDate.toDate()).toISOString().split('T')[0] : '',
          amount: debtData.amount || 0,
        });
      } else {
        toast.error('Debt not found');
        setCreatedBy('Unknown');
        setCustomer(null);
        setDebtDetails(null);
      }
    } catch (error) {
      console.error('Error fetching debt:', error);
      toast.error(error.message || 'Failed to fetch debt details');
      setCreatedBy('Unknown');
      setCustomer(null);
      setDebtDetails(null);
    }
  };

  const fetchPaymentLogs = async (debtId) => {
    try {
      setLoading(true);
      const paymentLogsRef = collection(db, 'payment_logs');
      const snapshot = await getDocs(paymentLogsRef);
      const allLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const filteredLogs = allLogs.filter(log => log.debtId === debtId);
      setPaymentLogs(filteredLogs);
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      toast.error(error.message || 'Failed to fetch payment logs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDebt = async () => {
    try {
      const newAmount = parseFloat(editForm.amount);
      if (isNaN(newAmount) || newAmount < 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      const remainingAmount = debtDetails.remainingAmount; // Preserve existing remainingAmount
      let newStatus;
      if (remainingAmount === 0) {
        newStatus = 'paid';
      } else if (remainingAmount > 0 && remainingAmount < newAmount) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'pending';
      }

      const debtRef = doc(db, 'debts', debtId);
      await updateDoc(debtRef, {
        store: {
          name: editForm.storeName,
          location: editForm.storeLocation,
        },
        storeOwner: {
          name: editForm.storeOwnerName,
          email: editForm.storeOwnerEmail,
          phoneNumber: customer?.phone || '', // Preserve existing phone number
        },
        dueDate: editForm.dueDate ? new Date(editForm.dueDate) : null,
        amount: newAmount,
        status: newStatus,
      });
      toast.success('Debt updated successfully!');
      setShowEditModal(false);
      await fetchDebtAndCustomer(debtId); // Refresh debt details
    } catch (error) {
      console.error('Error updating debt:', error);
      toast.error(error.message || 'Failed to update debt');
    }
  };

  const handleDeleteDebt = async () => {
    try {
      const debtRef = doc(db, 'debts', debtId);
      await deleteDoc(debtRef);
      toast.success('Debt deleted successfully!');
      setShowDeleteModal(false);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting debt:', error);
      toast.error(error.message || 'Failed to delete debt');
    }
  };

  useEffect(() => {
    if (debtId && router.isReady && isAdmin) {
      fetchDebtAndCustomer(debtId);
      fetchPaymentLogs(debtId);
    } else if (router.isReady && !isAdmin) {
      setLoading(false);
    } else if (router.isReady) {
      toast.error('No debt ID provided');
      setLoading(false);
    }
  }, [debtId, router.isReady, isAdmin]);

  const formatTimestamp = (timestamp) => {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString('en-GB');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getPaymentMethodColor = (method) => {
    switch (method?.toLowerCase()) {
      case 'mpesa':
        return 'text-green-600 bg-green-100';
      case 'card':
        return 'text-blue-600 bg-blue-100';
      case 'cash':
        return 'text-purple-600 bg-purple-100';
      case 'bank':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProcessingType = (manualProcessed, isDuplicate) => {
    if (isDuplicate) {
      return {
        label: 'Duplicate Transaction',
        icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
        className: 'text-red-600 bg-red-100',
        tooltip: 'This transaction was marked as a duplicate during reconciliation'
      };
    }
    if (manualProcessed) {
      return {
        label: 'Manually Processed',
        icon: <User className="h-4 w-4 text-orange-600" />,
        className: 'text-orange-600 bg-orange-100',
        tooltip: 'This transaction was manually processed by a user'
      };
    }
    return {
      label: 'System Processed',
      icon: <Cpu className="h-4 w-4 text-blue-600" />,
      className: 'text-blue-600 bg-blue-100',
      tooltip: 'This transaction was automatically processed by the system'
    };
  };

  const handleViewLocation = () => {
    if (debtDetails?.locationCoordinates?.latitude && debtDetails?.locationCoordinates?.longitude) {
      router.push({
        pathname: '/map',
        query: {
          debtId,
          lat: debtDetails.locationCoordinates.latitude,
          lng: debtDetails.locationCoordinates.longitude,
          storeName: debtDetails.storeName,
          storeLocation: debtDetails.storeLocation,
        },
      });
    } else {
      toast.error('No valid location coordinates available');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 border-solid"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600">Not Authorized</h1>
          <p className="mt-2 text-gray-600">Only admins can access this page. Please contact support if you believe this is an error.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Customer Profile & Payment Logs</h1>
        </div>

        {/* Customer Profile Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 transition-all duration-300 hover:shadow-xl relative">
          <div className="flex gap-4 absolute top-4 right-4">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              aria-label="Edit debt"
            >
              <Edit className="h-4 w-4" />
              <span className="text-sm font-medium">Edit Debt</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              aria-label="Delete debt"
            >
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-medium">Delete Debt</span>
            </button>
            <button
              onClick={handleViewLocation}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              aria-label="View store location on map"
            >
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">View Location</span>
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-blue-100 flex items-center justify-center">
                <User2 className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
              </div>
            </div>
            {/* Customer Details */}
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-2">
                {customer?.name || 'Unknown Customer'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    Phone
                  </p>
                  <p className="text-sm sm:text-base text-gray-700">{customer?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    Email
                  </p>
                  <p className="text-sm sm:text-base text-gray-700">{customer?.email || 'N/A'}</p>
                </div>
              </div>
              {/* Debt Details */}
              {debtDetails && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Store className="h-4 w-4 text-gray-400" />
                    Debt Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Store Name</p>
                      <p className="text-sm sm:text-base text-gray-700">{debtDetails.storeName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Store Location</p>
                      <p className="text-sm sm:text-base text-gray-700">{debtDetails.storeLocation}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-gray-400" />
                        Vehicle Plate
                      </p>
                      <p className="text-sm sm:text-base text-gray-700">{debtDetails.vehiclePlate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Sales Representative</p>
                      <p className="text-sm sm:text-base text-gray-700">{debtDetails.salesRep}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-sm sm:text-base text-gray-700">{formatCurrency(debtDetails.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Remaining Amount</p>
                      <p className="text-sm sm:text-base text-gray-700">{formatCurrency(debtDetails.remainingAmount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="text-sm sm:text-base text-gray-700">
                        {debtDetails.dueDate ? formatTimestamp(debtDetails.dueDate) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p className={`text-sm sm:text-base font-medium ${debtDetails.status === 'pending' ? 'text-yellow-600' : debtDetails.status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                        {debtDetails.status.charAt(0).toUpperCase() + debtDetails.status.slice(1)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    <span className="font-medium">Debt ID:</span> {debtId} |{' '}
                    <span className="font-medium">Created by:</span> {createdBy}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowEditModal(false)}
          >
            <div 
              className="bg-white rounded p-4 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-yellow-600 mb-2">
                <Edit className="h-5 w-5" />
                <h3 className="text-base font-semibold">Edit Debt</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">Store Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.storeName}
                    onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Store Owner Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.storeOwnerName}
                    onChange={(e) => setEditForm({ ...editForm, storeOwnerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Store Owner Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.storeOwnerEmail}
                    onChange={(e) => setEditForm({ ...editForm, storeOwnerEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Store Location</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.storeLocation}
                    onChange={(e) => setEditForm({ ...editForm, storeLocation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Due Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Amount</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-sm bg-gray-100 hover:bg-gray-200 rounded p-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditDebt}
                  className="text-sm bg-blue-100 hover:bg-blue-200 rounded p-2"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <div 
              className="bg-white rounded p-4 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-base font-semibold">Confirm Delete</h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete debt <span className="font-medium">#{debtId}</span>? This action cannot be undone.
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-sm bg-gray-100 hover:bg-gray-200 rounded p-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDebt}
                  className="text-sm bg-red-100 hover:bg-red-200 rounded p-2"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Logs Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Payment History</h2>
          {paymentLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No payment logs found for this debt.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {paymentLogs.map((log) => {
                const processingType = getProcessingType(log.manualProcessed, log.isDuplicate);
                return (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 bg-gray-50 shadow-sm hover:shadow-md transition-shadow duration-200"
                    role="article"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                        <span className={`text-sm font-bold ${log.isDuplicate ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          Reference: {log.reference || 'N/A'}
                        </span>
                      </div>
                      <span className={`text-sm font-medium px-2 py-1 rounded ${log.isDuplicate ? 'text-red-600 bg-red-100' : log.success ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                        {log.isDuplicate ? 'Duplicate' : log.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className={`text-sm text-gray-600 ${log.isDuplicate ? 'line-through' : ''}`}>
                        Amount: {formatCurrency(log.amount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className={`text-sm text-gray-600 ${log.isDuplicate ? 'line-through' : ''}`}>
                        Processed: {formatTimestamp(log.processedAt)}
                      </span>
                    </div>
                    {log.paymentMethod === 'bank' && log.manualProcessed && log.transactionCode && (
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className={`text-sm text-gray-600 ${log.isDuplicate ? 'line-through' : ''}`}>
                          Transaction Code: {log.transactionCode}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      {processingType.icon}
                      <span
                        className={`text-sm font-medium px-2 py-1 rounded ${processingType.className}`}
                        data-tooltip-id={`processing-type-tooltip-${log.id}`}
                      >
                        {processingType.label} {log.createdBy && !log.isDuplicate ? `by ${log.createdBy}` : ''}
                      </span>
                      <Tooltip
                        id={`processing-type-tooltip-${log.id}`}
                        place="top"
                        effect="solid"
                        style={{ backgroundColor: '#333', color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
                      >
                        {processingType.tooltip}
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium px-2 py-1 rounded ${getPaymentMethodColor(log.paymentMethod)} ${log.isDuplicate ? 'line-through' : ''}`}>
                        Method: {log.paymentMethod || 'N/A'}
                      </span>
                    </div>
                    {log.isDuplicate && (
                      <div className="text-sm text-gray-500 mt-2">
                        Reconciled at: {formatTimestamp(log.reconciledAt)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}