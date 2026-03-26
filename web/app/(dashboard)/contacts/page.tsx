import { Users } from "lucide-react";
import { getContacts } from "@/services";
import { ContactForm, ContactList } from "@/components/contacts";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const { data: contacts } = await getContacts();

  const allContacts = contacts || [];

  return (
    <div>
      {/* ── Header ── */}
      <header className="db-page-header">
        <div>
          <h1 className="db-page-title">Contacts</h1>
          <p className="db-page-subtitle">
            Manage your recruiters and hiring managers with care.
          </p>
        </div>
        <ContactForm />
      </header>

      {/* ── Contacts list ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <Users className="h-5 w-5 text-[#99462a]" />
          <h2 className="db-headline text-xl font-semibold text-[#1a1c1b]">
            All Contacts
          </h2>
          {allContacts.length > 0 && (
            <span className="text-sm text-[#55433d]">({allContacts.length})</span>
          )}
        </div>
        <div className="db-content-card">
          {allContacts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Users className="h-10 w-10 text-[#55433d]/30 mb-3" />
              <p className="text-[#55433d] font-medium">No contacts yet</p>
              <p className="text-sm text-[#55433d]/60 mt-1">
                Add recruiters and hiring managers you interact with
              </p>
            </div>
          ) : (
            <ContactList contacts={allContacts} />
          )}
        </div>
      </section>
    </div>
  );
}
