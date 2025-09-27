import type { PayloadRequest } from 'payload'

function normalizeIP(raw: string): string {
  if (!raw) return 'unknown'
  // Remove port if present (e.g., 127.0.0.1:12345 or [::1]:12345)
  const withoutPort = raw.replace(/^\[(.*)](?::\d+)?$/, '$1').replace(/:(\d+)$/, '')
  // Remove IPv6 zone index (e.g., fe80::1%lo0)
  const withoutZone = withoutPort.replace(/%[0-9a-zA-Z]+$/, '')
  const ip = withoutZone.trim()

  // Map IPv6 loopback to IPv4 loopback for consistency with allowlists
  if (ip === '::1') return '127.0.0.1'

  // Handle IPv6-mapped IPv4 addresses like ::ffff:127.0.0.1 or ::ffff:192.168.1.10
  const v6Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (v6Mapped) return v6Mapped[1]

  // Sanity check for obviously invalid placeholder values
  if (ip === ':' || ip === '') return 'unknown'

  return ip
}

function isValidIP(ip: string): boolean {
  if (!ip) return false
  const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
  // Basic IPv6 validation (covers standard and compressed forms)
  const ipv6 =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7})|([0-9a-fA-F]{1,4}:){1,6}(:[0-9a-fA-F]{1,4})|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6}))$/
  return ipv4.test(ip) || ipv6.test(ip)
}

// Support both PayloadRequest (with Headers-like req.headers.get)
// and Express Request (with req.get and plain headers object)
export function getClientIP(req: PayloadRequest | any): string {
  // Try Headers-like interface first
  const headers: any = req?.headers
  let forwarded: string | undefined
  let realIP: string | undefined
  let cfIP: string | undefined

  try {
    // Payload v3 style (Headers-like)
    forwarded = headers?.get?.('x-forwarded-for') ?? headers?.get?.('X-Forwarded-For') ?? undefined
    realIP = headers?.get?.('x-real-ip') ?? headers?.get?.('X-Real-IP') ?? undefined
    cfIP = headers?.get?.('cf-connecting-ip') ?? headers?.get?.('CF-Connecting-IP') ?? undefined
  } catch {}

  // Fallback to Express style (case-insensitive)
  if (!forwarded) {
    forwarded =
      (typeof req.get === 'function'
        ? req.get('x-forwarded-for') || req.get('X-Forwarded-For')
        : undefined) ||
      (headers &&
        ((headers['x-forwarded-for'] as string) || (headers['X-Forwarded-For'] as string))) ||
      undefined
  }
  if (!realIP) {
    realIP =
      (typeof req.get === 'function' ? req.get('x-real-ip') || req.get('X-Real-IP') : undefined) ||
      (headers && ((headers['x-real-ip'] as string) || (headers['X-Real-IP'] as string))) ||
      undefined
  }
  if (!cfIP) {
    cfIP =
      (typeof req.get === 'function'
        ? req.get('cf-connecting-ip') || req.get('CF-Connecting-IP')
        : undefined) ||
      (headers &&
        ((headers['cf-connecting-ip'] as string) || (headers['CF-Connecting-IP'] as string))) ||
      undefined
  }

  // Prefer Cloudflare connecting IP if present
  if (cfIP) {
    const ip = normalizeIP(cfIP)
    if (isValidIP(ip)) return ip
  }

  if (forwarded) {
    const firstRaw = forwarded.split(',')[0]?.trim()
    const first = normalizeIP(firstRaw)
    if (isValidIP(first)) return first
  }
  if (realIP) {
    const ip = normalizeIP(realIP)
    if (isValidIP(ip)) return ip
  }

  // Express calculates req.ip when trust proxy is configured
  const raw =
    (req as any).ip || (req as any).connection?.remoteAddress || (req as any).socket?.remoteAddress
  const ip = typeof raw === 'string' && raw.length > 0 ? normalizeIP(raw) : 'unknown'
  if (isValidIP(ip)) return ip

  // In development, allow localhost connections
  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1'
  }

  return 'unknown'
}
