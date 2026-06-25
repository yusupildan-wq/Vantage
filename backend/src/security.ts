import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

const SESSION_COOKIE = 'vantage_session'
const sessionToken = crypto.randomBytes(32).toString('hex')

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map(part => {
      const [name, ...value] = part.trim().split('=')
      return [name, decodeURIComponent(value.join('='))]
    })
  )
}

function safeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function issueBrowserSession(req: Request, res: Response): void {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https'
  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  })
}

export function requireTrustedBrowserOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin
  if (!origin) {
    next()
    return
  }

  const configuredOrigin = process.env.FRONTEND_URL?.trim()
  const productionRuntime = process.env.NODE_ENV === 'production' || Boolean((process as any).pkg)
  const allowed = configuredOrigin
    ? origin === configuredOrigin
    : productionRuntime
      ? origin === `http://localhost:${process.env.PORT ?? 3001}` ||
        origin === `http://127.0.0.1:${process.env.PORT ?? 3001}`
      : /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)

  if (!allowed) {
    res.status(403).json({ error: 'Untrusted browser origin.' })
    return
  }
  next()
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie)
  const browserSessionValid = safeEqual(cookies[SESSION_COOKIE], sessionToken)
  const configuredApiKey = process.env.API_KEY?.trim()
  const headerKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined
  const apiKeyValid = Boolean(configuredApiKey) && safeEqual(headerKey, configuredApiKey)

  if (!browserSessionValid && !apiKeyValid) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

export const securityInternals = { parseCookies, safeEqual }
