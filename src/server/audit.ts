import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(actorUserId: string | null, action: string, entityType: string, entityId: string | null, details?: Record<string, unknown>) {
  await db.insert(auditLogs).values({ actorUserId, action, entityType, entityId, details: details ?? null });
}
