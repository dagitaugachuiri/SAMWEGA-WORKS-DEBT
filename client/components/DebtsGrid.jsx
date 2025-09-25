// components/DebtsGrid.jsx
import { CreditCard, Plus } from 'lucide-react';
import DebtCard from './DebtCard';

export default function DebtsGrid({ 
  debts, 
  filteredDebts, 
  loading, 
  searchTerm, 
  statusFilter, 
  methodFilter, 
  vehiclePlateFilter, 
  dateRange,
  onRefresh,
  onPaymentClick,
  onCardClick
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card loading">
            <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredDebts.length === 0) {
    return (
      <div className="text-center py-12">
        <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No debts found</h3>
        <p className="mt-1 text-sm text-gray-500">
          {searchTerm || statusFilter !== 'all' || methodFilter !== 'all' || vehiclePlateFilter || dateRange.start || dateRange.end
            ? 'Try adjusting your search or filters.'
            : 'Get started by creating a new debt record.'
          }
        </p>
        {!searchTerm && statusFilter === 'all' && methodFilter === 'all' && !vehiclePlateFilter && !dateRange.start && !dateRange.end && (
          <div className="mt-6">
            <button
              data-tooltip-id="create-first-debt-tooltip"
              onClick={() => window.location.href = '/create-debt'}
              className="btn-primary flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Debt</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredDebts.map((debt) => (
        <DebtCard
          key={debt.id}
          debt={debt}
          onPaymentClick={onPaymentClick}
          onRefresh={onRefresh}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  );
}