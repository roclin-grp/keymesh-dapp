const logdown = require('logdown')

export const storeLogger: ILogdown = logdown('keymail:store')
export const uiLogger: ILogdown = logdown('keymail:ui')

interface ILogdown {
  log: (...str: any[]) => void
  info: (...str: any[]) => void
  warn: (...str: any[]) => void
  error: (...reason: any[]) => void
}
