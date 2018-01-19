import * as React from 'react'

import { withRouter, Redirect, RouteComponentProps } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import {
  TRUSTBASE_CONNECT_STATUS,
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
    const content = isPending
      ? this.pendingContent
      : children

    const currentPathname = this.injectedProps.location.pathname
    if (
      !currentUser
      && canCreateOrImportUser
      && currentPathname !== '/register'
      && !currentPathname.includes('profile')
      && currentPathname !== '/network-settings'
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
