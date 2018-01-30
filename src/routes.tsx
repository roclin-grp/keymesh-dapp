import * as React from 'react'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  RouteProps,
} from 'react-router-dom'

import Home from './pages/home'
import Register from './pages/register'
import CheckRegister from './pages/check-register'
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
    return (
      <Router>
        {this.content}
      </Router>
    )
  }

  private get content() {
    const {
      ethereumStore: {
        isPending,
        hasError,
      },
      usersStore: {
        isUsersLoading
      }
    } = this.injectedProps
    const { CheckUserRoute } = this
    const isLoading = isPending || isUsersLoading

    if (hasError) {
      return <Route component={ErrorPage} />
    }

    if (isLoading) {
      return <Route component={Loading} />
    }

    return (
      <Switch>
        <CheckUserRoute exact={true} path="/" component={Home} />
        <Route path="/register" render={this.renderRegister} />
        <CheckUserRoute path="/check-register" component={CheckRegister} />
        <CheckUserRoute path="/broadcast" component={Broadcast} />
        <CheckUserRoute exact={true} path="/profile" component={Profile} />
        <Route path="/profile/:userAddress" component={Profile} />
        <CheckUserRoute path="/proving/:platform" component={Proving} />
        <Redirect to="/" />
      </Switch>
    )
  }

  private CheckUserRoute = (
    { component: Component, ...rest }: { component: React.ComponentClass } & RouteProps
  ) => {
    const {
      usersStore: {
        hasUser,
        currentUserStore,
        canCreateOrImportUser
      }
    } = this.injectedProps

    return (
      <Route
        {...rest as RouteProps}
        render={props => {
          if (hasUser) {
            if (
              !currentUserStore!.isRegisterCompleted
              && props.location.pathname !== '/check-register'
            ) {
              return <Redirect to="/check-register" />
            }
          } else if (canCreateOrImportUser) {
            return <Redirect to="/register" />
          }
          return <Component {...props} />
        }}
      />
    )
  }

  private renderRegister = (props: RouteProps) => {
    const {
      usersStore: {
        canCreateOrImportUser
      }
    } = this.injectedProps
    return canCreateOrImportUser ? <Register {...props} /> : <Redirect to="/" />
  }
}

type Iprops = {}

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

export default App
