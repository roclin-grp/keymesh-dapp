export function unixToday() {
  return getUnixDay(Date.now())
}

export function getUnixDay(javaScriptTimestamp: number) {
  return Math.floor(javaScriptTimestamp / 1000 / 3600 / 24)
}

export function getBroadcastEstimateTime(time: number): string {
  const {
    seconds,
    minutes,
    hours,
    days,
  } = getAgo(time)

  if (days > 1) {
    const {
      year,
      monthStr,
      day,
    } = getDateInfo(time)

    if (isCurrentYear(time)) {
      return `${monthStr} ${day}`
    }

    return `${day} ${monthStr} ${year}`
  }

  return (
    seconds < 45 && timeAgoTemplate('seconds', seconds) ||
    seconds < 90 && timeAgoTemplate('minute', 1) ||
    minutes < 45 && timeAgoTemplate('minutes', minutes) ||
    minutes < 90 && timeAgoTemplate('hour', 1) ||
    hours < 24 && timeAgoTemplate('hours', hours)
  )
}

export function getBroadcastTime(time: number): string {
  const {
    day,
    monthStr,
    year,
    localTimeStr,
  } = getDateInfo(time)
  return `${localTimeStr} - ${day} ${monthStr} ${year}`
}

export function getSessionTimestamp(time: number): string | null {
  if (time === 0) {
    // session without any messages
    return null
  }

  const {
    day,
    month,
    year,
    hours,
    minutes,
  } = getDateInfo(time)
  const {
    days,
  } = getAgo(time)

  if (days < 1) {
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
  }

  return `${year.slice(-2)}/${month.padStart(2, '0')}/${day.padStart(2, '0')}`
}

export function getMessageTimeStamp(time: number): string {
  const {
    day,
    monthStr,
    year,
    localTimeStr,
  } = getDateInfo(time)
  const {
    days,
  } = getAgo(time)

  if (days < 1) {
    return localTimeStr
  }

  if (days < 2) {
    return `Yesterday ${localTimeStr}`
  }

  if (isCurrentYear(time)) {
    return `${monthStr} ${day} ${localTimeStr}`
  }

  return `${day} ${monthStr} ${year} ${localTimeStr}`
}

export function getAgo(time: number): IAgo {
  const now = new Date()
  const seconds = Math.round((now.getTime() - time) * .001)
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24

  return {
    seconds,
    minutes,
    hours,
    days,
  }
}

export function getDateInfo(time: number): IDateInfo {
  const date = new Date(time)
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString()
  const monthStr = MONTHS[date.getMonth()]
  const day = date.getDate().toString()
  const hours = date.getHours().toString()
  const minutes = date.getMinutes().toString()
  const seconds = date.getSeconds().toString()
  const localTimeStr = date.toLocaleTimeString()

  return {
    year,
    month,
    monthStr,
    day,
    hours,
    minutes,
    seconds,
    localTimeStr,
  }
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

export function isBeforeOneDay(time: number): boolean {
  const nowTime = Date.now()
  return nowTime - time >= 86400 * 1000
}

export function isCurrentYear(time: number): boolean {
  const { year } = getDateInfo(time)
  const nowDate = new Date()
  return nowDate.getFullYear().toString() === year
}

export function solidityTimestampToJSTimestamp(timeStr: string): number {
  return Number(timeStr) * 1000
}

export interface IAgo {
  seconds: number
  minutes: number
  hours: number
  days: number
}

export interface IDateInfo {
  year: string
  month: string
  monthStr: string
  day: string
  hours: string
  minutes: string
  seconds: string
  localTimeStr: string
}
