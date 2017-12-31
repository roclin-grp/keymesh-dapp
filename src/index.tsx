import 'font-awesome/css/font-awesome.css'
import './index.css'

import * as React from 'react'
import { render } from 'react-dom'
import { AppContainer } from 'react-hot-loader'

import { Provider } from 'mobx-react'

import { Store } from './store'
import App from './routes'

const isDevelop = process.env.NODE_ENV === 'development'

const load = (Component: typeof App) => {
  const store = (() => {
    if (isDevelop) {
      const oldStore = (window as any).__STORE
      if (oldStore) {
        return oldStore as Store
      }
    }
    const newStore = new Store()
    if (isDevelop) {
      (window as any).__STORE = newStore
    }
    newStore.connect()
    return newStore
  })()

  if (isDevelop) {
    localStorage.debug = 'keymail:*'
  }

  render(
    <AppContainer>
      <Provider store={store}>
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
