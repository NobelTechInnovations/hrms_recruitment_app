import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { UserError } from "@/lib/errors";
import { fail, ok, type ActionState } from "@/lib/forms";

export function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Run a mutation, translating user-facing errors into form state. */
export async function attempt(fn: () => Promise<ActionState | void>, successMessage?: string): Promise<ActionState> {
  try {
    const result = await fn();
    revalidateAll();
    return result ?? ok(successMessage);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UserError) return fail(err.message);
    console.error("[action] unexpected error", err);
    return fail("Something went wrong. Please try again.");
  }
}
