import { Outlet } from '@tanstack/react-router';
import { Logo } from '../../components/ui/layout';
import { LanguageSwitch } from './shared';

/** Centered single column for sign-in, registration and invitations. */
export function PublicShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <a href="/" className="rounded-sm">
          <Logo />
        </a>
        <LanguageSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[4vh] pb-16 sm:pt-[8vh]">
        <Outlet />
      </main>
    </div>
  );
}
