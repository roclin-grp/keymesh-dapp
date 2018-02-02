import 'font-awesome/css/font-awesome.css'
import './index.css'

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

const load = (Component: typeof App) => {
  const stores = (() => {
    if (isDevelop) {
      const oldStores = (window as any).__STORE
      if (oldStores) {
        return oldStores as IStores
      }
    }
    const newStores = createStores()
    if (isDevelop) {
      (window as any).__STORE = newStores
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

if ((module as any).hot) {
  (module as any).hot.accept(() => load(App))
}

load(App)
