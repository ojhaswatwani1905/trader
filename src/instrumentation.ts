export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Keep Render instance awake by pinging itself every 9 minutes
    // Render free instances go to sleep after 15 minutes of inactivity
    const intervalMs = 9 * 60 * 1000; // 9 minutes

    const pingSelf = async () => {
      const baseUrl =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.PUBLIC_URL ||
        process.env.APP_URL;

      if (!baseUrl) {
        return;
      }

      try {
        const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/health`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: { 'User-Agent': 'Render-Self-Keeper/1.0' },
        });
        if (res.ok) {
          console.log(`[Keeper] Render keepalive ping successful -> ${endpoint}`);
        }
      } catch (err) {
        console.warn('[Keeper] Render keepalive ping failed:', err);
      }
    };

    // First ping after 45 seconds of boot, then every 9 minutes
    setTimeout(() => {
      pingSelf();
      setInterval(pingSelf, intervalMs);
    }, 45 * 1000);
  }
}
