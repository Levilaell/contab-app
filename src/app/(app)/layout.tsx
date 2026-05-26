import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header email={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="container mx-auto max-w-6xl p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
