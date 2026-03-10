import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Loans from "./components/Loans";
import LoanDetail from "./components/LoanDetail";
import AddLoan from "./components/AddLoan";
import Borrowers from "./components/Borrowers";
import Settings from "./components/Settings";
import Login from "./components/Login";
import Signup from "./components/Signup";
import { Loader2 } from "lucide-react";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin pt-14 md:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/add-loan" element={<AddLoan />} />
            <Route path="/borrowers" element={<Borrowers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
