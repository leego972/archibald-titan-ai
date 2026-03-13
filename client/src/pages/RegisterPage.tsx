import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { toast } from "sonner";
import { trackSignup } from "@/lib/adTracking";

interface RegisterPageProps {
  onRegisterSuccess?: (username: string, masterPassword: string) => void;
}

export function RegisterPage({ onRegisterSuccess }: RegisterPageProps = {}) {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const success = await register(username, password);
    setLoading(false);
    if (success) {
      toast.success("Registered successfully");
      trackSignup(username);
      onRegisterSuccess?.(username, password);
    } else {
      toast.error("Username already exists");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-md shadow-md bg-muted">
      <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
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
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block font-semibold mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
}
