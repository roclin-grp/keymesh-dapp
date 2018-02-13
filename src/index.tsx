import 'font-awesome/css/font-awesome.css'
import './global.css'

import * as React from 'react'
import { render } from 'react-dom'
import { AppContainer } from 'react-hot-loader'

import { Provider } from 'mobx-react'

import {
  createStores,
  IStores,
} from './stores'
import App from './App'

const isDevelop = process.env.NODE_ENV === 'development'

const windowWithStore = window as TypeWindowWithStore

const load = (Component: typeof App) => {
  const stores = (() => {
    if (isDevelop) {
      const oldStores = windowWithStore.__STORE
      if (oldStores) {
        return oldStores
      }
    }
    const newStores = createStores()
    if (isDevelop) {
      windowWithStore.__STORE = newStores
    }
    return newStores
  })()

  if (isDevelop) {
    localStorage.debug = 'keymail:*'
  }

  render(
    <AppContainer>
      <Provider {...stores}>
        <Component />
      </Provider>
    </AppContainer>,
    document.getElementById('root'),
  )
}

const moduleWithHotReload = module as TypeNodeModuleWithHotReload

if (moduleWithHotReload.hot) {
  moduleWithHotReload.hot.accept(() => load(App))
}

load(App)

type TypeWindowWithStore = Window & {__STORE: IStores}
type TypeNodeModuleWithHotReload = NodeModule & {hot?: {accept: (cb: () => void) => void}}
