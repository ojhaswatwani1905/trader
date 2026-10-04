import { TraderGame } from '@/components/TraderGame';

export const metadata = {
  title: 'Trader Embed | BETADRiX',
  description: 'BETADRiX authoritative wallet embed route for Trader game.',
};

export default function EmbedPage() {
  return (
    <main className="min-h-screen w-full bg-[#05070B] flex flex-col justify-start items-center p-0 m-0 overflow-x-hidden">
      <TraderGame forceEmbedded={true} />
    </main>
  );
}
