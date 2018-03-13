import * as React from 'react'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  RouteProps,
} from 'react-router-dom'

import Header from './containers/Header'
import MetaMaskConnectFailPage, {
  CONNECT_STATUS,
} from './pages/MetaMaskConnectFailPage'
import Loading from './pages/LoadingPage'
import Chat from './pages/chat'
import Accounts from './pages/accounts'
import Broadcast from './pages/broadcast'
import Profile from './pages/profile'
import Proving from './pages/proving'
import GettingStarted from './pages/getting-started'
import Register from './pages/register'

import { Provider, observer } from 'mobx-react'
import { IStores } from './stores'

@observer
class App extends React.Component<IProps> {
  public render() {
    const { stores } = this.props

    const content = (
      <Router>
        <>
          <Header stores={stores} />
          <main className="main">{this.renderContent(stores)}</main>
        </>
      </Router>
    )

    if (stores == null) {
      return content
    }

    return (
      <Provider {...stores}>
        {content}
      </Provider>
    )
  }

  private renderContent(stores?: IStores) {
    if (stores == null) {
      return <MetaMaskConnectFailPage status={CONNECT_STATUS.NO_METAMASK} />
    }

    const { metaMaskStore, contractStore, usersStore } = stores

    const { isPending, isLocked, isWrongNetwork } = metaMaskStore
    // connect MetaMask
    if (isPending) {
      return <Loading message="Connecting to MetaMask..." />
    }
    if (isWrongNetwork) {
      return <MetaMaskConnectFailPage status={CONNECT_STATUS.WRONG_NETWORK} />
    }
    if (isLocked) {
      return <MetaMaskConnectFailPage status={CONNECT_STATUS.LOCKED} />
    }

    const { isLoadingContracts } = contractStore
    // contracts instantiation
    if (isLoadingContracts) {
      return <Loading message="Loading KeyMesh contracts..." />
    }

    const { isLoadingUsers } = usersStore
    // load data
    if (isLoadingUsers) {
      return <Loading message="Loading local data..." />
    }

    return this.renderRoutes(stores)
  }

  private renderRoutes(stores: IStores) {
    const { hasUser } = stores.usersStore

    return (
      <Switch>
        <Redirect from="/" exact={true} to="/broadcast" />
        <Route path="/broadcast" component={Broadcast} />
        <Route path="/register" component={Register} />
        <Route path="/profile/:userAddress" component={Profile} />
        <ConditionalRoute
          path="/accounts"
          component={Accounts}
          predicate={hasUser}
          redirectTo="/register"
        />
        <ConditionalRoute
          path="/getting-started"
          component={GettingStarted}
          predicate={hasUser}
          redirectTo="/register"
        />
        <ConditionalRoute
          path="/messages"
          component={Chat}
          predicate={hasUser}
          redirectTo="/register"
        />
        <ConditionalRoute
          path="/profile"
          exact={true}
          component={Profile}
          predicate={hasUser}
          redirectTo="/register"
        />
        <ConditionalRoute
          path="/proving/:platform"
          component={Proving}
          predicate={hasUser}
          redirectTo="/register"
        />
        <Route path="/:twitterUsername" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    )
  }
}

interface IProps {
  stores?: IStores
}

function NotFound() {
  return <pre>Not found</pre>
}

const ConditionalRoute = ({
  predicate,
  component,
  elseComponent,
  redirectTo,
  ...rest,
}: {
  predicate: boolean
  elseComponent?: typeof component
  redirectTo?: string,
} & RouteProps) => {
  let returnComponent: typeof component
  if (predicate) {
    returnComponent = component
  } else if (elseComponent == null) {
    return <Redirect to={redirectTo!} />
  } else {
    returnComponent = elseComponent
  }

  return <Route component={returnComponent} {...rest} />
}

export default App
