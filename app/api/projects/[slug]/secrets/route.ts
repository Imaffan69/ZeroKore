import { NextResponse } from "next/server";
import {
  requireUser,
  errorResponse,
  readJson,
  readString,
  BadRequestError,
} from "@/lib/api-auth";
import { getOwnedProject } from "@/lib/projects";
import { createServiceClient } from "@/lib/supabase/server";
import { encryptSecret, isEncryptionConfigured } from "@/lib/crypto";
import type { ProjectSecretSummary } from "@/types/projects";

export const dynamic = "force-dynamic";

const TABLE = "project_secrets";
/** POSIX-style environment variable name. */
const KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * Secret key names only — never values.
 *
 * `project_secrets` has row-level security with no client policies, so the
 * browser can never read a value back. The service client is used here strictly
 * after ownership of the project has been verified with the caller's own
 * session.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { supabase, user } = await requireUser();

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }

    if (!isEncryptionConfigured()) {
      return NextResponse.json({
        configured: false,
        keys: [],
        message:
          "Set ENCRYPTION_KEY on the server to store environment variables. ZeroKore will not save secrets unencrypted.",
      });
    }

    let keys: ProjectSecretSummary[] = [];
    try {
      const service = await createServiceClient();
      const { data } = await service
        .from(TABLE)
        .select("key, updated_at")
        .eq("project_id", project.id)
        .order("key", { ascending: true });
      keys = (data ?? []) as ProjectSecretSummary[];
    } catch {
      return NextResponse.json({
        configured: false,
        keys: [],
        message:
          "Secret storage needs SUPABASE_SERVICE_ROLE_KEY on the server. Nothing was read.",
      });
    }

    return NextResponse.json({ configured: true, keys });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Store (or replace) one environment variable, encrypted at rest. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { supabase, user } = await requireUser();

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }

    const body = await readJson(req);
    const key = readString(body, "key", 64).toUpperCase();
    const value = typeof body.value === "string" ? body.value : "";

    if (!KEY_PATTERN.test(key)) {
      throw new BadRequestError(
        "Use an environment variable name: letters, digits and underscores, starting with a letter (for example API_URL)."
      );
    }
    if (!value) throw new BadRequestError("The value must not be empty.");
    if (value.length > 8000) throw new BadRequestError("That value is too long.");

    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        {
          error:
            "ENCRYPTION_KEY is not configured on the server, so secrets cannot be stored safely. Add a 32-byte key and redeploy.",
        },
        { status: 503 }
      );
    }

    const service = await createServiceClient();
    const { error } = await service.from(TABLE).upsert(
      {
        project_id: project.id,
        key,
        value_encrypted: encryptSecret(value),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,key" }
    );

    if (error) {
      return NextResponse.json(
        { error: "Could not save that environment variable." },
        { status: 500 }
      );
    }

    console.log(JSON.stringify({ event: "project_secret_saved", key }));
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Delete one environment variable by name. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { supabase, user } = await requireUser();

    const project = await getOwnedProject(supabase, user.id, slug);
    if (!project) {
      return NextResponse.json(
        { error: "That project does not exist, or is not yours." },
        { status: 404 }
      );
    }

    const key = new URL(req.url).searchParams.get("key");
    if (!key) throw new BadRequestError("A secret key is required.");

    const service = await createServiceClient();
    const { error } = await service
      .from(TABLE)
      .delete()
      .eq("project_id", project.id)
      .eq("key", key.toUpperCase());

    if (error) {
      return NextResponse.json(
        { error: "Could not delete that environment variable." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
