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
import Profile from './pages/profile'
import Proving from './pages/proving'
import Loading from './pages/loading'
import ErrorPage from './pages/error'

import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
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
}: IStores) => ({
  ethereumStore,
  usersStore
}))
@observer
class App extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

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
              <Route path="/discover" component={Broadcast} />
              <Route path="/accounts" component={Accounts} />
              <Route path="/profile/:userAddress" component={Profile} />
              {/* <RequireUserRoute path="/broadcast" component={Broadcast} /> */}
              <ConditionalRoute
                path="/chat"
                component={Chat}
                predicate={hasUser}
                redirectTo="/accounts"
              />
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

type IProps = {}

interface IInjectedProps extends IProps {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

function Chat() {
  return <pre>/chat</pre>
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
