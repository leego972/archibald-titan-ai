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
    { role: "assistant", content: "Titan AI online. I am your 1B parameter assistant. How can I help you build today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/titan/health")
      .then(r => r.json())
      .then(d => setStatus(d.status === "ok" ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/titan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] })
      });
      const data = await res.json();
      setMessages(m => [...m, {
        role: "assistant",
        content: data.text || data.response || "No response received."
      }]);
    } catch {
      setMessages(m => [...m, {
        role: "assistant",
        content: "Error: Could not reach Titan. Make sure the inference server is running."
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col">
      {/* Header */}
      <div className="border-b border-cyan-900/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center">
            <span className="text-cyan-400 font-black text-sm">T</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold tracking-widest">TITAN BUILDER</p>
            <p className="text-gray-600 text-xs">1B Parameter Language Model</p>
          </div>
        </div>
        <span className={"text-xs font-mono " + (status === "online" ? "text-green-400" : status === "offline" ? "text-red-400" : "text-yellow-400")}>
          {status === "online" ? "● ONLINE" : status === "offline" ? "● OFFLINE" : "● CHECKING"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={bubbleClass(msg.role)}>
              {msg.role === "assistant" && (
                <p className="text-cyan-500 text-xs font-bold tracking-widest mb-2">TITAN</p>
              )}
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex">
            <div className="bg-gray-900/60 border border-gray-700/40 rounded-xl px-4 py-3">
              <p className="text-cyan-500 text-xs font-bold tracking-widest mb-2">TITAN</p>
              <div className="flex gap-1">
                <span style={{ animationDelay: "0ms" }} className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" />
                <span style={{ animationDelay: "150ms" }} className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" />
                <span style={{ animationDelay: "300ms" }} className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-cyan-900/30 p-4">
        {status === "offline" && (
          <p className="text-red-400 text-xs text-center mb-3 font-mono">
            ⚠ Titan AI offline — configure VENICE_API_KEY or OPENAI_API_KEY to enable
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask Titan AI anything..."
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-700 transition-colors"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 text-white px-5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}
