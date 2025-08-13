import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, AlertTriangle, MessageSquare, Plus, Info } from 'lucide-react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useAuth } from './_app';
import Layout from '../components/Layout';

export default function CreateDebt() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(''); // New state for phone number
  const router = useRouter();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([
    { id: 1, plateNumber: "KDB 436Y", model: "MWANGI" },
    { id: 2, plateNumber: "KDD 071R", model: "ROSE" },
    { id: 3, plateNumber: "KDK 013U", model: "KEN" },
    { id: 4, plateNumber: "KDQ 118P", model: "NGANGA" },
    { id: 5, plateNumber: "KDS 936J", model: "MAINA" },
    { id: 6, plateNumber: "KDN 301K", model: "WANJIRU" }
  ]);

  useEffect(() => {
    // Simulate fetching vehicles from API
    const fetchVehicles = async () => {
      try {
        // Replace with actual API call when available
        // const response = await apiService.vehicles.getAll();
        // setVehicles(response.data);
      } catch (err) {
        console.error('Failed to fetch vehicles:', err);
        toast.error('Failed to load vehicle data');
      }
    };
    fetchVehicles();
  }, []);

  // Handle phone number input change to auto-convert 07... to +2547...
  const onPhoneNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    if (value.startsWith('07') && value.length >= 2) {
      value = '+254' + value.slice(1); // Convert 07... to +2547...
    } else if (value.startsWith('254') && value.length >= 3) {
      value = '+' + value; // Convert 254... to +254...
    } else if (value.startsWith('+254')) {
      value = value; // Keep as is if already in +254 format
    }
    setPhoneNumber(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Collect form data
      const formData = new FormData(e.target);
      const debtData = {
        storeOwner: {
          name: formData.get('storeOwnerName'),
          phoneNumber: phoneNumber, // Use state value instead of formData
          email: formData.get('email') || '',
        },
        vehiclePlate: formData.get('vehiclePlate'),
        store: {
          name: formData.get('storeName'),
          location: formData.get('location'),
        },
        amount: Number(formData.get('amount')),
        dateIssued: formData.get('dateIssued') || new Date().toISOString().split('T')[0],
        dueDate: formData.get('dueDate'),
        paymentMethod: formData.get('paymentMethod'),
        description: formData.get('description') || '',
      };

      // Validate phone number format
      if (!/^\+254[17]\d{8}$/.test(debtData.storeOwner.phoneNumber)) {
        throw new Error('Phone number must be in format +254XXXXXXXXX (starting with +2541 or +2547)');
      }

      // Validate dateIssued and dueDate
      if (!debtData.dateIssued) {
        throw new Error('Date issued is required');
      }
      if (new Date(debtData.dueDate) < new Date(debtData.dateIssued)) {
        throw new Error('Due date must be on or after date issued');
      }

      // Validate vehicle plate
      if (!debtData.vehiclePlate) {
        throw new Error('Vehicle plate number is required');
      }

      // Log request body for debugging
      console.log('Debt data:', JSON.stringify(debtData, null, 2));

      // Send POST request using apiService
      const response = await apiService.debts.create(debtData);

      if (response.data.success) {
        toast.success(
          <div>
            <div className="font-semibold">Debt created successfully!</div>
            <div className="text-sm">Invoice SMS sent to {debtData.storeOwner.phoneNumber}</div>
          </div>,
          { duration: 4000 }
        );
        router.push('/dashboard');
      } else {
        throw new Error(response.data.error || 'Failed to create debt');
      }
    } catch (err) {
      console.error('Debt creation error:', err.message);
      setError(err.message);
      toast.error(err.message || 'Failed to create debt');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 relative group">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 top-12 left-0 z-10">
                  Return to the dashboard
                </div>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Create New Debt Record
              </h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* SMS Notification Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 relative group">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Automatic SMS Invoice
                </h3>
                <div className="mt-1 text-sm text-blue-700">
                  <p>
                    When you create this debt record, an invoice SMS will automatically be sent to the debtor's phone number with:
                  </p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Debt amount and reference code</li>
                    <li>Vehicle plate number</li>
                    <li>Payment instructions (M-Pesa, Bank, or Cheque details)</li>
                    <li>Due date and contact information</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
              An SMS invoice with debt details will be sent to the debtor upon creation
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 relative group">
              <h2 className="text-lg font-medium text-gray-900">
                Debt Information
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter the debtor's details, vehicle information, and debt information below.
              </p>
              <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                Provide details about the debtor, vehicle, and debt to create a new record
              </div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Store Owner and Vehicle Information */}
                <div className="space-y-6">
                  {/* Store Owner Information */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-4 relative group">
                      Store Owner Information
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Details about the store owner who owes the debt
                      </div>
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Store Owner Name *
                        </label>
                        <input
                          type="text"
                          name="storeOwnerName"
                          required
                          minLength="2"
                          maxLength="100"
                          className="input-field"
                          placeholder="Enter store owner name"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Enter the full name of the store owner (2-100 characters)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number *
                          <span className="text-xs text-blue-600 ml-1">(SMS will be sent here)</span>
                        </label>
                        <input
                          type="tel"
                          name="phoneNumber"
                          required
                          value={phoneNumber}
                          onChange={onPhoneNumberChange}
                          className="input-field"
                          placeholder="+254712345678 or 0712345678"
                          title="Phone number will be converted to +254XXXXXXXXX format"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Format: +254712345678 or 0712345678
                        </p>
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Enter a valid Kenyan phone number (will be converted to +254 format)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email (Optional)
                        </label>
                        <input
                          type="email"
                          name="email"
                          className="input-field"
                          placeholder="Enter email address"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Optional: Enter the store owner's email for additional contact
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-4 relative group">
                      Vehicle Information
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Select the vehicle associated with the debt
                      </div>
                    </h3>
                    
                    <div className="relative group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vehicle Plate Number *
                      </label>
                      <select
                        name="vehiclePlate"
                        required
                        className="select-field"
                      >
                        <option value="">Select vehicle</option>
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.id} value={vehicle.plateNumber}>
                            {vehicle.plateNumber} - {vehicle.model}
                          </option>
                        ))}
                      </select>
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Select the vehicle by plate number and model
                      </div>
                    </div>
                     
                    <div className="relative mt-4 group">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Method *
                      </label>
                      <select name="paymentMethod" required className="select-field">
                        <option value="">Select payment method</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        SMS will include specific instructions for the selected method
                      </p>
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Choose how the debtor will pay (M-Pesa, Bank, or Cheque)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Store and Debt Details */}
                <div className="space-y-6">
                  {/* Store Information */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-4 relative group">
                      Store Information
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Details about the store associated with the debt
                      </div>
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Store Name *
                        </label>
                        <input
                          type="text"
                          name="storeName"
                          required
                          minLength="2"
                          maxLength="100"
                          className="input-field"
                          placeholder="Enter store name"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Enter the name of the store (2-100 characters)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location *
                        </label>
                        <input
                          type="text"
                          name="location"
                          required
                          minLength="2"
                          maxLength="100"
                          className="input-field"
                          placeholder="Enter store location"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Enter the store's physical location (e.g., city or area)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Debt Details */}
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-4 relative group">
                      Debt Details
                      <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                        Specific information about the debt being created
                      </div>
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount (KES) *
                        </label>
                        <input
                          type="number"
                          name="amount"
                          required
                          min="1"
                          max="10000000"
                          step="0.01"
                          className="input-field"
                          placeholder="0.00"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Enter the debt amount in KES (max 10M)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date Issued *
                        </label>
                        <input
                          type="date"
                          name="dateIssued"
                          required
                          max={new Date().toISOString().split('T')[0]}
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="input-field"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Select the date the debt was issued (not future dates)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Due Date *
                        </label>
                        <input
                          type="date"
                          name="dueDate"
                          required
                          min={new Date().toISOString().split('T')[0]}
                          className="input-field"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                          Select the due date for debt repayment (on or after today)
                        </div>
                      </div>
                      
                      <div className="relative group">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          name="description"
                          maxLength="500"
                          rows="3"
                          className="input-field"
                          placeholder="Enter additional notes or description"
                        />
                        <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-12 left-0 z-10">
                          Optional: Add notes or details about the debt (max 500 characters)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="btn-secondary relative group"
                    disabled={loading}
                  >
                    Cancel
                    <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                      Discard changes and return to dashboard
                    </div>
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex items-center space-x-2 relative group"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Creating & Sending SMS...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Create Debt & Send Invoice SMS</span>
                      </>
                    )}
                    <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
                      Create the debt record and send an invoice SMS to the debtor
                    </div>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Additional Information */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 relative group">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3 text-sm text-gray-600">
                <p className="font-medium">What happens after you create this debt:</p>
                <ul className="mt-1 space-y-1">
                  <li>• A unique 6-digit reference code will be generated</li>
                  <li>• An invoice SMS will be sent immediately to the debtor's phone</li>
                  <li>• The debt will appear in your dashboard with "Pending" status</li>
                  <li>• Payment notifications will be sent automatically when received</li>
                </ul>
              </div>
            </div>
            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-1 px-2 -top-10 left-0 z-10">
              Summary of actions triggered after debt creation
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
}