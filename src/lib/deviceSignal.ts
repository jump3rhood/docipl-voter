function canvasFingerprint(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 1, 60, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('DocIPL🏓', 2, 2);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}

/** Coarse, non-identifying device hash. Returns null on any failure. */
export async function collectDeviceSignal(): Promise<string | null> {
  try {
    const parts: string[] = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      String(navigator.hardwareConcurrency),
      String(navigator.maxTouchPoints),
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(window.devicePixelRatio),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ];
    const canvas = canvasFingerprint();
    if (canvas) parts.push(canvas);
    const data = new TextEncoder().encode(parts.join('|'));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
