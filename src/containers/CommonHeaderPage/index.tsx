import * as React from 'react'

import { withRouter, Redirect, RouteComponentProps } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import {
  EthereumStore,
  UsersStore,
  Istores,
} from '../../stores'

import {
  ETHEREUM_CONNECT_ERROR_CODE
} from '../../stores/EthereumStore'

import {
  USER_STATUS
} from '../../constants'

import { getBEMClassNamesMaker, IextendableClassNamesProps } from '../../utils'

import { Icon } from 'antd'
import Header from '../Header'

import './index.css'

interface Iprops extends IextendableClassNamesProps, RouteComponentProps<{}> {
  shouldRefreshSessions?: boolean
}

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class CommonHeaderPage extends React.Component<Iprops> {
  public static readonly blockName = 'common-header-page'

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(CommonHeaderPage.blockName, this.props)

  private readonly pendingContent = (
    <>
      <Icon type="loading" className={this.getBEMClassNames('loading')} />
      <p>Connecting to Etereum network...</p>
    </>
  )

  private get errorContent() {
    const {
      ethereumConnectErrorCode
    } = this.injectedProps.ethereumStore
    switch (ethereumConnectErrorCode) {
      case ETHEREUM_CONNECT_ERROR_CODE.NO_METAMASK: {
        return (
          <>
            <Icon type="exclamation-circle-o" className={this.getBEMClassNames('warning')} />
            <h1>
              You need to install
              <a target="_blank" href="https://metamask.io/">MetaMask</a>
              before using this app.
            </h1>
          </>
        )
      }
      case ETHEREUM_CONNECT_ERROR_CODE.LOCKED: {
        return (
          <>
            <Icon type="lock" className={this.getBEMClassNames('warning')} />
            <h1>You need to unlock MetaMask.</h1>
          </>
        )
      }
      case ETHEREUM_CONNECT_ERROR_CODE.UNKNOWN:
      default:
        return (
          <>
            <Icon type="close-circle-o" className={this.getBEMClassNames('error')} />
            <h1>Something went wrong!</h1>
            <a target="_blank" href="https://github.com/ceoimon/keymail-webapp/issues/new">Report bugs</a>
            <details>
              <summary>{this.injectedProps.ethereumStore.ethereumConnectError!.message}</summary>
              <pre>{this.injectedProps.ethereumStore.ethereumConnectError!.stack}</pre>
            </details>
          </>
        )
    }
  }

  public render() {
    const {
      children,
      prefixClass
    } = this.props
    const {
      ethereumStore: {
        isPending,
        hasError,
      },
      usersStore: {
        canCreateOrImportUser,
        currentUserStore,
        hasUser
      }
    } = this.injectedProps
    const {
      getBEMClassNames
    } = this

    const currentPathname = this.injectedProps.location.pathname

    if (hasUser) {
      if (
        currentPathname !== '/register'
        && currentPathname !== '/check-register'
        && currentUserStore!.user.status !== USER_STATUS.OK
      ) {
        return <Redirect to="/check-register" />
      }
    } else if (
      canCreateOrImportUser
      && currentPathname !== '/register'
      && !currentPathname.includes('profile')
    ) {
      return <Redirect to="/register" />
    }

    const content = isPending
      ? this.pendingContent
      : (
        hasError
          ? this.errorContent
          : children
      )

    return (
      <div className={getBEMClassNames()}>
        <Header prefixClass={prefixClass} />
        <div className={getBEMClassNames('content')}>
          {content}
        </div>
      </div>
    )
  }
}

export default withRouter(CommonHeaderPage)
