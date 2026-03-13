import React, { useState } from "react";
import { generatePassword } from "../utils/passwordGenerator";

interface PasswordGeneratorProps {
  onGenerate: (password: string) => void;
}

export function PasswordGenerator({ onGenerate }: PasswordGeneratorProps) {
  const [length, setLength] = useState(16);
  const [generated, setGenerated] = useState("");

  function handleGenerate() {
    const pwd = generatePassword(length);
    setGenerated(pwd);
    onGenerate(pwd);
  }

  return (
    <div className="p-4 border rounded-md bg-muted">
      <label className="block mb-2 font-semibold">Password Length</label>
      <input
        type="number"
        min={8}
        max={64}
        value={length}
        onChange={e => setLength(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Generate
        </button>
        <input
          type="text"
          readOnly
          value={generated}
          className="flex-1 p-2 border rounded"
          aria-label="Generated password"
        />
      </div>
    </div>
  );
}
