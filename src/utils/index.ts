/* tslint:disable-next-line no-empty */
export const noop = () => {}

export function isUndefined<T>(value: T | undefined): value is undefined {
  return typeof value === 'undefined'
}
