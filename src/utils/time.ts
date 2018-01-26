const UNITS = [
  { max: 2760000, value: 60000, name: 'minute', prev: 'a minute ago' }, // max: 46 minutes
  { max: 72000000, value: 3600000, name: 'hour', prev: 'an hour ago' }, // max: 20 hours
  { max: Infinity, value: 86400000, name: '', prev: 'yesterday' }
]

export function formatSessionTimestamp(timestamp: number) {
  const diff = Math.abs(Date.now() - timestamp)

  if (diff < 60000) { // less than a minute
    return 'just now'
  }

  for (let i = 0; i < UNITS.length; i++) {
    const {
      max,
      value,
      name,
      prev
    } = UNITS[i]
    if (diff < max) {
      const val = Math.floor(diff / value)
      if (i < 2) {
        return val <= 1 ? prev : `${val} ${name}s ago`
      }
      if (val <= 1) {
        return prev
      }
      const time = new Date(timestamp)
      return `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`
    }
  }
  return ''
}

export function unixToday() {
  return getUnixDay(Date.now())
}

export function getUnixDay(javaScriptTimestamp: number) {
  return Math.floor(javaScriptTimestamp / 1000 / 3600 / 24)
}
