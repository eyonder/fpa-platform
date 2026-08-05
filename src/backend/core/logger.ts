type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown) {
  const line = { level, message, at: new Date().toISOString(), meta };
  // Üretimde bu satır Datadog / OpenTelemetry taşıyıcısına bağlanır.
  console[level === "debug" ? "log" : level](JSON.stringify(line));
}

export const logger = {
  debug: (m: string, meta?: unknown) => emit("debug", m, meta),
  info: (m: string, meta?: unknown) => emit("info", m, meta),
  warn: (m: string, meta?: unknown) => emit("warn", m, meta),
  error: (m: string, meta?: unknown) => emit("error", m, meta),
};
