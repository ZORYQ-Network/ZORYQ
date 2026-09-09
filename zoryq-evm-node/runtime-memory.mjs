function positiveMb(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 32 ? Math.floor(n) : fallback;
}

function stripExistingHeapLimit(options = '') {
  return String(options)
    .replace(/--max-old-space-size(?:=|\s+)\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nodeEnvWithHeap(baseEnv = process.env, requestedMb = 128, label = 'zoryq-node') {
  const heapMb = positiveMb(requestedMb, 128);
  const existing = stripExistingHeapLimit(baseEnv.NODE_OPTIONS || '');
  const NODE_OPTIONS = [existing, `--max-old-space-size=${heapMb}`].filter(Boolean).join(' ');
  return { ...baseEnv, NODE_OPTIONS, ZORYQ_PROCESS_LABEL: label };
}

export function startMemoryTelemetry(label = process.env.ZORYQ_PROCESS_LABEL || 'zoryq-node') {
  if (String(process.env.ZORYQ_MEMORY_TELEMETRY || 'true').toLowerCase() === 'false') return null;
  const intervalMs = Math.max(15_000, Number(process.env.ZORYQ_MEMORY_TELEMETRY_MS || 30_000));
  const emit = () => {
    const m = process.memoryUsage();
    const mb = (v) => Math.round((Number(v || 0) / 1024 / 1024) * 10) / 10;
    console.log('[zoryq-memory]', {
      label,
      pid: process.pid,
      rssMb: mb(m.rss),
      heapUsedMb: mb(m.heapUsed),
      heapTotalMb: mb(m.heapTotal),
      externalMb: mb(m.external),
      arrayBuffersMb: mb(m.arrayBuffers),
      uptimeSec: Math.round(process.uptime())
    });
  };
  emit();
  const timer = setInterval(emit, intervalMs);
  timer.unref?.();
  return timer;
}
