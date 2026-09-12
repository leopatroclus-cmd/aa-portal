import { fetchAgents } from "@/lib/sheets";
import AgentNetwork from "@/components/AgentNetwork";

export const dynamic = "force-dynamic";

export default async function AgentNetworkPage() {
  const [globalAgents, africaAgents] = await Promise.all([
    fetchAgents("Global"),
    fetchAgents("Africa"),
  ]);
  return <AgentNetwork globalAgents={globalAgents} africaAgents={africaAgents} />;
}
