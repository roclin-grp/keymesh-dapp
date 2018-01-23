import * as React from 'react'

import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'

import Home from './pages/home'
import Register from './pages/register'
import CheckRegister from './pages/check-register'
import Broadcast from './pages/broadcast'
import Profile from './pages/profile'
import Proving from './pages/proving'

const App = () => (
  <Router>
    <Switch>
      <Route exact={true} path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/check-register" component={CheckRegister} />
      <Route path="/broadcast" component={Broadcast} />
      <Route path="/profile/:userAddress?" component={Profile} />
      <Route path="/proving/:platform" component={Proving} />
      <Redirect to="/" />
    </Switch>
  </Router>
)

export default App
