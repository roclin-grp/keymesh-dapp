import * as React from 'react'

import { withRouter, Redirect, RouteComponentProps } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
  TRUSTBASE_CONNECT_ERROR,
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
  store: Store
}

@inject('store') @observer
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
      connectErrorCode
    } = this.injectedProps.store
    switch (connectErrorCode) {
      case TRUSTBASE_CONNECT_ERROR.NO_METAMASK: {
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
      case TRUSTBASE_CONNECT_ERROR.LOCKED: {
        return (
          <>
            <Icon type="lock" className={this.getBEMClassNames('warning')} />
            <h1>You need to unlock MetaMask.</h1>
          </>
        )
      }
      case TRUSTBASE_CONNECT_ERROR.NO_NETWORK: {
        return (
          <>
            <Icon type="disconnect" className={this.getBEMClassNames('warning')} />
            <h1>Your internet is broken. :(</h1>
          </>
        )
      }
      case TRUSTBASE_CONNECT_ERROR.UNKNOWN:
      default: return (
        <>
          <Icon type="close-circle-o" className={this.getBEMClassNames('error')} />
          <h1>Something went wrong!</h1>
          <a target="_blank" href="https://github.com/ceoimon/keymail-webapp/issues/new">Report bugs</a>
          <details>
            <summary>{(this.injectedProps.store.connectError as Error).message}</summary>
            <pre>{(this.injectedProps.store.connectError as Error).stack}</pre>
          </details>
        </>
      )
    }
  }

  public render() {
    const {
      children,
      shouldRefreshSessions,
      prefixClass
    } = this.props
    const {
      connectStatus,
      currentUser,
      canCreateOrImportUser
    } = this.injectedProps.store
    const {
      getBEMClassNames
    } = this

    const isPending = connectStatus === TRUSTBASE_CONNECT_STATUS.PENDING
    const isError = connectStatus === TRUSTBASE_CONNECT_STATUS.ERROR
    const content = isPending
      ? this.pendingContent
      : isError
        ? this.errorContent
        : children

    const currentPathname = this.injectedProps.location.pathname
    if (
      !currentUser
      && canCreateOrImportUser
      && currentPathname !== '/register'
      && !currentPathname.includes('profile')
    ) {
      return <Redirect to="/register" />
    }
    if (currentUser && currentPathname !== '/register') {
      if (currentUser.status !== USER_STATUS.OK && currentPathname !== '/check-register') {
        return <Redirect to="/check-register" />
      }
    }
    return (
      <div className={getBEMClassNames()}>
        <Header prefixClass={prefixClass} shouldRefreshSessions={shouldRefreshSessions} />
        <div className={getBEMClassNames('content')}>
          {content}
        </div>
      </div>
    )
  }
}

export default withRouter(CommonHeaderPage)
