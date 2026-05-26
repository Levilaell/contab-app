import { SidebarMobile } from './sidebar-mobile';
import { UserMenu } from './user-menu';

export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarMobile />
      </div>
      <UserMenu email={email} />
    </header>
  );
}
