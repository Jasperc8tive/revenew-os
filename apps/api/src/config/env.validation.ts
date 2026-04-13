/**
 * Startup environment validation.
 *
 * Passed to ConfigModule.forRoot({ validate }) so the process exits immediately
 * with a clear message when required variables are absent or obviously wrong,
 * rather than failing silently at runtime mid-request.
 */

type EnvConfig = Record<string, unknown>;

function missing(errors: string[], key: string) {
  errors.push(`${key} is required but not set`);
}

function parseRedisUrl(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? parseInt(parsed.port, 10) : 6379;
    return { host: parsed.hostname, port };
  } catch {
    return null;
  }
}

export function validateEnv(config: EnvConfig): EnvConfig {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config['NODE_ENV'] === 'production';

  // ── Database ────────────────────────────────────────────────────────────────

  if (!config['DATABASE_URL']) {
    missing(errors, 'DATABASE_URL');
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  if (!config['JWT_SECRET']) {
    missing(errors, 'JWT_SECRET');
  } else if (
    isProduction &&
    ['revenew-default-secret', 'dev-secret-key-change-in-production'].includes(
      config['JWT_SECRET'] as string,
    )
  ) {
    errors.push(
      'JWT_SECRET is set to a known development value — set a strong random secret for production',
    );
  } else if ((config['JWT_SECRET'] as string).length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters — use a longer value for better security');
  }

  // ── Redis ───────────────────────────────────────────────────────────────────
  // The code consumes REDIS_HOST + REDIS_PORT individually.
  // Accept either that pair or a single REDIS_URL and derive the values.

  const redisHost = config['REDIS_HOST'] as string | undefined;
  const redisPort = config['REDIS_PORT'];
  const redisUrl = config['REDIS_URL'] as string | undefined;

  if (redisHost && redisPort) {
    const port = Number(redisPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`REDIS_PORT must be a valid port number (1–65535), got: ${String(redisPort)}`);
    }
  } else if (redisUrl) {
    const parsed = parseRedisUrl(redisUrl);
    if (!parsed) {
      errors.push(`REDIS_URL is not a valid Redis URL: ${redisUrl}`);
    } else {
      // Inject derived values so downstream code that reads REDIS_HOST / REDIS_PORT works.
      config['REDIS_HOST'] = parsed.host;
      config['REDIS_PORT'] = parsed.port;
    }
  } else {
    errors.push(
      'Redis connection is not configured — set either REDIS_URL or both REDIS_HOST and REDIS_PORT',
    );
  }

  // ── AI Copilot (optional — warn if provider is set but key is missing) ──────

  const copilotProvider = config['COPILOT_PROVIDER'] as string | undefined;
  if (copilotProvider === 'openai' && !config['OPENAI_API_KEY']) {
    warnings.push('COPILOT_PROVIDER=openai but OPENAI_API_KEY is not set — copilot will fail');
  }
  if (copilotProvider === 'anthropic' && !config['ANTHROPIC_API_KEY']) {
    warnings.push(
      'COPILOT_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set — copilot will fail',
    );
  }

  // ── Emit and exit ────────────────────────────────────────────────────────────

  if (warnings.length > 0) {
    for (const w of warnings) {
      console.warn(`[Config] WARNING: ${w}`);
    }
  }

  if (errors.length > 0) {
    const message = [
      '',
      '  Configuration validation failed — fix the following before starting:',
      '',
      ...errors.map((e) => `    ✗ ${e}`),
      '',
    ].join('\n');
    throw new Error(message);
  }

  return config;
}
