import * as React from 'react'

export const noop = () => { /* FOR LINT */ }

const newlineRegex = /(\r\n|\r|\n)/g
export function nl2br(str: string) {
  return str.split(newlineRegex).map((line, index) => {
    if (line.match(newlineRegex)) {
      return React.createElement('br', { key: index })
    }
    return line
  })
}
