import 'antd/dist/antd.css'

import 'font-awesome/css/font-awesome.css'
import './global.css'

import * as React from 'react'
import { render } from 'react-dom'

import { Provider } from 'mobx-react'

import { initStores } from './initStores'
import App from './App'

function renderApp() {
  if (process.env.NODE_ENV === 'development') {
    localStorage.debug = 'keymesh:*'
  }

  const stores = initStores()

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

window.addEventListener('load', renderApp)
