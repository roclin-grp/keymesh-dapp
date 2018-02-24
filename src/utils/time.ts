const UNITS = [
  { max: 2760000, value: 60000, name: 'minute', prev: 'a minute ago' }, // max: 46 minutes
  { max: 72000000, value: 3600000, name: 'hour', prev: 'an hour ago' }, // max: 20 hours
  { max: Infinity, value: 86400000, name: '', prev: 'yesterday' },
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
      prev,
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

export function broadcastEstimateTime(time: number): string {
  const now = new Date()
  const seconds = Math.round((now.getTime() - time) * .001)
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24

  if (days > 1) {
    const date = new Date(time)
    const year = date.getFullYear()
    const month = MONTHS[date.getMonth()]
    const day = date.getDate().toString()

    if (now.getFullYear() !== year) {
      return `${day} ${month} ${year}`
    }
    return `${month} ${day}`
  }

  return (
    seconds < 45 && timeAgoTemplate('seconds', seconds) ||
    seconds < 90 && timeAgoTemplate('minute', 1) ||
    minutes < 45 && timeAgoTemplate('minutes', minutes) ||
    minutes < 90 && timeAgoTemplate('hour', 1) ||
    hours < 24 && timeAgoTemplate('hours', hours)
  )
}

export function broadcastTime(time: number): string {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = MONTHS[date.getMonth()]
  const day = date.getDate().toString()
  const localTime = date.toLocaleTimeString()
  return `${localTime} - ${day} ${month} ${year}`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
]

const timeAgoTemplates = {
  seconds: 'just now',
  minute: '1m',
  minutes: '%dm',
  hour: '1h',
  hours: '%dh',
}
function timeAgoTemplate(t: string, n: number) {
  return timeAgoTemplates[t] && timeAgoTemplates[t].replace(/%d/i, Math.abs(Math.round(n)))
}

export function beforeOneDay(time: number) {
  const now = new Date().getTime()
  return now - time >= 86400 * 1000
}
