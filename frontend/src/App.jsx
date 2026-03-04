import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Loans from "./components/Loans";
import LoanDetail from "./components/LoanDetail";
import AddLoan from "./components/AddLoan";
import Borrowers from "./components/Borrowers";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/loans" element={<Loans />} />
            <Route path="/loans/:id" element={<LoanDetail />} />
            <Route path="/add-loan" element={<AddLoan />} />
            <Route path="/borrowers" element={<Borrowers />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
