import { TraderGame } from '@/components/TraderGame';

export const metadata = {
  title: 'Trader | BETADRiX Crash Game',
  description: 'Original demo-only crash-style market multiplier game by BETADRiX.',
};

export default function StandalonePage() {
  return (
    <main className="min-h-screen bg-[#05070B] flex flex-col justify-start items-center p-2 sm:p-4">
      <TraderGame forceEmbedded={false} />
    </main>
  );
}
