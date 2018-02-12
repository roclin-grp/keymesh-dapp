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

export function timeAgo(time: number): string {
  const now = new Date()
  const seconds = Math.round((now.getTime() - time) * .001)
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  const years = days / 365

  return timeAgoTemplates.prefix + (
    seconds < 45 && timeAgoTemplate('seconds', seconds) ||
    seconds < 90 && timeAgoTemplate('minute', 1) ||
    minutes < 45 && timeAgoTemplate('minutes', minutes) ||
    minutes < 90 && timeAgoTemplate('hour', 1) ||
    hours < 24 && timeAgoTemplate('hours', hours) ||
    hours < 42 && timeAgoTemplate('day', 1) ||
    days < 30 && timeAgoTemplate('days', days) ||
    days < 45 && timeAgoTemplate('month', 1) ||
    days < 365 && timeAgoTemplate('months', days / 30) ||
    years < 1.5 && timeAgoTemplate('year', 1) ||
    timeAgoTemplate('years', years)
  ) + timeAgoTemplates.suffix
}

const timeAgoTemplates = {
  prefix: '',
  suffix: ' ago',
  seconds: 'less than a minute',
  minute: 'about a minute',
  minutes: '%d minutes',
  hour: 'about an hour',
  hours: 'about %d hours',
  day: 'a day',
  days: '%d days',
  month: 'about a month',
  months: '%d months',
  year: 'about a year',
  years: '%d years',
}
function timeAgoTemplate(t: string, n: number) {
  return timeAgoTemplates[t] && timeAgoTemplates[t].replace(/%d/i, Math.abs(Math.round(n)))
}

export function beforeOneDay(time: number) {
  const now = new Date().getTime()
  return now - time >= 86400 * 1000
}
