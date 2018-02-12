const logdown = require('logdown')

export const storeLogger: ILogdown = logdown('keymail:store')
export const uiLogger: ILogdown = logdown('keymail:ui')

interface ILogdown {
  log: (...info: any[]) => void
  info: (...info: any[]) => void
  warn: (...info: any[]) => void
  error: (...reason: any[]) => void
}
