import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy — ZeroKore" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="September 2026">
      <section>
        <h2 className="mb-2 text-base font-semibold text-white">1. Overview</h2>
        <p>
          ZeroKore is a browser-based AI workspace. This policy explains what
          data the Service stores, why, and the controls you have. The short
          version: your conversations, memories, projects and account data
          belong to you, are protected by row-level security, and are never
          sold. Some technical data (IP address, approximate location, device
          details) is collected for security and abuse prevention — every
          collection is listed below, nothing is hidden.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">2. What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-white">Account data:</strong> your email
            address, username, country (if you set it), and a user identifier.
            Passwords are salted and hashed by Supabase Auth — ZeroKore never
            sees or stores them.
          </li>
          <li>
            <strong className="text-white">Conversations:</strong> the messages
            you send and the replies, tool activity, and artifacts the agents
            produce, so history syncs across your devices.
          </li>
          <li>
            <strong className="text-white">Projects and files:</strong> the
            files you or the agent create in a project, plus a version history
            of agent edits (used by the Changes tab). Deleting a project
            deletes its history.
          </li>
          <li>
            <strong className="text-white">Long-term memory:</strong> short
            facts the agent saves to personalize future tasks. You can view and
            delete every memory at any time.
          </li>
          <li>
            <strong className="text-white">Credits and usage:</strong> your
            daily credit balance, a per-request record of tokens consumed and
            credits charged, and a ledger of every credit grant (daily reset,
            refund, referral, feedback bonus, admin grant). This exists so the
            economy is auditable and disputes can be resolved.
          </li>
          <li>
            <strong className="text-white">Integrations:</strong> if you store
            an AI provider key or connect GitHub, the token/key is encrypted
            with AES-256-GCM before storage, is never returned in plaintext to
            any browser, and deleting the integration removes it.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">
          3. IP address, approximate location and device data
        </h2>
        <p>
          For security, abuse prevention and rate limiting, ZeroKore records
          the following on signup, login, MFA events, and password changes:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-white">IP address</strong> — stored with
            the event; visible to you in your security history.
          </li>
          <li>
            <strong className="text-white">Approximate location</strong> —
            country and city derived from the IP address by our hosting
            provider&apos;s edge network. We never attempt street-level
            tracking, and we do not run continuous location monitoring.
          </li>
          <li>
            <strong className="text-white">Device and browser</strong> — a
            descriptive summary parsed from your user-agent (e.g. “Desktop ·
            Windows · Chrome”).
          </li>
        </ul>
        <p className="mt-2">
          You can see this history for your own account in Sign-in methods →
          Login history. Authorized staff can view the same records in the
          administrative panel for fraud/abuse investigation; every staff
          action on user data is written to an internal audit log.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">
          4. Two-factor authentication data
        </h2>
        <p>
          If you enable MFA, the TOTP secret is stored encrypted at rest and is
          used only to verify your codes at login. Enrollment state and
          last-use timestamps are stored. You can disable MFA at any time,
          which removes the factor.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">
          5. Student verification
        </h2>
        <p>
          If you verify as a student, we store the school email address you
          submit and its domain, the verification date, and the expiry (one
          year). This is used solely to apply the daily student credit bonus
          and can be revoked for abuse. Do not submit a school email you are
          not authorized to use.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">
          6. Feedback and referrals
        </h2>
        <p>
          Feedback you submit via the “Need a hand?” widget is stored with your
          account reference and the page you sent it from, and is visible to
          authorized staff. Referral claims store the link between referrer and
          referred account and the credits granted. Feedback content may be
          quoted internally to improve the product but is never published
          without your consent.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">7. What is shared with third parties</h2>
        <p>
          To generate responses, your prompt and relevant context are sent to
          the AI provider you select (or the fastest configured one in Auto
          mode): Groq, DeepSeek, SambaNova, or Google Gemini. These providers
          process the request to produce a reply. Authentication is handled by
          Supabase; the database and storage run on Supabase infrastructure;
          the site is served through Vercel, whose edge network provides the
          geo headers described in section 3. No data is sold or used for
          advertising.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">8. What we never do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>We never display or export your password or session tokens.</li>
          <li>
            We never expose provider API keys, GitHub tokens, or service-role
            credentials to the browser.
          </li>
          <li>We never sell personal data or run third-party ad trackers.</li>
          <li>
            Ordinary staff cannot read your conversations: the admin surface
            exposes account metadata, usage and security events — not chat
            content.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">9. Your controls</h2>
        <p>
          From the product you can delete any conversation, memory, project, or
          integration at any time; deletion is immediate. Login history lets
          you review every recorded security event with its IP and approximate
          location. To delete your entire account and all associated data,
          contact the operator — requests are honored within 30 days.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">10. Cookies</h2>
        <p>
          ZeroKore uses only the strictly necessary cookies required to keep
          you signed in (managed by Supabase Auth). No advertising or tracking
          cookies are set.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">11. Changes to this policy</h2>
        <p>
          Material changes will be announced in the app. Continued use after an
          update constitutes acceptance of the revised policy.
        </p>
      </section>
    </LegalPage>
  );
}
