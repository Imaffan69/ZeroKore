import { NextResponse } from "next/server";
import { readJson, readString, BadRequestError } from "@/lib/api-auth";
import { requireOwner, adminError } from "@/lib/admin-guard";
import {
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  isValidRole,
  type Role,
} from "@/lib/admin-auth";

/**
 * Staff account management — owner only.
 *
 * The owner signs in with a username + password and creates other staff
 * accounts here, each with its own username, password and role. These are
 * separate from public ZeroKore accounts; they only ever open the hidden panel.
 */

/** List staff accounts (no hashes are returned). */
export async function GET() {
  try {
    await requireOwner();
    const accounts = await listAdminAccounts();
    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        role: a.role,
        isOwner: a.isOwner,
        disabled: a.disabled,
        createdAt: a.createdAt,
        lastLoginAt: a.lastLoginAt,
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}

/** Create a staff account with its own username, password and role. */
export async function POST(req: Request) {
  try {
    const actor = await requireOwner();
    const body = await readJson(req);
    const username = readString(body, "username", 64);
    const password = typeof body.password === "string" ? body.password : "";
    const role = readString(body, "role", 20) as Role;

    if (!username) throw new BadRequestError("A username is required.");
    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
      throw new BadRequestError(
        "Usernames use 3-64 letters, numbers, dots, dashes or underscores."
      );
    }
    if (password.length < 8) {
      throw new BadRequestError("Passwords must be at least 8 characters.");
    }
    if (!isValidRole(role)) throw new BadRequestError("Invalid role.");
    if (role === "owner") {
      throw new BadRequestError("The owner account already exists and cannot be duplicated.");
    }

    const account = await createAdminAccount({
      username,
      password,
      role,
      createdBy: actor.username,
    });
    try {
      await actor.db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "staff_account_create",
        detail: { username: account.username, role: account.role },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({
      account: {
        id: account.id,
        username: account.username,
        role: account.role,
        isOwner: account.isOwner,
        disabled: account.disabled,
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}

/** Update a staff account (role, disabled, or reset its password). */
export async function PATCH(req: Request) {
  try {
    const actor = await requireOwner();
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");

    const accounts = await listAdminAccounts();
    const target = accounts.find((a) => a.id === id);
    if (!target) throw new BadRequestError("That staff account no longer exists.");
    if (target.isOwner) throw new BadRequestError("The owner account cannot be modified.");

    const updates: { role?: Role; disabled?: boolean; password?: string } = {};
    if (typeof body.role === "string") {
      const role = readString(body, "role", 20) as Role;
      if (!isValidRole(role) || role === "owner") {
        throw new BadRequestError("Invalid role.");
      }
      updates.role = role;
    }
    if (typeof body.disabled === "boolean") updates.disabled = body.disabled;
    if (typeof body.password === "string" && body.password) {
      if (body.password.length < 8) {
        throw new BadRequestError("Passwords must be at least 8 characters.");
      }
      updates.password = body.password;
    }
    if (Object.keys(updates).length === 0) throw new BadRequestError("Nothing to update.");

    await updateAdminAccount(id, updates);
    try {
      await actor.db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "staff_account_update",
        detail: { id, ...updates, password: updates.password ? "[reset]" : undefined },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}

/** Delete a staff account. */
export async function DELETE(req: Request) {
  try {
    const actor = await requireOwner();
    const body = await readJson(req);
    const id = readString(body, "id", 100);
    if (!id) throw new BadRequestError("Missing id.");

    const accounts = await listAdminAccounts();
    const target = accounts.find((a) => a.id === id);
    if (!target) throw new BadRequestError("That staff account no longer exists.");
    if (target.isOwner) throw new BadRequestError("The owner account cannot be deleted.");

    await deleteAdminAccount(id);
    try {
      await actor.db.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "staff_account_delete",
        detail: { id, username: target.username },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
