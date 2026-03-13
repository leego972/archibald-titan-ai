import React from "react";
import { PasswordEntry } from "../types";
import { toast } from "sonner";

interface PasswordItemProps {
  entry: PasswordEntry;
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (id: string) => void;
}

export function PasswordItem({ entry, onEdit, onDelete }: PasswordItemProps) {
  function handleCopy() {
    navigator.clipboard.writeText(entry.password);
    toast.success("Password copied to clipboard");
  }

  return (
    <tr className="border-b last:border-none">
      <td className="p-2">{entry.site}</td>
      <td className="p-2">{entry.username}</td>
      <td className="p-2">
        <button
          onClick={handleCopy}
          className="text-blue-600 hover:underline"
          aria-label={`Copy password for ${entry.site}`}
        >
          ••••••••
        </button>
      </td>
      <td className="p-2">
        <button
          onClick={() => onEdit(entry)}
          className="mr-2 px-2 py-1 border rounded hover:bg-muted-foreground"
          aria-label={`Edit password for ${entry.site}`}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="px-2 py-1 border rounded hover:bg-red-600 hover:text-white"
          aria-label={`Delete password for ${entry.site}`}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
