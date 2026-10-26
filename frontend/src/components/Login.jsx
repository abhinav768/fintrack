import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../AuthContext";
import { errorMessage } from "../lib/format";
import AuthLayout from "./AuthLayout";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("All fields are required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/profiles");
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign"
      accent="in."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="link-underline">
            Create an account
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
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="input"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary group w-full py-3.5">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              Continue <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
