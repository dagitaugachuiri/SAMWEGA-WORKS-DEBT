import { Search, Car, Plus } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

export default function Filters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  methodFilter,
  onMethodChange,
  vehiclePlateFilter,
  onVehiclePlateChange,
  dateRange,
  onDateRangeChange,
  createDebtHandler
}) {
  // Bank options from PaymentModal.jsx
  const bankOptions = [
    'Equity',
    'Old KCB',
    'New KCB',
    'Old Absa',
    'New Absa',
    'Family'
  ];

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4 flex-1">
        <div className="relative flex-1 max-w-md" data-tooltip-id="search-tooltip">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search debts..."
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="relative" data-tooltip-id="filter-tooltip">
          <select
            className="select-field pl-0 pr-0"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Waiting Payment</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="relative" data-tooltip-id="method-filter-tooltip">
          <select
            className="select-field pl-0 pr-0"
            value={methodFilter}
            onChange={(e) => onMethodChange(e.target.value)}
          >
            <option value="all">All payment methods</option>
            <option value="mpesa_paybill">M-Pesa Paybill/system</option>
            <option value="manual_mpesa">Manual M-Pesa</option>
            {bankOptions.map(bank => (
              <option key={bank} value={bank}>{bank}</option>
            ))}
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-md" data-tooltip-id="vehicle-plate-filter-tooltip">
          <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by vehicle plate number"
            className="input-field pl-10"
            value={vehiclePlateFilter}
            onChange={(e) => onVehiclePlateChange(e.target.value)}
          />
        </div>

        <div className="flex gap-2 items-center" data-tooltip-id="date-filter-tooltip">
          <div className="relative">
            <input
              type="date"
              className="input-field pl-5"
              value={dateRange.start}
              onChange={(e) => onDateRangeChange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <span className="text-gray-500">to</span>
          <div className="relative">
            <input
              type="date"
              className="input-field pl-5"
              value={dateRange.end}
              onChange={(e) => onDateRangeChange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <button
        data-tooltip-id="create-debt-tooltip"
        onClick={createDebtHandler}
        className="btn-primary flex items-center space-x-2"
      >
        <Plus className="h-4 w-4" />
        <span>Create Debt</span>
      </button>
    </div>
  );
}