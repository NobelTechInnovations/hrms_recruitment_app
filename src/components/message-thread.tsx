import { ShieldAlert } from "lucide-react";
import type { Message } from "@/db/schema";
import { LEAK_REASON_LABELS, type LeakReason } from "@/lib/contact-guard";
import { formatDateTime } from "@/lib/format";
import { cx } from "./ui";

export function MessageThread({ messages, viewer, names }: { messages: Message[]; viewer: "company" | "candidate" | "admin"; names: { company: string; candidate: string } }) {
  if (!messages.length) return <p className="py-8 text-center text-sm text-ink-2">No messages yet — say hello.</p>;
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = viewer !== "admin" && m.senderRole === viewer;
        return (
          <li key={m.id} className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
            <div className={cx("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-sm bg-accent text-white dark:text-black" : "rounded-bl-sm bg-subtle text-ink")}>
              <p className="whitespace-pre-line break-words">{m.body}</p>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {m.senderRole === "company" ? names.company : m.senderRole === "candidate" ? names.candidate : "Platform"} · <span className="font-mono">{m.fromAddress}</span> · {formatDateTime(m.createdAt)}
              {m.channel === "email" ? " · via email" : ""}
            </p>
            {m.flagged ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Flagged: {m.flagReasons.map((r) => LEAK_REASON_LABELS[r as LeakReason] ?? r).join(", ")}
                {viewer === "admin" && m.originalBody ? ` — original: “${m.originalBody}”` : ""}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
