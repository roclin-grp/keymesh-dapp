import * as React from 'react'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  RouteProps,
} from 'react-router-dom'

import MetaMaskConnectFailPage from './pages/MetaMaskConnectFailPage'
import ErrorPage from './pages/ErrorPage'
// import Home from './pages/home'
import Accounts from './pages/accounts'
import Header from './containers/Header'
import Broadcast from './pages/broadcast'
import Profile from './pages/profile'
import Proving from './pages/proving'
import Loading from './pages/loading'

import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from './stores'
import {
  MetaMaskStore,
} from './stores/MetaMaskStore'
import {
  ContractStore,
} from './stores/ContractStore'
import {
  UsersStore,
} from './stores/UsersStore'

@inject(({
  metaMaskStore,
  usersStore,
  contractStore,
}: IStores) => ({
  metaMaskStore,
  usersStore,
  contractStore,
}))
@observer
class App extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  public render() {
    return (
      <Router>
        <>
          <Header />
          <div className="page-content">
            {this.renderContent()}
          </div>
        </>
      </Router>
    )
  }

  private renderContent() {
    const {
      metaMaskStore: {
        isPending,
        isNotAvailable: isMetaMaskNotAvailable,
      },
      usersStore: {
        isLoadingUsers,
      },
      contractStore: {
        isNotAvailable: isContractsNotAvailable,
        instantiationError
      },
    } = this.injectedProps

    // connect MetaMask
    if (isPending) {
      return <Loading message="Connecting to MetaMask..." />
    }
    if (isMetaMaskNotAvailable) {
      return <MetaMaskConnectFailPage />
    }
    // contracts instantiation
    if (isContractsNotAvailable) {
      return <ErrorPage message="Current network is not supported!" errorStack={instantiationError!.stack} />
    }
    // load data
    if (isLoadingUsers) {
      return <Loading message="Loading local data..." />
    }

    return this.getRoutes()
  }

  private getRoutes() {
    const {
      hasUser,
    } = this.injectedProps.usersStore

    return (
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
    )
  }
}

type IProps = {}

interface IInjectedProps extends IProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
  contractStore: ContractStore
}

function Chat() {
  return <pre>/chat</pre>
}

function NotFound() {
  return <pre>Not found</pre>
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
