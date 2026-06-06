import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const bubbleClass = (role: string) =>
  role === "user"
    ? "max-w-2xl px-4 py-3 rounded-xl text-sm leading-relaxed bg-cyan-950/50 border border-cyan-800/40 text-cyan-100"
    : "max-w-2xl px-4 py-3 rounded-xl text-sm leading-relaxed bg-gray-900/60 border border-gray-700/40 text-gray-300";

export default function TitanBuilder() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content