import * as React from 'react'

import {
  BrowserRouter as Router,
  Route,
  Switch
} from 'react-router-dom'

import Home from './pages/home'
import Register from './pages/register'
import Settings from './pages/settings'
import Send from './pages/send'

const App = () => (
  <Router>
    <Switch>
      <Route exact path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/settings" component={Settings} />
      <Route path="/send" component={Send} />
    </Switch>
  </Router>
)

export default App
