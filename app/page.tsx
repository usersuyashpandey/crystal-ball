import { getQueueSnapshot } from "@/lib/queue";
import { AppShell } from "@/components/layout/AppShell";
import { ApprovalsWorkspace } from "@/components/approvals/ApprovalsWorkspace";
import { ApprovalsAssistantPanel } from "@/components/ApprovalsAssistantPanel";

export const dynamic = "force-dynamic";

export default function Home() {
  const queue = getQueueSnapshot();

  return (
    <AppShell>
      <ApprovalsWorkspace queue={queue} />
      <ApprovalsAssistantPanel />
    </AppShell>
  );
}
