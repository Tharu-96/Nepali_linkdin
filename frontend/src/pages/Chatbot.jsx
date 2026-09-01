import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { chatbotAPI } from "../api";
import { useAuth } from "../context/AuthContext";

const starterPromptsByRole = {
  worker: [
    "How do I find jobs near me?",
    "How can I improve my profile?",
    "How do applications and payments work?",
  ],
  employer: [
    "How do I post a job?",
    "How do I hire and pay a worker?",
    "How is the 8% platform fee calculated?",
  ],
  admin: [
    "How does hiring work on Rozgar?",
    "How do payments and commission work?",
    "What can workers and employers do?",
  ],
};

function renderText(text) {
  return text.split("\n").map((line, i, lines) => {
    const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={j}>{part}</span>;
    });

    return (
      <span key={i}>
        {parts}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function Chatbot() {
  const { role } = useAuth();
  const location = useLocation();
  const starterPrompts = starterPromptsByRole[role] || starterPromptsByRole.worker;
  const audienceLabel = role === "employer" ? "Employer Assistant" : role === "worker" ? "Worker Assistant" : "Rozgar Assistant";
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text:
        `Hello! I am your **${audienceLabel}**.\n\nAsk about jobs, applications, hiring, payments, reviews, or using the platform.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (presetMessage) => {
    const message = (presetMessage ?? input).trim();
    if (!message || loading) return;

    const userMsg = { from: "user", text: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages
        .slice(-12)
        .map((item) => ({
          role: item.from === "user" ? "user" : "assistant",
          content: item.text,
        }));
      const res = await chatbotAPI.send(message, history, location.pathname);
      setMessages((prev) => [...prev, { from: "bot", text: res.data.reply }]);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: detail || "I could not answer that just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
            <Sparkles size={15} />
            {audienceLabel}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Simple help for using Rozgar
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Get guidance tailored to your {role || "Rozgar"} account.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:bg-white hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-900 px-6 py-5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Bot size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{audienceLabel}</h2>
              <p className="text-sm text-slate-300">Ask a question and get direct guidance</p>
            </div>
          </div>

          <div className="flex h-[560px] flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50 px-6 py-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-7 shadow-sm ${
                      msg.from === "user"
                        ? "rounded-br-md bg-primary-600 text-white"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {renderText(msg.text)}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-3xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-end gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                <textarea
                  rows={1}
                  placeholder="Ask your question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
