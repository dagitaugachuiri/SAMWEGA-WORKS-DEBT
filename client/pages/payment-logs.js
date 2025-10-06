import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { toast } from 'react-hot-toast';
import { Home, User, Upload } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function PaymentLogs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [file, setFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Define bank options
  const bankOptions = ['Equity', 'Old KCB', 'New KCB', 'Old Absa', 'New Absa', 'Family'];

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const logsSnapshot = await getDocs(collection(db, 'payment_logs'));
        const logsData = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching logs:', error);
        toast.error('Failed to load payment logs');
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users');
      }
    };

    fetchLogs();
    fetchUsers();
  }, []);

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

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const handleVerifyClick = async (log) => {
    setSelectedLog(log);
    setShowVerifyModal(true);
  };

  const confirmVerify = async () => {
    if (selectedLog) {
      try {
        await updateDoc(doc(db, 'payment_logs', selectedLog.id), { verified: true });
        setLogs(logs.map(l => l.id === selectedLog.id ? { ...l, verified: true } : l));
        toast.success('Transaction verified successfully');
        setShowVerifyModal(false);
      } catch (error) {
        console.error('Error verifying transaction:', error);
        toast.error('Failed to verify transaction');
      }
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (
      log.senderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.accountNumber?.includes(searchTerm) ||
      log.reference?.includes(searchTerm) ||
      log.phoneNumber?.includes(searchTerm) ||
      log.debtCode?.includes(searchTerm) ||
      log.transactionCode?.includes(searchTerm)
    );

    const matchesUser = userFilter === 'all' ? true : log.createdBy === userFilter;
    const matchesVerification = verificationFilter === 'all' ? true : log.verified === (verificationFilter === 'verified');
    const matchesPaymentMethod = paymentMethodFilter === 'all'
      ? true
      : log.paymentMethod === 'mpesa_paybill' || log.paymentMethod === 'cash' || log.paymentMethod === 'mpesa'
        ? log.paymentMethod === paymentMethodFilter
        : log.paymentMethod === 'bank' && log.bankDetails?.bankName === paymentMethodFilter;

    const matchesDate = dateRange.start && dateRange.end
      ? (() => {
          const startDate = new Date(dateRange.start).getTime();
          const endDate = new Date(dateRange.end).getTime();
          const logDate = log.paymentMethod !== 'mpesa_paybill'
            ? (log.processedAt?.seconds ? log.processedAt.seconds * 1000 : new Date(log.processedAt?.replace(' ', ' ')).getTime() || null)
            : (log.transactionDate?.seconds ? log.transactionDate.seconds * 1000 : null);
          return logDate !== null && !isNaN(logDate) && logDate >= startDate && logDate <= endDate;
        })()
      : true;

    return matchesSearch && matchesUser && matchesPaymentMethod && matchesDate && matchesVerification;
  });

  const stats = {
    total: filteredLogs.length,
    totalAmount: filteredLogs.reduce((sum, log) => sum + (log.amount || 0), 0),
    totalProcessed: filteredLogs.filter(log => log.success).length,
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!paymentMethodFilter || paymentMethodFilter === 'all' || !bankOptions.includes(paymentMethodFilter) || !file) {
      toast.error('Please select a bank payment method and upload a file');
      return;
    }

    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bank', paymentMethodFilter);

    try {
      const res = await fetch('/api/process-statement', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success('Statement processed successfully');
        const logsSnapshot = await getDocs(collection(db, 'payment_logs'));
        const logsData = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(logsData);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to process statement');
      }
    } catch (error) {
      console.error('Error processing statement:', error);
      toast.error('Error processing statement');
    } finally {
      setImportLoading(false);
      setShowImportModal(false);
      setFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-semibold text-gray-900">Payment statements</h1>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition duration-200"
              >
                <Home className="h-5 w-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
       

        <div className="bg-white rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Total Logs</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Total Amount</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Total Processed</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProcessed}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-600">Total Verified</h3>
              <p className="text-2xl font-bold text-gray-900">{filteredLogs.filter(log => log.verified).length}</p>
            </div>
          </div>
        </div>
 <div className="bg-white rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            >
              <option value="all">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.name}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            >
              <option value="all">All Methods</option>
              <option value="mpesa_paybill">M-Pesa Paybill (Auto)</option>
              <option value="cash">Cash (Manual)</option>
              <option value="mpesa">M-Pesa (Manual)</option>
              {bankOptions.map(bank => (
                <option key={bank} value={bank}>{`Bank - ${bank}`}</option>
              ))}
            </select>
            <input 
              type="date"
              min="2025-10-01"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            />
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
            >
              <option value="all">All verification statuses</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
            <div className="flex">
              <button
                onClick={() => { 
                  setSearchTerm('');
                  setUserFilter('all');
                  setPaymentMethodFilter('all');
                  setDateRange({ start: '', end: '' });
                  setVerificationFilter('all');
                }}  
                className="bg-gray-200 hover:bg-gray-300 text-sm text-gray-800 font-semibold py-2 px-4 rounded-lg"
              >
                Reset Filters
              </button>
             
            </div>
             {bankOptions.includes(paymentMethodFilter) && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-blue-600 text-white font-semibold py-2 px-4 w-full rounded-lg hover:bg-blue-700 transition duration-200 flex items-center text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Import Statement
                </button>
              )}
          </div>
        </div>
        <div className="bg-white rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center py-6 text-gray-600">Loading...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Account Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Processed By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Transaction Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition duration-200 cursor-pointer" onClick={() => handleLogClick(log)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.accountNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(log.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.paymentMethod === 'mpesa_paybill' ? 'System processed/auto' : log.createdBy || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.processedAt 
                        ? new Date(log.processedAt.toDate()).toLocaleDateString() 
                        : new Date(log.transactionDate.toDate()).toLocaleDateString() 
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.transactionCode || log.transactionId || log.chequeNumber || log.paymentMethod}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          log.verified
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        }`}
                        onClick={(e) => { e.stopPropagation(); log.verified ? null : handleVerifyClick(log); }}
                      >
                        {log.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filteredLogs.length === 0 && !loading && <div className="text-center py-6 text-gray-600">No logs found.</div>}
        </div>
      </main>

      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Payment Log Details</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <p><strong className="text-gray-900">Account Number:</strong> {selectedLog.accountNumber}</p>
              <p><strong className="text-gray-900">Amount:</strong> {formatCurrency(selectedLog.amount)}</p>
              <p><strong className="text-gray-900">Processed By:</strong> {selectedLog.paymentMethod === 'mpesa_paybill' ? 'System' : selectedLog.createdBy || 'Unknown'}</p>
              <p><strong className="text-gray-900">Payment Method:</strong> {selectedLog.paymentMethod === 'bank' ? `Bank - ${selectedLog.bankDetails?.bankName || 'Unknown'}` : selectedLog.paymentMethod}</p>
              <p><strong className="text-gray-900">Transaction Date:</strong> {selectedLog.processedAt 
                ? (selectedLog.processedAt.toDate 
                  ? new Date(selectedLog.processedAt.toDate()).toLocaleString() 
                  : new Date(selectedLog.processedAt.replace(' ', ' ')).toLocaleString()
                ) || 'N/A'
                : 'N/A'}</p>
              <p><strong className="text-gray-900">Transaction Code:</strong> {selectedLog.transactionCode || selectedLog.transactionId || selectedLog.chequeNumber || selectedLog.paymentMethod}</p>
              <p><strong className="text-gray-900">Status:</strong> {selectedLog.success ? 'Success' : 'Failed'}</p>
              <p><strong className="text-gray-900">Verified:</strong> {selectedLog.verified ? 'Yes' : 'No'}</p>
            </div>
            <button
              onClick={() => setShowDetailModal(false)}
              className="mt-6 w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showVerifyModal && selectedLog && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Confirm Verification</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <p>Are you sure you want to verify this transaction?</p>
              <p><strong>Account Number:</strong> {selectedLog.accountNumber}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedLog.amount)}</p>
              <p><strong>Transaction Date:</strong> {selectedLog.processedAt 
                ? (selectedLog.processedAt.toDate 
                  ? new Date(selectedLog.processedAt.toDate()).toLocaleString() 
                  : new Date(selectedLog.processedAt.replace(' ', ' ')).toLocaleString()
                ) || 'N/A'
                : 'N/A'}</p>
              <p><strong>Transaction Code:</strong> {selectedLog.transactionCode || selectedLog.transactionId || selectedLog.chequeNumber || selectedLog.paymentMethod}</p>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition duration-200"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setLoading(true);
                  await confirmVerify();
                  setLoading(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                ) : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Import {paymentMethodFilter} Statement</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">Selected Bank: <strong>{paymentMethodFilter}</strong></p>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-teal-500 transition duration-200"
              >
                {file ? (
                  <p className="text-gray-700">File: {file.name}</p>
                ) : (
                  <p className="text-gray-500">Drag and drop file here or click to select</p>
                )}
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-teal-600 hover:underline">
                  Select File
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setFile(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition duration-200"
                disabled={importLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center"
                disabled={importLoading || !file}
              >
                {importLoading ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                ) : null}
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}