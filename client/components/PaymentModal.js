import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../lib/api';
import { useAuth } from '../pages/_app';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function PaymentModal({ debt, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('');
  const [creatorName, setCreatorName] = useState('Unknown');
  const [showInstructions, setShowInstructions] = useState(false);
  const chequeDetailsRef = useRef(null);
  const mpesaDetailsRef = useRef(null);
  const bankDetailsRef = useRef(null);
  const formRef = useRef(null);
  const { user } = useAuth();

  // Fetch creator's name from Firestore
  useEffect(() => {
    const fetchCreatorName = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setCreatorName(userDoc.data().name || 'Unknown');
          } else {
            setCreatorName('Unknown');
          }
        } catch (error) {
          console.error('Error fetching creator name:', error);
          setCreatorName('Unknown');
          setError('Failed to load creator name');
        }
      }
    };

    fetchCreatorName();
  }, [user?.uid]);

  useEffect(() => {
    const chequeDetails = chequeDetailsRef.current;
    const mpesaDetails = mpesaDetailsRef.current;
    const bankDetails = bankDetailsRef.current;

    if (chequeDetails && mpesaDetails && bankDetails) {
      chequeDetails.classList.toggle('hidden', paymentMethod !== 'cheque');
      mpesaDetails.classList.toggle('hidden', paymentMethod !== 'mpesa');
      bankDetails.classList.toggle('hidden', paymentMethod !== 'bank');
    }
  }, [paymentMethod]);

  const validateForm = (formData) => {
    const errors = {};
    const paymentMethod = formData.get('paymentMethod');
    const amount = formData.get('amount');
    const bankName = formData.get('bankName');
    const transactionCode = formData.get('transactionCode');
    const chequeNumber = formData.get('chequeNumber');
    const chequeDate = formData.get('chequeDate');
    const paymentDate = formData.get('paymentDate');
    const phoneNumber = formData.get('phoneNumber') || debt.storeOwner.phoneNumber;

    if (!amount || parseFloat(amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }

    if (!paymentMethod) {
      errors.paymentMethod = 'Payment method is required';
    }

    if (paymentMethod !== 'cheque' && !paymentDate) {
      errors.paymentDate = 'Payment date is required';
    }

    if (paymentMethod === 'mpesa') {
      if (!phoneNumber.match(/^\+254[17]\d{8}$/)) {
        errors.phoneNumber = 'Invalid phone number format (+254XXXXXXXXX)';
      }
      if (!transactionCode) {
        errors.transactionCode = 'Transaction code is required';
      }
    }

    if (paymentMethod === 'cheque') {
      if (!chequeNumber) {
        errors.chequeNumber = 'Cheque number is required';
      }
      if (!bankName) {
        errors.bankName = 'Bank name is required';
      }
      if (!chequeDate) {
        errors.chequeDate = 'Cheque date is required';
      }
    }

    if (paymentMethod === 'bank') {
      if (!bankName) {
        errors.bankName = 'Bank name is required';
      }
      if (!transactionCode) {
        errors.transactionCode = 'Transaction code is required';
      }
    }

    return errors;
  };

 
    function parseTransactionCode(code) {
      const match = code.match(/^(.+?)(?:\((\d+(?:\.\d+)?)\))?$/);
      if (!match) return { baseCode: code.trim(), declaredTotal: null };
      return {
        baseCode: match[1].trim(),
        declaredTotal: match[2] ? parseFloat(match[2]) : null,
      };
    }


  async function checkAndRegisterTransactionCode(transactionCode, amount, debtId, userId) {
    const { baseCode, declaredTotal } = parseTransactionCode(transactionCode);
    const docRef = doc(db, 'manual-transactions', baseCode);
    const docSnap = await getDoc(docRef);

    // CASE 1: Code doesn’t exist yet → register it
    if (!docSnap.exists()) {
      const totalAmount = declaredTotal || amount;
      await setDoc(docRef, {
        transactionCode: baseCode,
        totalAmount,
        remainingAmount: totalAmount - amount,
        usedAmounts: [
          {
            debtId,
            usedBy: userId,
            amount,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: serverTimestamp(),
      });
      return { valid: true };
    }

    // CASE 2: Code exists
    const data = docSnap.data();

    // If not a multi-debt transaction → reject re-use
    if (!data.totalAmount || data.totalAmount === data.usedAmounts[0]?.amount) {
      return { valid: false, error: 'This transaction code has already been used.' };
    }

    // Multi-debt case
    if (data.remainingAmount < amount) {
      return { valid: false, error: 'Insufficient remaining balance in this transaction code.' };
    }

    // Update remaining amount and add usage
    await updateDoc(docRef, {
      remainingAmount: data.remainingAmount - amount,
      usedAmounts: [
        ...data.usedAmounts,
        {
          debtId,
          usedBy: userId,
          amount,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return { valid: true };
  }


  const handleSubmit = async (e) => {

 e.preventDefault();

    const formData = new FormData(formRef.current);
  const transactionCode = formData.get('transactionCode')?.trim();

    if (transactionCode) {
      const txCheck = await checkAndRegisterTransactionCode(
        transactionCode,
        parseFloat(formData.get('amount')),
        debt.id,
        user.uid
      );

      if (!txCheck.valid) {
        setError(txCheck.error);
        setLoading(false);
        return;
      }
    }



    setLoading(true);
    setError(null);
    setFormErrors({});

    
    console.log('FormData entries:');
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: "${value}"`);
    }

    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setLoading(false);
      console.log('Client-side validation errors:', errors);
      return;
    }

    try {
      const paymentData = {
        createdBy: creatorName,
        createdByName: creatorName,
        amount: parseFloat(formData.get('amount')),
        paymentMethod: formData.get('paymentMethod'),
        phoneNumber: formData.get('phoneNumber') || debt.storeOwner.phoneNumber,
        ...(formData.get('paymentMethod') !== 'cheque' && {
          paymentDate: formData.get('paymentDate') || new Date().toISOString(),
        }),
        ...(formData.get('paymentMethod') === 'mpesa' && {
          transactionCode: formData.get('transactionCode')?.trim(),
        }),
        ...(formData.get('paymentMethod') === 'cheque' && {
          chequeNumber: formData.get('chequeNumber')?.trim(),
          bankName: formData.get('bankName')?.trim(),
          chequeDate: formData.get('chequeDate') || new Date().toISOString(),
        }),
        ...(formData.get('paymentMethod') === 'bank' && {
          bankDetails: {
            bankName: formData.get('bankName')?.trim(),
            amount: parseFloat(formData.get('amount')),
            transactionCode: formData.get('transactionCode')?.trim(),
          },
        }),
      };

      console.log('Submitting payment for debt:', debt.id, paymentData);

      const response = await apiService.debts.processPayment(debt.id, paymentData);
      console.log('Payment response:', response.data);

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.data.error || 'Failed to process payment');
      }
    } catch (err) {
      console.error('Payment error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'An error occurred while processing payment');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const bankOptions = [
    'Equity',
    'Old KCB',
    'New KCB',
    'Old Absa',
    'New Absa',
    'Family',
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Process Payment</h2>
          
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Debt #{debt.debtCode}</p>
          <p className="font-medium">{debt.storeOwner.name}</p>
          <p className="text-sm text-gray-600">
            Outstanding: {formatCurrency(debt.remainingAmount || debt.amount)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (KES)
              </label>
              <input
                type="number"
                name="amount"
                required
                min="1"
                max={debt.remainingAmount || debt.amount}
                className={`input-field w-full p-2 border rounded ${formErrors.amount ? 'border-red-500' : ''}`}
                placeholder="0"
              />
              {formErrors.amount && (
                <p className="text-red-500 text-sm mt-1">{formErrors.amount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                required
                className={`select-field w-full p-2 border rounded ${formErrors.paymentMethod ? 'border-red-500' : ''}`}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select payment method</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
              {formErrors.paymentMethod && (
                <p className="text-red-500 text-sm mt-1">{formErrors.paymentMethod}</p>
              )}
            </div>

            <div ref={mpesaDetailsRef} className="mpesa-details hidden" data-payment-method="mpesa">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  name="phoneNumber"
                  className={`input-field w-full p-2 border rounded ${formErrors.phoneNumber ? 'border-red-500' : ''}`}
                  placeholder="+254XXXXXXXXX"
                  defaultValue={debt.storeOwner.phoneNumber}
                  required={paymentMethod === 'mpesa'}
                  disabled={paymentMethod !== 'mpesa'}
                />
                {formErrors.phoneNumber && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.phoneNumber}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                  Transaction Code
                </label>
                <input
                  type="text"
                  name="transactionCode"
                  className={`input-field w-full p-2 border rounded ${formErrors.transactionCode ? 'border-red-500' : ''}`}
                  placeholder="Enter transaction code"
                  required={paymentMethod === 'mpesa'}
                  disabled={paymentMethod !== 'mpesa'}
                />
                {formErrors.transactionCode && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.transactionCode}</p>
                )}
              </div>
            </div>

            <div ref={bankDetailsRef} className="bank-details hidden" data-payment-method="bank">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <select
                  name="bankName"
                  className={`select-field w-full p-2 border rounded ${formErrors.bankName ? 'border-red-500' : ''}`}
                  required={paymentMethod === 'bank'}
                  disabled={paymentMethod !== 'bank'}
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
                {formErrors.bankName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.bankName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Code
                </label>
                <input
                  type="text"
                  name="transactionCode"
                  className={`input-field w-full p-2 border rounded ${formErrors.transactionCode ? 'border-red-500' : ''}`}
                  placeholder="Enter transaction code"
                  required={paymentMethod === 'bank'}
                  disabled={paymentMethod !== 'bank'}
                />
                {formErrors.transactionCode && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.transactionCode}</p>
                )}
              </div>
            </div>

            <div ref={chequeDetailsRef} className="cheque-details hidden" data-payment-method="cheque">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="chequeNumber"
                  className={`input-field w-full p-2 border rounded ${formErrors.chequeNumber ? 'border-red-500' : ''}`}
                  placeholder="Enter cheque number"
                  required={paymentMethod === 'cheque'}
                  disabled={paymentMethod !== 'cheque'}
                />
                {formErrors.chequeNumber && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.chequeNumber}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <select
                  name="bankName"
                  className={`select-field w-full p-2 border rounded ${formErrors.bankName ? 'border-red-500' : ''}`}
                  required={paymentMethod === 'cheque'}
                  disabled={paymentMethod !== 'cheque'}
                >
                  <option value="">Select bank</option>
                  {bankOptions.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
                {formErrors.bankName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.bankName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Date
                </label>
                <input
                  type="date"
                  name="chequeDate"
                  className={`input-field w-full p-2 border rounded ${formErrors.chequeDate ? 'border-red-500' : ''}`}
                  required={paymentMethod === 'cheque'}
                  disabled={paymentMethod !== 'cheque'}
                />
                {formErrors.chequeDate && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.chequeDate}</p>
                )}
              </div>
            </div>

          { paymentMethod !== 'cheque' && (<div>  
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                name="paymentDate"
                className={`input-field w-full p-2 border rounded ${formErrors.paymentDate ? 'border-red-500' : ''}`}
                required={paymentMethod !== 'cheque'}
                disabled={paymentMethod === 'cheque'}
              />
              {formErrors.paymentDate && (
                <p className="text-red-500 text-sm mt-1">{formErrors.paymentDate}</p>
              )}
            </div>)}
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 p-2 border rounded text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-success flex-1 p-2 bg-green-600 text-white rounded"
            >
              {loading ? 'Processing...' : 'Process Payment'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            How to input transaction codes?
          </button>
        </div>
      </div>

      {showInstructions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Transaction Code Instructions</h3>
              <button onClick={() => setShowInstructions(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-gray-700">
          
              <div>
                <h4 className="font-medium text-gray-800">Personal A/C</h4>
                <p className='text-sm' >For payments to Samwega personal account, append "/samwega" to the code, e.g., "REF12345/samwega".</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">Transaction amount is more than the debt amount</h4>
                <p>Include the transaction amount in parentheses after the transaction code, e.g., "REF12345(1000)".</p>
              </div>

            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="w-full p-2 bg-gray-200 text-gray-800 rounded"
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