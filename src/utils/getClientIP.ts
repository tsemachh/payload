import type { PayloadRequest } from 'payload'
import { logAllHeaders } from '@/utils/debugHeaders'

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

function isPrivateOrReserved(ip: string): boolean {
  // IPv4 checks
  const parts = ip.split('.')
  if (parts.length === 4) {
    const [a, b] = parts.map((p) => parseInt(p, 10))
    if (a === 10) return true // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
    if (a === 0) return true // 0.0.0.0/8
    if (a >= 224) return true // 224.0.0.0/4 multicast/reserved
    return false
  }
  // IPv6 checks (coarse)
  const v6 = ip.toLowerCase()
  if (v6 === '::1') return true // loopback
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true // fc00::/7 unique local
  if (v6.startsWith('fe80')) return true // fe80::/10 link-local
  return false
}

function parseForwardedHeader(forwardedHeader: string | undefined): string[] {
  if (!forwardedHeader) return []
  const results: string[] = []
  try {
    const regex = /for=([^;,]+)/gi
    let match: RegExpExecArray | null
    while ((match = regex.exec(forwardedHeader))) {
      let token = match[1].trim()
      // Strip quotes and brackets
      token = token.replace(/^"(.*)"$/, '$1').replace(/^\[(.*)]$/, '$1')
      results.push(token)
    }
  } catch {}
  return results
}

function pickFromXFFChain(xff: string): string | undefined {
  const parts = xff
    .split(',')
    .map((p) => normalizeIP(p.trim()))
    .filter((p) => isValidIP(p))

  if (parts.length === 0) return undefined
  // Prefer the first PUBLIC IP from left to right
  const firstPublic = parts.find((p) => !isPrivateOrReserved(p))
  if (firstPublic) return firstPublic
  // Otherwise return the last valid (most likely the closest peer)
  return parts[parts.length - 1]
}

// Support both PayloadRequest (with Headers-like req.headers.get)
// and Express Request (with req.get and plain headers object)
export function getClientIP(req: PayloadRequest | any): string {
  const headers: any = req?.headers
  logAllHeaders(req)

  let forwarded: string | undefined
  let realIP: string | undefined
  let cfIP: string | undefined
  let trueClientIP: string | undefined
  let xClientIP: string | undefined
  let forwardedRFC: string | undefined

  try {
    // Payload v3 style (Headers-like)
    forwarded = headers?.get?.('x-forwarded-for') ?? headers?.get?.('X-Forwarded-For') ?? undefined
    realIP = headers?.get?.('x-real-ip') ?? headers?.get?.('X-Real-IP') ?? undefined
    cfIP = headers?.get?.('cf-connecting-ip') ?? headers?.get?.('CF-Connecting-IP') ?? undefined
    trueClientIP = headers?.get?.('true-client-ip') ?? headers?.get?.('True-Client-IP') ?? undefined
    xClientIP = headers?.get?.('x-client-ip') ?? headers?.get?.('X-Client-IP') ?? undefined
    forwardedRFC = headers?.get?.('forwarded') ?? headers?.get?.('Forwarded') ?? undefined
  } catch {}

  // Fallback to Express style (case-insensitive)
  const getHeader = (nameLower: string, nameUpper: string): string | undefined => {
    return (
      (typeof req.get === 'function' ? req.get(nameLower) || req.get(nameUpper) : undefined) ||
      (headers && ((headers[nameLower] as string) || (headers[nameUpper] as string))) ||
      undefined
    )
  }
  if (!forwarded) forwarded = getHeader('x-forwarded-for', 'X-Forwarded-For')
  if (!realIP) realIP = getHeader('x-real-ip', 'X-Real-IP')
  if (!cfIP) cfIP = getHeader('cf-connecting-ip', 'CF-Connecting-IP')
  if (!trueClientIP) trueClientIP = getHeader('true-client-ip', 'True-Client-IP')
  if (!xClientIP) xClientIP = getHeader('x-client-ip', 'X-Client-IP')
  if (!forwardedRFC) forwardedRFC = getHeader('forwarded', 'Forwarded')

  // 1) Cloudflare / CDN explicit headers
  if (cfIP) {
    const ip = normalizeIP(cfIP)
    if (isValidIP(ip) && !isPrivateOrReserved(ip)) return ip
  }
  if (trueClientIP) {
    const ip = normalizeIP(trueClientIP)
    if (isValidIP(ip) && !isPrivateOrReserved(ip)) return ip
  }
  if (xClientIP) {
    const ip = normalizeIP(xClientIP)
    if (isValidIP(ip) && !isPrivateOrReserved(ip)) return ip
  }

  // 2) RFC 7239 Forwarded header
  if (forwardedRFC) {
    const candidates = parseForwardedHeader(forwardedRFC)
      .map((c) => normalizeIP(c))
      .filter((c) => isValidIP(c))
    const firstPublic = candidates.find((c) => !isPrivateOrReserved(c))
    if (firstPublic) return firstPublic
    if (candidates.length > 0) return candidates[candidates.length - 1]
  }

  // 3) X-Forwarded-For chain (pick first public, else last valid)
  if (forwarded) {
    const picked = pickFromXFFChain(forwarded)
    if (picked) return picked
  }

  // 4) X-Real-IP if public
  if (realIP) {
    const ip = normalizeIP(realIP)
    if (isValidIP(ip) && !isPrivateOrReserved(ip)) return ip
  }

  // 5) Express req.ip fallbacks
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
