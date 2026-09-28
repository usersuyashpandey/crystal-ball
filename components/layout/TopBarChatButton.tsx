"use client";

import { MessageSquare } from "lucide-react";
import { useAssistantStore } from "@/lib/store";

/** The top bar's chat icon opens the Approvals assistant. */
export function TopBarChatButton() {
  const open = useAssistantStore((s) => s.open);
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Chat with the Approvals assistant"
      className="rounded-md p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );
}
