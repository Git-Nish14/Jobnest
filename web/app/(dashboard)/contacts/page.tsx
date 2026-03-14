import { Users } from "lucide-react";
import { getContacts } from "@/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ContactForm, ContactList } from "@/components/contacts";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const { data: contacts } = await getContacts();

  const allContacts = contacts || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your recruiters and hiring managers
          </p>
        </div>
        <ContactForm />
      </div>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            All Contacts ({allContacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts yet</p>
              <p className="text-sm mt-1">
                Add recruiters and hiring managers you interact with
              </p>
            </div>
          ) : (
            <ContactList contacts={allContacts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
