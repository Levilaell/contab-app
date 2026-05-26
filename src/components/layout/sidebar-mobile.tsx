'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

export function SidebarMobile() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md',
          'text-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
        )}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <SheetTitle className="sr-only">Navegação</SheetTitle>
        <Sidebar onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
