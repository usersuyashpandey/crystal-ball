import { getQueueSnapshot } from "@/lib/queue";
import { QueueDashboard } from "@/components/QueueDashboard";
import { ApprovalsAssistantPanel } from "@/components/ApprovalsAssistantPanel";

export default function Home() {
  const queue = getQueueSnapshot();

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <QueueDashboard queue={queue} />
      <ApprovalsAssistantPanel />
    </main>
  );
}
