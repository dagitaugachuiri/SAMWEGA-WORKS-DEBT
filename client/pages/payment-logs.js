import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { useAuth } from './_app';
import { toast } from 'react-hot-toast';
import { DownloadIcon, Home, Clipboard, Check, Brain } from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, getDoc } from 'firebase/firestore';
import apiService from '../lib/api';

export default function PaymentLogs() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '2025-10-09', end: '' });
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const { user } = useAuth();
  const router = useRouter();
  const bankOptions = ['Equity', 'Old KCB', 'New KCB', 'Old Absa', 'New Absa', 'Family'];

  // AI Verification Prompt
  const aiPrompt = `
This is an instruction prompt. Do not respond or process until both files have been uploaded.

You will receive two files:
1. **Samwega Payment Log File** – records of payments received through the Samwega system (fields may include transaction code, payer name, amount, payment method, date, and reference).
2. **Bank Statement File** – the bank's transaction record containing both money-in (credits) and money-out (debits) entries.

Once both files are uploaded:
- Focus exclusively on **money-in (credit)** transactions from the bank statement.
- Cross-check all Samwega payment log entries against these bank credit records.
- Verify that every transaction in the Samwega log appears in the bank credits.
- Transaction codes in the Samwega log may have additional suffixes (e.g., "/samwega") or appended amounts in parentheses (e.g., "REF12345(1000)"). Strip these additions to match the core transaction code against the bank records.
- Match transactions based on amount, date (allowing a small margin for processing delays), and transaction reference.
- Transaction codes with appended amounts in parentheses (e.g., "REF12345(1000)") mean that the transaction amount is more than the debt amount in the Samwega Payment Log. In most cases the same transaction code will clear multiple debts. Ensure to match the full amount in such cases in the bank statement.

Return a structured markdown file report containing these Tabulated sections:
1. ✅ **Matching Transactions** – where amount, date (within a reasonable margin), and transaction reference align.
2. ⚠️ **Missing or Unmatched Transactions** – payments in the Samwega log not found in the bank credits.
3. 🔍 **Discrepancies** – mismatched amounts or dates between the two records.
4. 📊 **Summary Totals** – total transaction counts and total amounts from both sources (Samwega log vs. bank credits).

Guidelines:
- Process only after both files are uploaded.
- Ignore any money-out (debit) transactions in the bank file.
- Do not assume or infer any data that isn’t explicitly present.
- Provide the final report in a clear, precise, structured format for easy review.`;

  useEffect(() => {
    const fetchPaymentLogs = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "payment_logs"));
        const snapshot = await getDocs(q);
        const logsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
// Filter logs to include only those that were successfully processed(log.success==true) and from 9th October  2025 onwards
 
        const filteredLogs = logsData.filter(log => {
          const logDate = new Date(
            log.processedAt
              ? log.processedAt.seconds * 1000
              : log.createdAt
              ? log.createdAt.seconds * 1000
              : log.transactionDate?.seconds * 1000
          );
          return logDate >= new Date("2025-10-09") && log.success === true;
        });

  console.log("Fetched and filtered payment logs:", filteredLogs);
  
      
//this is the console log for each payment log. i want to create a func that fetches debt details using its debtId and append the debt details to each payment log object 
const fetchDebtDetails = async (debtId) => {
  try {
    const debtDoc = await getDoc(doc(db, 'debts', debtId));
    if (debtDoc.exists()) {
      return { id: debtDoc.id, ...debtDoc.data() };
    }
  } catch (error) {
    console.error('Error fetching debt details:', error);
  }
  return null;
};
        const logsWithDebtDetails = await Promise.all(
          filteredLogs.map(async (log) => {
            const debtDetails = log.debtId ? await fetchDebtDetails(log.debtId) : null;
            return { ...log, debtDetails };
          })
        );
        console.log("Payment logs with debt details:", logsWithDebtDetails);
        
        setLogs(logsWithDebtDetails);
      } catch (error) {
        console.error("Error fetching payment logs:", error);
        toast.error("Failed to load logs");
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

    const fetchVehicles = async () => {
      try {
        const vehiclesSnapshot = await getDocs(collection(db, 'vehicles'));
        const vehiclesData = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setVehicles(vehiclesData);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
        toast.error('Failed to load vehicles');
      }
    };
fetchVehicles();
    fetchUsers();
    fetchPaymentLogs();
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

  const handleAccountNumberClick = (accountNumber) => {
    if (/^\d{10}$/.test(accountNumber)) {
      router.push(`/customers?accountNumber=${encodeURIComponent(accountNumber)}`);
      return;
    }
    router.push(`/dashboard?accountNumber=${encodeURIComponent(accountNumber)}`);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);

      const grokUrl = `https://grok.com/?q=${encodeURIComponent(aiPrompt)}`;
      const newWindow = window.open(grokUrl, '_blank');

      if (!newWindow) {
        toast('Prompt copied to clipboard — please open your AI assistant and paste the prompt (popup blocked).');
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt or open Grok:', error);
      toast.error('Failed to copy prompt. Please copy it manually from the modal.');
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.senderName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.accountNumber?.includes(searchTerm) ||
      log.reference?.includes(searchTerm) ||
      log.phoneNumber?.includes(searchTerm) ||
      log.debtCode?.includes(searchTerm) ||
      log.transactionCode?.includes(searchTerm);

    const matchesUser = userFilter === 'all' ? true : log.createdBy === userFilter;
    const matchesVehicle = vehicleFilter === 'all' ? true : log.debtDetails?.vehiclePlate === vehicleFilter;
    const matchesVerification = verificationFilter === 'all' ? true : log.verified === (verificationFilter === 'verified');
    const matchesPaymentMethod = paymentMethodFilter === 'all'
        ? true
        : log.paymentMethod === 'mpesa_paybill' || log.paymentMethod === 'cash' || log.paymentMethod === 'mpesa'
        ? log.paymentMethod === paymentMethodFilter
        : log.paymentMethod === 'bank' && log.bankDetails?.bankName === paymentMethodFilter;

    const matchesDate =
      dateRange.start && dateRange.end
        ? (() => {
            const startDate = new Date(dateRange.start).getTime();
            const endDate = new Date(dateRange.end).getTime();
            const logDate =
              log.paymentMethod !== 'mpesa_paybill'
                ? log.processedAt?.seconds
                  ? log.processedAt.seconds * 1000
                  : new Date(log.processedAt?.replace(' ', ' ')).getTime() || null
                : log.transactionDate?.seconds
                ? log.transactionDate.seconds * 1000
                : null;
            return logDate !== null && !isNaN(logDate) && logDate >= startDate && logDate <= endDate;
          })()
        : true;

    return matchesSearch && matchesUser && matchesPaymentMethod && matchesDate && matchesVerification && matchesVehicle;
  });

  const stats = {
    total: filteredLogs.length,
    totalAmount: filteredLogs.reduce((sum, log) => sum + (log.amount || 0), 0),
    totalProcessed: filteredLogs.filter(log => log.success).length,
    totalVerified: filteredLogs.filter(log => log.verified).length
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);

  const generatePDF = async () => {
    try {
      const logsForServer = filteredLogs.map(log => ({
        ...log,
        processedAt: log.processedAt?.toDate ? log.processedAt.toDate().toISOString() : log.processedAt,
        transactionDate: log.transactionDate?.toDate ? log.transactionDate.toDate().toISOString() : log.transactionDate
      }));

      const response = await apiService.payments.generatePDF({ logs: logsForServer, stats });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment_logs_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF statement downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(error.response?.data?.error || 'Failed to generate PDF');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-semibold text-gray-900">Payment Statements</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Home className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Section */}
        <div className="bg-white rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <p className="text-2xl font-bold text-gray-900">{stats.totalVerified}</p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-7 gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="all">All Users</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>{u.name || u.email}</option>
            ))}
          </select>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="all">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.plateNumber}>{v.plateNumber}</option>
            ))}
          </select>
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
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
            min="2025-10-09"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          />
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 text-sm"
          >
            <option value="all">All verification statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('');
              setUserFilter('all');
              setPaymentMethodFilter('all');
              setVerificationFilter('all');
              setDateRange({ start: '', end: '' });
            }}
            className="bg-gray-200 hover:bg-gray-300 text-sm text-gray-800 font-semibold py-2 px-4 rounded-lg"
          >
            Reset
          </button>
          <button
            onClick={generatePDF}
            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center text-xs"
          >
            <DownloadIcon className="h-5 w-5 mr-2" />
            Download Statement
          </button>
          <button
            onClick={() => setShowAIModal(true)}
            className="bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-sky-700 transition duration-200 flex items-center text-xs"
          >
            <Brain className="h-5 w-5 mr-2" />
            Verify Transactions
          </button>
        </div>

        {/* Payment Logs Table */}
        <div className="bg-white rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center py-6 text-gray-600">Loading...</div>
          ) : filteredLogs.length > 0 ? (
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
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 transition duration-200 cursor-pointer"
                    onClick={() => handleLogClick(log)}
                  >
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAccountNumberClick(log.accountNumber);
                      }}
                    >
                      {log.accountNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(log.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.paymentMethod === 'mpesa_paybill' ? 'System processed/auto' : log.createdBy || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.processedAt
                        ? new Date(log.processedAt?.toDate()).toLocaleDateString()
                        : new Date(log.transactionDate?.toDate()).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.transactionCode || log.transactionId || log.chequeNumber || log.receiptNumber || log.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!log.verified) handleVerifyClick(log);
                        }}
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          log.verified
                            ? 'bg-green-100 text-green-700 border border-green-300'
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                        }`}
                      >
                        {log.verified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-6 text-gray-600">No logs found.</div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
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
                  : new Date(selectedLog.processedAt.replace(' ', ' ')).toLocaleString()
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

      {/* Verify Modal */}
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
                  : new Date(selectedLog.processedAt.replace(' ', ' ')).toLocaleString()
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

      {/* AI Verification Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl h-[450px] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Brain className="h-6 w-6 mr-2 text-purple-600" />
              Verify Transactions with AI
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              Copy the following prompt and paste it into your AI assistant to cross-check Samwega payment logs against the uploaded bank statement files.
            </p>
            <textarea
              readOnly
              value={aiPrompt.trim()}
              className="w-full h-[200px] p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-800 focus:outline-none"
            />
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handleCopyPrompt}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
              >
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                <span>{copied ? 'Copied!' : 'Open AI Assistant'}</span>
              </button>
              <button
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}