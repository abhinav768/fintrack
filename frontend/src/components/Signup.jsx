import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../AuthContext";
import { errorMessage } from "../lib/format";
import AuthLayout from "./AuthLayout";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username.trim())) {
      setError("Username must be 3-32 characters: letters, numbers, dot, underscore or dash");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signup(username, password);
      navigate("/profiles");
    } catch (err) {
      setError(errorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="New account"
      title="Get"
      accent="started."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="link-underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>
        )}
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={32}
            className="input"
            autoFocus
          />
          <p className="mt-2 text-xs text-faint">3–32 characters: letters, numbers, . _ -</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="input"
          />
          <p className="mt-2 text-xs text-faint">At least 8 characters.</p>
        </div>
        <button type="submit" disabled={loading} className="btn-primary group w-full py-3.5">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              Create account <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
