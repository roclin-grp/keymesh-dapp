const logdown = require('logdown')

export const storeLogger: ILogdown = logdown('keymesh:store')
export const uiLogger: ILogdown = logdown('keymesh:ui')

interface ILogdown {
  log: (...info: any[]) => void
  info: (...info: any[]) => void
  warn: (...info: any[]) => void
  error: (...reason: any[]) => void
}
