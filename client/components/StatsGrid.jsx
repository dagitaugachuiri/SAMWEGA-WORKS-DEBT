 
// components/StatsGrid.jsx
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

export default function StatsGrid({ stats, formatCurrency,userData }) {
  return (
    //if role is admin show total paid amount cols 4 else cols 3 
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${userData?.role === "admin" ? 4 : 3} p-1 gap-6 mb-8`}>
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

     {userData?.role==="admin" &&<div className="card" data-tooltip-id="total-paid-tooltip">
    <div className="group flex items-center">
  <div className="p-2 bg-success-100 rounded-lg">
    <CheckCircle className="h-6 w-6 text-success-600" />
  </div>
  <div className="ml-4">
    <p className="text-sm font-medium text-gray-600 blur-lg group-hover:blur-none transition-all duration-200">
      Total Paid Amount
    </p>
    <p className="text-xl font-bold text-gray-900 blur-lg group-hover:blur-none transition-all duration-200">
      {formatCurrency(stats.totalPaid)}
    </p>
  </div>
</div>
      </div>}
    </div>
  );
}