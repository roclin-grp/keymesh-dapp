const logdown = require('logdown')

export const storeLogger: Logdown = logdown('keymail:store')
export const uiLogger: Logdown = logdown('keymail:ui')

interface Logdown {
  log: (...str: any[]) => void
  info: (...str: any[]) => void
  warn: (...str: any[]) => void
  error: (...reason: any[]) => void
}
