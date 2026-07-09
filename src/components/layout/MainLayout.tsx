import { ReactNode } from 'react';
import { TopNav } from './TopNav';

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col h-screen overflow-hidden relative"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Ambient glassmorphism background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 520, height: 520, top: -160, left: -120,
            background: 'radial-gradient(circle, rgba(139,92,246,0.35), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 620, height: 620, top: 80, right: -180,
            background: 'radial-gradient(circle, rgba(34,211,238,0.28), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 480, height: 480, bottom: -140, left: '30%',
            background: 'radial-gradient(circle, rgba(244,114,182,0.25), transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* Dock overlays on top of the interface; content now uses the full screen */}
      <TopNav />
      <main className="flex-1 min-h-0 overflow-hidden relative z-10">
        {children}
      </main>
    </div>
  );
}
