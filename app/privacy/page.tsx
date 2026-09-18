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
          version: your conversations, memories, and account data belong to
          you, are protected by row-level security, and are never sold.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">2. What we store</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-white">Account data:</strong> your email
            address and a user identifier. Passwords are salted and hashed by
            Supabase Auth — ZeroKore never sees or stores them.
          </li>
          <li>
            <strong className="text-white">Conversations:</strong> the messages
            you send and the replies, tool activity, and artifacts the agents
            produce, so history syncs across your devices.
          </li>
          <li>
            <strong className="text-white">Long-term memory:</strong> short
            facts the agent saves to personalize future tasks. You can view and
            delete every memory from the Memory panel at any time.
          </li>
          <li>
            <strong className="text-white">Usage counters:</strong> a daily
            request count used to enforce fair-use limits.
          </li>
          <li>
            <strong className="text-white">Integrations:</strong> if you
            connect GitHub, the OAuth token is stored server-side only and is
            never sent to your browser. Disconnecting deletes it.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">3. What is shared with third parties</h2>
        <p>
          To generate responses, your prompt and relevant context are sent to
          the AI provider you select (or the fastest configured one in Auto
          mode): Groq, DeepSeek, SambaNova, or Google Gemini. These providers
          process the request to produce a reply. Authentication is handled by
          Supabase; the database and object storage run on Supabase
          infrastructure. No data is sold or used for advertising.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">4. What we never do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>We never display or export your password or session tokens.</li>
          <li>
            We never expose provider API keys, GitHub tokens, or service-role
            credentials to the browser.
          </li>
          <li>
            Administrators cannot read your conversations or memory through the
            ordinary product surface.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">5. Your controls</h2>
        <p>
          From the dashboard you can delete any conversation, any memory, or
          disconnect GitHub at any time; the deletion is immediate. To delete
          your entire account and all associated data, contact the operator —
          requests are honored within 30 days.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">6. Cookies</h2>
        <p>
          ZeroKore uses only the strictly necessary cookies required to keep
          you signed in (managed by Supabase Auth). No advertising or tracking
          cookies are set.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-white">7. Changes to this policy</h2>
        <p>
          Material changes will be announced in the app. Continued use after an
          update constitutes acceptance of the revised policy.
        </p>
      </section>
    </LegalPage>
  );
}
