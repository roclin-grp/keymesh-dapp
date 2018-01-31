import * as React from 'react'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  RouteProps,
} from 'react-router-dom'

// import Home from './pages/home'
import Accounts from './pages/accounts'
import Header from './containers/Header'
import Broadcast from './pages/broadcast'
// import Profile from './pages/profile'
import Proving from './pages/proving'
import Loading from './pages/loading'
import ErrorPage from './pages/error'

import {
  inject,
  observer,
} from 'mobx-react'
import {
  Istores,
} from './stores'
import {
  EthereumStore,
} from './stores/EthereumStore'
import {
  UsersStore,
} from './stores/UsersStore'

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class App extends React.Component<Iprops> {
  private readonly injectedProps = this.props as Readonly<IinjectedProps>

  public render() {
    const {
      ethereumStore: {
        isPending,
        // hasError,
      },
      usersStore: {
        hasUser,
        isLoadingUsers,
      }
    } = this.injectedProps

    const isLoading = isPending || isLoadingUsers

    if (this.injectedProps.ethereumStore.hasError) {
      return (
        <Router>
          <>
            <Header />
            <div className="page-content">
              <ErrorPage />
            </div>
          </>
        </Router>
      )
    }

    if (isLoading) {
      return (
        <Router>
          <>
            <Header />
            <div className="page-content">
              <Loading />
            </div>
          </>
        </Router>
      )
    }

    return (
      <Router>
        <>
          <Header />
          <div className="page-content">
            <Switch>
              <Redirect from="/" exact={true} to="/discover" />
              <Route path="/discover" component={Discover} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/profile/:userAddress" component={Profile} />
              {/* <RequireUserRoute path="/broadcast" component={Broadcast} /> */}
              <ConditionalRoute
                path="/broadcast"
                component={Broadcast}
                predicate={hasUser}
                redirectTo="/accounts"
              />
              <ConditionalRoute
                path="/profile"
                exact={true}
                component={Profile}
                predicate={hasUser}
                redirectTo="/accounts"
              />
              <ConditionalRoute
                path="/proving/:platform"
                component={Proving}
                predicate={hasUser}
                redirectTo="/accounts"
              />
              <Route component={NotFound} />
            </Switch>
          </div>
        </>
      </Router>
    )
  }
}

type Iprops = {}

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

function Profile() {
  return <pre>/profile</pre>
}

function Discover() {
  return <pre>/discover</pre>
}

function NotFound() {
  return <pre>not found</pre>
}

const ConditionalRoute = ({
  predicate,
  component,
  elseComponent,
  redirectTo,
  ...rest
}: {
  predicate: boolean
  elseComponent?: typeof component
  redirectTo?: string
} & RouteProps) => {
  let returnComponent: typeof component
  if (predicate) {
    returnComponent = component
  } else if (typeof elseComponent === 'undefined') {
    return <Redirect to={redirectTo!} />
  } else {
    returnComponent = elseComponent
  }

  return <Route component={returnComponent} {...rest} />
}

export default App
