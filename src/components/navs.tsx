import {
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import type { CompanyRole } from "@/lib/constants";
import { can } from "@/lib/permissions";
import type { NavItem } from "./shell";

export function candidateNav(counts: { messages?: number; recommendations?: number } = {}): NavItem[] {
  return [
    { href: "/candidate", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
    { href: "/candidate/profile", label: "Profile", icon: <UserRound /> },
    { href: "/candidate/score", label: "Profile score", icon: <Gauge /> },
    { href: "/candidate/verification", label: "Verification", icon: <ShieldCheck /> },
    { href: "/candidate/assessments", label: "Assessments", icon: <ClipboardCheck /> },
    { href: "/candidate/resumes", label: "Resume builder", icon: <FileText /> },
    { href: "/candidate/matches", label: "Jobs for you", icon: <Sparkles /> },
    { href: "/jobs", label: "Browse jobs", icon: <Search /> },
    { href: "/candidate/find-jobs", label: "Find Jobs For Me", icon: <Bell />, count: counts.recommendations },
    { href: "/candidate/applications", label: "Applications", icon: <ClipboardList /> },
    { href: "/candidate/saved", label: "Saved jobs", icon: <Bookmark /> },
    { href: "/candidate/interviews", label: "Interviews", icon: <CalendarDays /> },
    { href: "/candidate/messages", label: "Messages", icon: <Mail />, count: counts.messages },
    { href: "/candidate/privacy", label: "Privacy & consent", icon: <Lock /> },
  ];
}

export function companyNav(role: CompanyRole | null, counts: { messages?: number } = {}): NavItem[] {
  const items: (NavItem & { show: boolean })[] = [
    { href: "/company", label: "Hiring CRM", icon: <LayoutDashboard />, exact: true, show: true },
    { href: "/company/jobs", label: "Jobs", icon: <Briefcase />, show: can(role, "jobs.view") },
    { href: "/company/applications", label: "Pipeline", icon: <Workflow />, show: can(role, "pipeline.view") },
    { href: "/company/candidates", label: "Search candidates", icon: <Search />, show: can(role, "candidates.search") },
    { href: "/company/interviews", label: "Interviews", icon: <CalendarDays />, show: true },
    { href: "/company/messages", label: "Messages", icon: <Mail />, count: counts.messages, show: can(role, "messages.send") },
    { href: "/company/profile", label: "Company & verification", icon: <Building2 />, show: can(role, "company.edit") },
    { href: "/company/team", label: "Recruiter workspace", icon: <Users />, show: can(role, "team.manage") },
    { href: "/company/billing", label: "Billing & placements", icon: <CreditCard />, show: can(role, "billing.manage") },
  ];
  return items.filter((i) => i.show);
}

export function adminNav(counts: { verification?: number; jobs?: number; flagged?: number } = {}): NavItem[] {
  return [
    { href: "/admin", label: "Overview", icon: <BarChart3 />, exact: true },
    { href: "/admin/users", label: "Users", icon: <Users /> },
    { href: "/admin/verification", label: "Verification", icon: <ShieldCheck />, count: counts.verification },
    { href: "/admin/jobs", label: "Jobs", icon: <Briefcase />, count: counts.jobs },
    { href: "/admin/assessments", label: "Assessments", icon: <ClipboardCheck /> },
    { href: "/admin/recruitment", label: "Recruitment", icon: <Workflow /> },
    { href: "/admin/finance", label: "Finance", icon: <CreditCard /> },
    { href: "/admin/communication", label: "Communication", icon: <MessageSquareWarning />, count: counts.flagged },
    { href: "/admin/notifications", label: "Notification log", icon: <Bell /> },
  ];
}
