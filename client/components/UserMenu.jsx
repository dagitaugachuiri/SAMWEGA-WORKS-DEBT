// components/UserMenu.jsx
import { LogOut, Settings, UserPlus, Users, Package } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

export default function UserMenu({ user, isDisabled, onLogout, showUserMenu, setShowUserMenu }) {
  const router = useRouter();

  const handleNavigation = (path, actionName) => {
    setShowUserMenu(false);
    if (isDisabled) {
      toast.error('Your account is disabled. Please contact support.');
      return;
    }
    router.push(path);
  };

  const handleCreateUser = () => handleNavigation('/create-user', 'Create User');
  const handleManageUsers = () => handleNavigation('/manage-users', 'Manage Users');
  const handleManageSystem = () => handleNavigation('/system-management', 'Manage System');
  const handleManageCustomers = () => handleNavigation('/customers', 'Manage Customers');
  const handleManageSupplierDebts = () => handleNavigation('/manage-supplier-debts', 'Manage Supplier Debts');

  if (!user) return null;

  return (
    <>
      <div className="relative">
        <button
          data-tooltip-id="user-menu-tooltip"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
        >
          <span>{user.email}</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showUserMenu && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10 border">
            <button
              onClick={handleCreateUser}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
              data-tooltip-id="create-user-tooltip"
            >
              <UserPlus className="h-4 w-4" />
              <span>Create User</span>
            </button>
            
            <button
              onClick={handleManageUsers}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
              data-tooltip-id="manage-users-tooltip"
            >
              <Users className="h-4 w-4" />
              <span>Manage Users</span>
            </button>
            
            <button
              onClick={handleManageSystem}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
              data-tooltip-id="manage-system-tooltip"
            >
              <Settings className="h-4 w-4" />
              <span>Manage System</span>
            </button>
            
          
            
            <button
              onClick={handleManageSupplierDebts}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left flex items-center space-x-2"
              data-tooltip-id="supplier-debts-tooltip"
            >
              <Package className="h-4 w-4" />
              <span>Manage Supplier Debts</span>
            </button>
            
            <div className="border-t border-gray-100 my-1"></div>
            
            <button
              data-tooltip-id="logout-tooltip"
              onClick={onLogout}
              className="block px-4 py-2 text-sm text-red-700 hover:bg-red-50 w-full text-left flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}