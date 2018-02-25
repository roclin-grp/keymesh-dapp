/* tslint:disable-next-line no-empty */
export const noop = () => {}

export async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}
