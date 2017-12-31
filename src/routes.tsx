import * as React from 'react'

import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'

import Home from './pages/home'
import Register from './pages/register'
import Settings from './pages/settings'
import CheckRegister from './pages/check-register'
import NetworkSettings from './pages/network-settings'
import UploadPreKeys from './pages/upload-pre-keys'
import Broadcast from './pages/broadcast'

const App = () => (
  <Router>
    <Switch>
      <Route exact={true} path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route exact={true} path="/settings" component={Settings} />
      <Route exact={true} path="/settings/:networkId" component={NetworkSettings} />
      <Route path="/check-register/:networkId?" component={CheckRegister} />
      <Route path="/upload-pre-keys" component={UploadPreKeys} />
      <Route path="/broadcast" component={Broadcast} />
      <Redirect to="/" />
    </Switch>
  </Router>
)

export default App
