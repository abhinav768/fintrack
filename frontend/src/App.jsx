import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Loans from "./components/Loans";
import LoanDetail from "./components/LoanDetail";
import AddLoan from "./components/AddLoan";
import Borrowers from "./components/Borrowers";
import BorrowerDetail from "./components/BorrowerDetail";
import Settings from "./components/Settings";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ProfilePicker from "./components/ProfilePicker";
import ChatWidget from "./components/ChatWidget";
import { PageLoader } from "./components/ui";

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <PageLoader />
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

  if (!profile) {
    return (
      <Routes>
        <Route path="/profiles" element={<ProfilePicker />} />
        <Route path="*" element={<Navigate to="/profiles" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-28 pt-14 md:pb-0 md:pt-0">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/add-loan" element={<AddLoan />} />
            <Route path="/borrowers" element={<Borrowers />} />
            <Route path="/borrowers/:id" element={<BorrowerDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profiles" element={<ProfilePicker />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      <ChatWidget />
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
