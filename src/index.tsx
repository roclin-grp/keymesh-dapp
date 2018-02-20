import 'antd/dist/antd.css'

import 'font-awesome/css/font-awesome.css'
import './global.css'

import * as React from 'react'
import { render } from 'react-dom'

import { Provider } from 'mobx-react'

import {
  createStores,
  IStores,
} from './stores'
import App from './App'

const isDevelop = process.env.NODE_ENV === 'development'

const windowWithStore = window as TypeWindowWithStore

const renderApp = () => {
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
    localStorage.debug = 'keymesh:*'
  }

  render(
    <Provider {...stores}>
      <App />
    </Provider>,
    document.getElementById('root'),
  )
}

if (module.hot) {
  module.hot.accept(renderApp)
}

window.addEventListener("load", renderApp)

type TypeWindowWithStore = Window & { __STORE: IStores }
