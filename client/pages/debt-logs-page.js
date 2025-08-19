import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { CreditCard, Calendar, DollarSign, User, Cpu, AlertTriangle } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { app } from '../lib/firebase';

const db = getFirestore(app);

export default function DebtLogsPage() {
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createdBy, setCreatedBy] = useState(null);
  const router = useRouter();

  const { debtId } = router.query;

  const fetchDebt = async (debtId) => {
    try {
      const debtRef = doc(db, 'debts', debtId);
      const debtSnap = await getDoc(debtRef);
      if (debtSnap.exists()) {
        setCreatedBy(debtSnap.data().createdBy || 'Unknown');
      } else {
        toast.error('Debt not found');
        setCreatedBy('Unknown');
      }
    } catch (error) {
      console.error('Error fetching debt:', error);
      toast.error(error.message || 'Failed to fetch debt details');
      setCreatedBy('Unknown');
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

  useEffect(() => {
    if (debtId && router.isReady) {
      fetchDebt(debtId);
      fetchPaymentLogs(debtId);
    } else if (router.isReady) {
      toast.error('No debt ID provided');
      setLoading(false);
    }
  }, [debtId, router.isReady]);

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

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Loading payment logs...</div>;
  }

  if (!paymentLogs.length) {
    return <div className="p-4 text-sm text-gray-600">No payment logs found for this debt.</div>;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Payment Logs</h2>
      <p className="text-sm text-gray-500 mb-4">Showing logs for Debt ID: {debtId} (Created by: {createdBy})</p>
      <div className="space-y-4">
        {paymentLogs.map((log) => {
          const processingType = getProcessingType(log.manualProcessed, log.isDuplicate);
          return (
            <div key={log.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className={`text-sm font-bold ${log.isDuplicate ? 'line-through text-gray-500' : ''}`}>
                    Reference: {log.reference || 'N/A'}
                  </span>
                </div>
                <span className={`text-sm font-medium ${log.isDuplicate ? 'text-red-600' : log.success ? 'text-green-600' : 'text-red-600'}`}>
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
    </div>
  );
}