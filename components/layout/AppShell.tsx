import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CircleDot,
  FlaskConical,
  LayoutGrid,
  Maximize2,
  PanelLeft,
  RefreshCw,
  Settings,
  Store,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { TopBarChatButton } from "./TopBarChatButton";

/**
 * The OomniEye chrome around the approvals page, laid out like the
 * reference screenshot: top bar, icon sidebar, content, status bar. Only
 * the approvals page and the assistant are in scope for the assignment, so
 * the other navigation icons are visual only (not buttons pretending to
 * work); the chat icon opens the assistant.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <TopBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="min-w-0 flex-1 bg-slate-50/60 px-4 py-6 sm:px-7">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}

function TopBar() {
  const icon = "h-5 w-5 text-slate-600";
  return (
    <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="leading-tight">
        <p className="text-xl font-bold tracking-tight text-slate-900">OomniEye</p>
        <p className="text-sm tracking-wide text-slate-800">DIGITAL TWIN SOLUTIONS</p>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden items-center gap-6 md:flex" aria-hidden>
          <CircleDot className="h-5 w-5 text-red-500" />
          <RefreshCw className={icon} />
          <Maximize2 className={icon} />
          <span className="h-6 w-px bg-slate-200" />
        </div>
        <TopBarChatButton />
        <div className="hidden items-center gap-6 sm:flex" aria-hidden>
          <span className="relative">
            <Ticket className={icon} />
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
              3
            </span>
          </span>
          <Settings className={icon} />
          <span className="relative">
            <Bell className={icon} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
          </span>
        </div>
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-base font-semibold text-white"
          aria-label="Signed in operator"
        >
          R
        </span>
      </div>
    </header>
  );
}

const NAV = [
  { Icon: LayoutGrid, color: "text-blue-500" },
  { Icon: UserCheck, color: "text-cyan-500" },
  { Icon: Users, color: "text-pink-500" },
  { Icon: Ticket, color: "text-emerald-500" },
  { Icon: Store, color: "text-orange-400" },
  { Icon: BarChart3, color: "text-violet-500" },
  { Icon: FlaskConical, color: "text-pink-500" },
];

function SideNav() {
  return (
    <nav className="hidden w-[78px] shrink-0 flex-col items-center border-r border-slate-200 bg-white sm:flex" aria-hidden>
      <div className="flex h-16 w-full items-center justify-center border-b border-slate-200">
        <PanelLeft className="h-6 w-6 text-slate-500" />
      </div>
      <div className="flex flex-col items-center gap-9 pt-7">
        {NAV.map(({ Icon, color }, i) => (
          <Icon key={i} className={`h-6 w-6 ${color}`} />
        ))}
      </div>
    </nav>
  );
}

function StatusBar() {
  return (
    <footer className="grid h-12 shrink-0 grid-cols-3 items-center border-t border-slate-200 bg-white px-6 text-sm text-slate-500">
      <span>Ready</span>
      <span className="text-center">&copy; 2026 OomniEye. All rights reserved.</span>
      <span />
    </footer>
  );
}
