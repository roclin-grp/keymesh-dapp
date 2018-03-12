import {
  createStores,
  IStores,
} from './stores'

// Used to preserve the stores for hot-reload in development
let cachedStores: IStores | undefined

/**
 *  Create the application stores. It also handles hot-reloading for development.
 */
export function initStores(): IStores | undefined {
  if (cachedStores && process.env.NODE_ENV === 'development') {
    return cachedStores
  }

  const stores = createStores()
  cachedStores = stores

  if (process.env.NODE_ENV === 'development') {
    // expose the stores to the window, for dev
    Object.assign(window, {
      __stores: stores,
    })
  }

  return stores
}
