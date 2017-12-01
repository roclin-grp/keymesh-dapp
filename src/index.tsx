import 'font-awesome/css/font-awesome.css'
import 'normalize.css'

import './index.css'

import * as React from 'react'
import { render } from 'react-dom'

import { Provider } from 'mobx-react'

import { Store } from './store'
import App from './routes'

const AppWithStore: any = App

window.addEventListener('load', () => {
  const store = new Store()

  store.connectTrustbase()

  render(
    <Provider store={store}>
      <AppWithStore />
    </Provider>,
    document.getElementById('root'),
  )
})
