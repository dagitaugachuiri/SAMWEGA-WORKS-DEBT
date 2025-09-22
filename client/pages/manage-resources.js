import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { ArrowLeft, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

export default function ManageResources() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [showInput, setShowInput] = useState(null); // "vehicle" | "rep" | null
  const [inputValue, setInputValue] = useState('');

  // Load from Firestore
  useEffect(() => {
    const loadData = async () => {
      const vSnap = await getDocs(collection(db, 'vehicles'));
      const rSnap = await getDocs(collection(db, 'salesReps'));
      setVehicles(vSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSalesReps(rSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadData();
  }, []);

  const handleAdd = async () => {
    if (!inputValue.trim()) return toast.error('Value required');

    try {
      if (showInput === 'vehicle') {
        const docRef = await addDoc(collection(db, 'vehicles'), {
          plateNumber: inputValue,
        });
        setVehicles([...vehicles, { id: docRef.id, plateNumber: inputValue }]);
        toast.success('Vehicle added');
      } else if (showInput === 'rep') {
        const docRef = await addDoc(collection(db, 'salesReps'), {
          name: inputValue,
        });
        setSalesReps([...salesReps, { id: docRef.id, name: inputValue }]);
        toast.success('Sales rep added');
      }
      setInputValue('');
      setShowInput(null);
    } catch (err) {
      toast.error('Error adding: ' + err.message);
    }
  };

  const deleteVehicle = async (id) => {
    await deleteDoc(doc(db, 'vehicles', id));
    setVehicles(vehicles.filter((v) => v.id !== id));
    toast.success('Vehicle deleted');
  };

  const deleteSalesRep = async (id) => {
    await deleteDoc(doc(db, 'salesReps', id));
    setSalesReps(salesReps.filter((r) => r.id !== id));
    toast.success('Sales rep deleted');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => router.push('/create-debt')}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Manage Sales Reps & Vehicles
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
          {/* Vehicles */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Vehicles</h2>
              <button
                onClick={() => setShowInput('vehicle')}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Vehicle</span>
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
              {vehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex justify-between items-center py-2"
                >
                  <span>{vehicle.plateNumber}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => deleteVehicle(vehicle.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Sales Reps */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Sales Representatives</h2>
              <button
                onClick={() => setShowInput('rep')}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Sales Rep</span>
              </button>
            </div>
            <ul className="divide-y divide-gray-200">
              {salesReps.map((rep) => (
                <li
                  key={rep.id}
                  className="flex justify-between items-center py-2"
                >
                  <span>{rep.name}</span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => deleteSalesRep(rep.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </main>

        {/* Custom Input Modal */}
        {showInput && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-lg p-6 w-80">
              <h2 className="text-lg font-semibold mb-4">
                {showInput === 'vehicle' ? 'Add Vehicle' : 'Add Sales Rep'}
              </h2>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  showInput === 'vehicle' ? 'Enter Plate Number' : 'Enter Name'
                }
                className="w-full border rounded p-2 mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowInput(null);
                    setInputValue('');
                  }}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
