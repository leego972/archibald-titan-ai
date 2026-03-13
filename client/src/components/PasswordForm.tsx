import React, { useState } from "react";
import { PasswordEntry } from "../types";
import { PasswordGenerator } from "./PasswordGenerator";
import { toast } from "sonner";

interface PasswordFormProps {
  initial?: Partial<PasswordEntry>;
  onSave: (entry: Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

export function PasswordForm({ initial = {}, onSave, onCancel }: PasswordFormProps) {
  const [site, setSite] = useState(initial.site || "");
  const [username, setUsername] = useState(initial.username || "");
  const [password, setPassword] = useState(initial.password || "");
  const [notes, setNotes] = useState(initial.notes || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!site.trim() || !username.trim() || !password.trim()) {
      toast.error("Site, username, and password are required.");
      return;
    }
    onSave({ site, username, password, notes });
  }

  function handleGenerate(pwd: string) {
    setPassword(pwd);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-muted">
      <div>
        <label className="block font-semibold mb-1" htmlFor="site">
          Site
        </label>
        <input
          id="site"
          type="text"
          value={site}
          onChange={e => setSite(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div>
        <label className="block font-semibold mb-1" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div>
        <label className="block font-semibold mb-1" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <PasswordGenerator onGenerate={handleGenerate} />
      <div>
        <label className="block font-semibold mb-1" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full p-2 border rounded"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-muted-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </form>
  );
}
