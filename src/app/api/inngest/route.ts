import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processHandoff } from "@/lib/inngest/functions/handoff-processor";
import { executeTask } from "@/lib/inngest/functions/task-executor";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processHandoff, executeTask],
});
