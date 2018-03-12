import 'antd/dist/antd.css'
import 'font-awesome/css/font-awesome.css'

import './global.css'

import * as React from 'react'
import { render } from 'react-dom'

import { initStores } from './initStores'
import App from './App'

function renderApp() {
  if (process.env.NODE_ENV === 'development') {
    localStorage.debug = 'keymesh:*'
  }

  const stores = initStores()
  render(<App stores={stores} />, document.getElementById('root'))
}

const { hot } = module as NodeModule & { hot: any }
if (hot) {
  hot.accept(renderApp)
}

window.addEventListener('load', renderApp)
