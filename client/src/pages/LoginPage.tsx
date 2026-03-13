import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";

interface LoginPageProps {
  onLoginSuccess?: (username: string, masterPassword: string) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps = {}) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      toast.success("Logged in successfully");
      onLoginSuccess?.(username, password);
    } else {
      toast.error("Invalid username or password");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-md shadow-md bg-muted">
      <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block font-semibold mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full p-2 border rounded"
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password" className="block font-semibold mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
