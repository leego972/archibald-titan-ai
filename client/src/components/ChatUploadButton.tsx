import React, { useState } from "react";
import { toast } from "sonner";

interface ChatUploadButtonProps {
  onFileUploaded: (url: string) => void;
}

export default function ChatUploadButton({ onFileUploaded }: ChatUploadButtonProps) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(`Upload failed: ${error.error || response.statusText}`);
        setUploading(false);
        return;
      }

      const data = await response.json();
      toast.success("File uploaded successfully");
      onFileUploaded(data.url);
    } catch (err) {
      toast.error("Upload failed: Network error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label
      htmlFor="chat-upload"
      className={`cursor-pointer px-3 py-1 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      title="Upload file to chat"
    >
      {uploading ? "Uploading..." : "Upload File"}
      <input
        id="chat-upload"
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </label>
  );
}
