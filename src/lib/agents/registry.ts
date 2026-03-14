import {
  Crown,
  Target,
  PenTool,
  Type,
  Palette,
  Shield,
  Zap,
  BarChart3,
  Users,
  Clock,
  Receipt,
  UserPlus,
  Megaphone,
  FileText,
  Brain,
  type LucideIcon,
} from "lucide-react";

export type AgentCategory = "operations" | "creative" | "technical" | "business";

export interface AgentDefinition {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  category: AgentCategory;
  icon: LucideIcon;
  defaultModel: string;
  tools: string[];
  color: string; // Tailwind color class for avatar bg
}

export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  coo: {
    slug: "coo",
    name: "COO - Head of Operations",
    shortName: "COO",
    description: "Orchestrates all agents, assigns tasks, monitors progress across the agency",
    category: "operations",
    icon: Crown,
    defaultModel: "grok-3-mini-fast",
    tools: ["create_task", "assign_task", "list_tasks", "send_handoff", "query_metrics", "send_notification"],
    color: "bg-amber-500/20 text-amber-500",
  },
  "email-strategist": {
    slug: "email-strategist",
    name: "Email Marketing Strategist",
    shortName: "Strategist",
    description: "Builds customer retention and CRM strategy, plans campaigns and flows",
    category: "creative",
    icon: Target,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_brand", "get_klaviyo_flows", "get_klaviyo_campaigns", "create_task", "send_handoff"],
    color: "bg-blue-500/20 text-blue-500",
  },
  copywriter: {
    slug: "copywriter",
    name: "Email Copywriter",
    shortName: "Copywriter",
    description: "Writes compelling email copy aligned with brand voice and strategy",
    category: "creative",
    icon: PenTool,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_brand", "save_draft", "send_handoff", "search_past_emails"],
    color: "bg-green-500/20 text-green-500",
  },
  "subject-line-creator": {
    slug: "subject-line-creator",
    name: "Subject Line & Preview Text Creator",
    shortName: "Subject Lines",
    description: "Creates high-performing subject lines and preview text variations",
    category: "creative",
    icon: Type,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_brand", "get_klaviyo_metrics", "save_draft", "send_handoff"],
    color: "bg-purple-500/20 text-purple-500",
  },
  "email-designer": {
    slug: "email-designer",
    name: "Email Designer & Researcher",
    shortName: "Designer",
    description: "Designs emails, tracks competitors, and researches best-performing designs",
    category: "creative",
    icon: Palette,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_brand", "search_designs", "save_draft", "send_handoff"],
    color: "bg-pink-500/20 text-pink-500",
  },
  "deliverability-specialist": {
    slug: "deliverability-specialist",
    name: "Deliverability Specialist",
    shortName: "Deliverability",
    description: "Monitors and improves email deliverability, manages sender reputation",
    category: "technical",
    icon: Shield,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_klaviyo_metrics", "get_deliverability_data", "create_task", "send_notification"],
    color: "bg-emerald-500/20 text-emerald-500",
  },
  "automation-specialist": {
    slug: "automation-specialist",
    name: "Automation & Technical Specialist",
    shortName: "Automations",
    description: "Builds email flows, automations, and handles all technical Klaviyo work",
    category: "technical",
    icon: Zap,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_klaviyo_flows", "create_klaviyo_flow", "get_client_brand", "create_task", "send_handoff"],
    color: "bg-yellow-500/20 text-yellow-500",
  },
  "data-analyst": {
    slug: "data-analyst",
    name: "Data Analyst",
    shortName: "Analyst",
    description: "Analyzes campaign performance, generates reports, identifies trends",
    category: "technical",
    icon: BarChart3,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_klaviyo_metrics", "get_klaviyo_campaigns", "get_klaviyo_flows", "query_database", "send_notification"],
    color: "bg-cyan-500/20 text-cyan-500",
  },
  "account-manager": {
    slug: "account-manager",
    name: "Account Manager",
    shortName: "Account Mgr",
    description: "Manages client communication, sends updates via Slack, handles relationships",
    category: "business",
    icon: Users,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_data", "send_slack_message", "create_task", "send_notification"],
    color: "bg-indigo-500/20 text-indigo-500",
  },
  "data-tracker": {
    slug: "data-tracker",
    name: "Data Tracker",
    shortName: "Tracker",
    description: "Tracks agent time, client overview, revenue generated across the agency",
    category: "operations",
    icon: Clock,
    defaultModel: "grok-3-mini-fast",
    tools: ["query_database", "get_time_entries", "get_revenue_data", "send_notification"],
    color: "bg-orange-500/20 text-orange-500",
  },
  "finance-manager": {
    slug: "finance-manager",
    name: "Finance & Invoicing Manager",
    shortName: "Finance",
    description: "Creates invoices, tracks payments, manages agency finances",
    category: "business",
    icon: Receipt,
    defaultModel: "grok-3-mini-fast",
    tools: ["create_invoice", "get_invoices", "get_client_data", "query_database"],
    color: "bg-lime-500/20 text-lime-500",
  },
  "onboarding-specialist": {
    slug: "onboarding-specialist",
    name: "Onboarding Specialist",
    shortName: "Onboarding",
    description: "Automatically connects client data and sets up new client workspaces",
    category: "operations",
    icon: UserPlus,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_data", "connect_integration", "create_task", "send_handoff", "send_notification"],
    color: "bg-teal-500/20 text-teal-500",
  },
  "outbound-strategist": {
    slug: "outbound-strategist",
    name: "Outbound Marketing Strategist",
    shortName: "Outbound",
    description: "Plans and manages outbound marketing campaigns for the agency",
    category: "business",
    icon: Megaphone,
    defaultModel: "grok-3-mini-fast",
    tools: ["create_task", "send_notification", "query_database"],
    color: "bg-rose-500/20 text-rose-500",
  },
  "proposal-writer": {
    slug: "proposal-writer",
    name: "Proposal Writer",
    shortName: "Proposals",
    description: "Writes client proposals, pitch decks, and agency sales materials",
    category: "business",
    icon: FileText,
    defaultModel: "grok-3-mini-fast",
    tools: ["get_client_data", "save_draft", "create_task"],
    color: "bg-violet-500/20 text-violet-500",
  },
  "co-ceo": {
    slug: "co-ceo",
    name: "Co-CEO & Strategist",
    shortName: "Co-CEO",
    description: "High-level strategy, business direction, and decision-making partner",
    category: "operations",
    icon: Brain,
    defaultModel: "grok-3-mini-fast",
    tools: ["query_database", "get_revenue_data", "create_task", "send_handoff", "send_notification"],
    color: "bg-fuchsia-500/20 text-fuchsia-500",
  },
};

export const AGENT_CATEGORIES: Record<AgentCategory, { label: string; agents: string[] }> = {
  operations: {
    label: "Operations",
    agents: ["coo", "data-tracker", "onboarding-specialist", "co-ceo"],
  },
  creative: {
    label: "Creative",
    agents: ["email-strategist", "copywriter", "subject-line-creator", "email-designer"],
  },
  technical: {
    label: "Technical",
    agents: ["deliverability-specialist", "automation-specialist", "data-analyst"],
  },
  business: {
    label: "Business",
    agents: ["account-manager", "finance-manager", "outbound-strategist", "proposal-writer"],
  },
};

export function getAgent(slug: string): AgentDefinition | undefined {
  return AGENT_REGISTRY[slug];
}

export function getAllAgents(): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY);
}
