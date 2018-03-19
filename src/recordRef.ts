import * as queryString from 'query-string'

const { ref }: IQuery = queryString.parse(location.search)
if (ref != null) {
  localStorage.setItem('ref', ref)
}

export function getRef(): string | undefined {
  return localStorage.getItem('ref') || undefined
}

interface IQuery {
  ref?: string
}
