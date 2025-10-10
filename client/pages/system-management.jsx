import { useState, useEffect } from "react";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { app } from "../lib/firebase";
import { useAuth } from "./_app";
import Layout from "../components/Layout";
import { toast } from "react-hot-toast";
import { Plus, Trash2, Loader2, Clock, Database, Settings, ExternalLink, Shield, Loader2Icon, PlusIcon, ListChecks, Trash2Icon, MessageSquare, Server, DatabaseIcon } from "lucide-react";
import { useRouter } from "next/router";

const db = getFirestore(app);

export default function SystemManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [allowedDevices, setAllowedDevices] = useState([]);
  const [newFingerprint, setNewFingerprint] = useState("");
  const [currentFingerprint, setCurrentFingerprint] = useState("");
  const [isAddingFingerprint, setIsAddingFingerprint] = useState(false);
  const [isRemovingFingerprint, setIsRemovingFingerprint] = useState(null);
  const [shiftTimes, setShiftTimes] = useState({
    timeoutHour: 12,
    timeoutMinute: 30,
    timeInHour: 8,
    timeInMinute: 0,
  });
  const [isUpdatingShiftTimes, setIsUpdatingShiftTimes] = useState(false);

  const [systemInfo, setSystemInfo] = useState({
    firebaseProjectId: "",
    textSMSKey: "",
    apiBaseUrl: "",
    nodeVersion: "",
  });
    const router = useRouter();


  // ✅ Generate or Load Fingerprint (from localStorage)
  useEffect(() => {
    const generateFingerprint = async () => {
      // Try to retrieve from localStorage
      const savedHash = localStorage.getItem("device_fingerprint");
      if (savedHash) {
        console.log("Loaded fingerprint from localStorage:", savedHash);
        setCurrentFingerprint(savedHash);
        return;
      }

      // Otherwise, generate a new stable one
      const rawData = [
        navigator.userAgent || "",
        navigator.platform || "",
        navigator.language || "",
        screen.width || "",
        screen.height || "",
        Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      ].join("|");

      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawData));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // Save to localStorage for persistence
      localStorage.setItem("device_fingerprint", hashHex);
      setCurrentFingerprint(hashHex);
      console.log("Generated new fingerprint:", hashHex);
    };

    generateFingerprint();
  }, []);

  // ✅ Fetch role, config, and system info
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setRole(userDoc.exists() ? userDoc.data().role || "user" : "user");

        // Allowed devices
        const devicesDoc = await getDoc(doc(db, "config", "allowed_devices"));
        if (devicesDoc.exists()) {
          setAllowedDevices(devicesDoc.data().fingerprints || []);
        } else {
          await setDoc(doc(db, "config", "allowed_devices"), { fingerprints: [] });
        }

        // Shift times
        const shiftDoc = await getDoc(doc(db, "config", "shift_times"));
        if (shiftDoc.exists()) setShiftTimes(shiftDoc.data());

       
      } catch (error) {
        console.error("Error loading config:", error);
        toast.error("Failed to load configuration");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // ✅ Add new fingerprint
  const addFingerprint = async () => {
    if (!newFingerprint.trim()) {
      toast.error("Please enter a valid fingerprint hash");
      return;
    }
    setIsAddingFingerprint(true);
    try {
      await updateDoc(doc(db, "config", "allowed_devices"), {
        fingerprints: arrayUnion(newFingerprint.trim()),
      });
      setAllowedDevices([...allowedDevices, newFingerprint.trim()]);
      setNewFingerprint("");
      toast.success("Device fingerprint added");
    } catch (error) {
      console.error("Error adding fingerprint:", error);
      toast.error("Failed to add fingerprint");
    } finally {
      setIsAddingFingerprint(false);
    }
  };

  // ✅ Remove fingerprint
  const removeFingerprint = async (hash) => {
    setIsRemovingFingerprint(hash);
    try {
      await updateDoc(doc(db, "config", "allowed_devices"), {
        fingerprints: arrayRemove(hash),
      });
      setAllowedDevices(allowedDevices.filter((f) => f !== hash));
      toast.success("Fingerprint removed");
    } catch (error) {
      console.error("Error removing fingerprint:", error);
      toast.error("Failed to remove fingerprint");
    } finally {
      setIsRemovingFingerprint(null);
    }
  };

  // ✅ Update shift times
  const updateShiftTimes = async () => {
    setIsUpdatingShiftTimes(true);
    try {
      await updateDoc(doc(db, "config", "shift_times"), {
        ...shiftTimes,
        lastResetDate: new Date().toISOString().split("T")[0],
      });
      toast.success("Shift times updated");
    } catch (error) {
      console.error("Error updating shift times:", error);
      toast.error("Failed to update shift times");
    } finally {
      setIsUpdatingShiftTimes(false);
    }
  };

  // ✅ Loading state
  if (loading || !user) {
    return (
      <Layout userId={user?.uid}>
        <div className="min-h-screen flex items-center justify-center text-gray-600 text-lg">
          Loading system configuration...
        </div>
      </Layout>
    );
  }

  // ✅ Role check
  if (role !== "admin") {
    return (
      <Layout userId={user.uid}>
        <div className="min-h-screen flex items-center justify-center text-red-600 font-semibold text-xl">
          Access denied. Admin only.
        </div>
      </Layout>
    );
  }

  // ✅ UI Rendering
  return (
    <Layout userId={user.uid}>
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6 md:p-8">
       <div className="flex items-center justify-between mb-8">
  <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
    System Management Dashboard
  </h1>

  <button
    onClick={() => router.push('/dashboard')}
    className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors duration-300 flex items-center gap-2"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M13 5v14" />
    </svg>
    Go to Dashboard
  </button>
</div>

    {/* Device Fingerprints */}
<section className="bg-white rounded-xl shadow-md p-6 mb-8">
  <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <Shield className="h-5 w-5 text-blue-600" /> Allowed Devices (Fingerprints)
  </h2>

  {/* Current device fingerprint */}
  <div className="mb-6">
    <p className="text-sm text-gray-600 mb-1">Your device fingerprint:</p>
    <div className="bg-gray-100 border border-gray-200 text-xs p-3 rounded-lg font-mono break-all text-gray-800">
      {currentFingerprint ? (
        <>{currentFingerprint}</>
      ) : (
        <span className="text-gray-400 italic">Generating...</span>
      )}
    </div>
  </div>

  {/* Add new fingerprint input */}
  <div className="flex flex-col sm:flex-row gap-3 mb-8">
    <input
      type="text"
      value={newFingerprint}
      onChange={(e) => setNewFingerprint(e.target.value)}
      placeholder="Paste or enter fingerprint hash..."
      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
    />
    <button
      onClick={addFingerprint}
      disabled={isAddingFingerprint || !newFingerprint.trim()}
      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition"
    >
      {isAddingFingerprint ? (
        <>
          <Loader2Icon className="h-4 w-4 animate-spin" /> <span>Adding...</span>
        </>
      ) : (
        <>
          <PlusIcon className="h-4 w-4" /> <span>Add Device</span>
        </>
      )}
    </button>
  </div>

  {/* Allowed device list */}
  <div>
    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
      <ListChecks className="h-4 w-4 text-green-600" /> Authorized Fingerprints
    </h3>

    {allowedDevices.length === 0 ? (
      <p className="text-gray-500 text-sm italic">No allowed devices yet.</p>
    ) : (
      <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100">
        {allowedDevices.map((hash) => (
          <div
            key={hash}
            className="flex justify-between items-center p-2 bg-gray-50 hover:bg-gray-100 transition"
          >
            <span className="text-gray-700 text-xs font-mono break-all">
              {hash}
            </span>
            <button
              onClick={() => removeFingerprint(hash)}
              disabled={isRemovingFingerprint === hash}
              className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1 disabled:opacity-60"
            >
              {isRemovingFingerprint === hash ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2Icon className="h-4 w-4" />
              )}
              Remove
            </button>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* Section footer */}
  <div className="mt-6 text-xs text-gray-500 border-t pt-4">
    <p>
      💡 Each fingerprint uniquely identifies a device based on its browser and
      hardware attributes. You can manually add trusted devices or remove any
      that should lose access.
    </p>
  </div>
</section>


    {/* Shift Time Settings */}
<section className="bg-white rounded-xl shadow-md p-6 mb-8">
  <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
    <Clock className="h-5 w-5 text-blue-600" /> Shift Time Settings
  </h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
    {/* Time In */}
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
        <Clock className="h-4 w-4 text-green-600" /> Time In
      </label>
      <input
        type="time"
        value={`${String(shiftTimes.timeInHour).padStart(2, '0')}:${String(shiftTimes.timeInMinute).padStart(2, '0')}`}
        onChange={(e) => {
          const [hour, minute] = e.target.value.split(':').map(Number);
          setShiftTimes({ ...shiftTimes, timeInHour: hour, timeInMinute: minute });
        }}
        className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>

    {/* Time Out */}
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-1">
        <Clock className="h-4 w-4 text-red-600" /> Time Out
      </label>
      <input
        type="time"
        value={`${String(shiftTimes.timeoutHour).padStart(2, '0')}:${String(shiftTimes.timeoutMinute).padStart(2, '0')}`}
        onChange={(e) => {
          const [hour, minute] = e.target.value.split(':').map(Number);
          setShiftTimes({ ...shiftTimes, timeoutHour: hour, timeoutMinute: minute });
        }}
        className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
    </div>
  </div>

  <div className="flex justify-end">
    <button
      onClick={updateShiftTimes}
      disabled={isUpdatingShiftTimes}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
    >
      {isUpdatingShiftTimes && <Loader2 className="h-4 w-4 animate-spin" />}
      {isUpdatingShiftTimes ? 'Saving...' : 'Save Shift Times'}
    </button>
  </div>

  {/* Extra info footer */}
  <div className="mt-6 text-xs text-gray-500 border-t pt-4">
    <p>
      ⏰ The system will automatically restrict access outside the allowed time range. 
      Update times to match your team’s shift schedule.
    </p>
  </div>
</section>


  <section className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-8 md:p-12">
  <div className="max-w-7xl mx-auto">
    <header className="mb-10 text-center">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
        System Services
      </h1>
      <p className="text-gray-600 text-base">
        Manage and monitor connected infrastructure services securely.
      </p>
    </header>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {/* TextSMS Service Card */}
      <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <div className="flex items-center p-6 border-b border-gray-100">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-50">
            <MessageSquare className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="ml-4 text-xl font-semibold text-gray-800">
            SMS Service (TextSMS)
          </h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-gray-700">
            <a
              href="https://sms.textsms.co.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-medium hover:underline"
            >
              View TextSMS Dashboard
            </a>
          </p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-gray-700 text-sm">
              <span className="font-semibold">Credentials</span>
            </p>
            <p className="text-gray-600 text-sm">Username: eApps</p>
            <p className="text-gray-600 text-sm">Password: RfBcDX</p>
          </div>
        </div>
      </div>

      {/* Render.com Service Card */}
      <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <div className="flex items-center p-6 border-b border-gray-100">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-green-50">
            <Server className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="ml-4 text-xl font-semibold text-gray-800">
            Cloud Server (Render.com)
          </h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-gray-700">
            <a
              href="https://dashboard.render.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-medium hover:underline"
            >
              View Render Dashboard
            </a>
          </p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-gray-600 text-sm">
              Reliable hosting for backend APIs and microservices.
            </p>
          </div>
        </div>
      </div>

      {/* Firebase Service Card */}
      <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100">
        <div className="flex items-center p-6 border-b border-gray-100">
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-orange-50">
            <DatabaseIcon className="h-6 w-6 text-orange-600" />
          </div>
          <h2 className="ml-4 text-xl font-semibold text-gray-800">
            Database (Firebase)
          </h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-gray-700">
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-medium hover:underline"
            >
              View Firebase Console
            </a>
          </p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-gray-600 text-sm">
              Realtime database, authentication, and analytics management.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Footer */}
    <footer className="mt-16 text-center text-gray-500 text-sm">
      <p>
        &copy; {new Date().getFullYear()} Samwega Systems. All Rights Reserved.
      </p>
      <p>
        <a
          href="https://console.firebase.google.com/"
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          Firebase
        </a>{" "}
        |{" "}
        <a
          href="https://dashboard.render.com/"
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          Render
        </a>{" "}
        |{" "}
        <a
          href="https://sms.textsms.co.ke/"
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          TextSMS
        </a>
      </p>
    </footer>
  </div>
</section>

      </div>
    </Layout>
  );
}
