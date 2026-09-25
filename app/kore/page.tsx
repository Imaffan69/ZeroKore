import { redirect } from "next/navigation";

/**
 * `/kore` is a dead end by design: it redirects to the home page so that the
 * path yields nothing identifiable. The real panel lives at `/kore/admin`.
 */
export default function KoreEntry() {
  redirect("/");
}
