import * as React from 'react'
import {
  Link,
  withRouter,
  RouteComponentProps,
} from 'react-router-dom'

import {
  inject,
  observer,
} from 'mobx-react'

import * as copy from 'copy-to-clipboard'
const throttle = require('lodash.throttle')

import {
  noop,
  getBEMClassNamesMaker,
  IextendableClassNamesProps,
  storeLogger,
} from '../../utils'

import {
  ETHEREUM_NETWORK_NAMES
} from '../../constants'

import {
  ETHEREUM_CONNECT_STATUS,
} from '../../stores/EthereumStore'

import {
  Tooltip,
  Icon,
  Dropdown,
  Menu,
  message,
} from 'antd'

import {
  EthereumStore,
  UsersStore,
  Istores,
} from '../../stores'

import SwitchUserOption from '../../components/SwitchUserOption'
import HashAvatar from '../../components/HashAvatar'
import { Iuser } from '../../../typings/interface'

import './index.css'

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class Header extends React.Component<Iprops, Istate> {
  public static readonly blockName = 'header'

  public readonly state = {
    hidden: false,
    hasShadow: false,
    isExporting: false,
  }

  private readonly injectedProps = this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(Header.blockName, this.props)

  private throttledScrollCallback = throttle(
    (() => {
      let scrollBefore = 0
      return () => {
        if (this.isUnmounted) {
          return
        }
        const scrollCurrent = window.pageYOffset
        const scrollDiff = scrollBefore - scrollCurrent
        const isTop = scrollCurrent === 0
        const DELTA = 7
        const isHidden = this.state.hidden
        if (scrollDiff < -DELTA) {
          if (!isHidden) {
            this.setState({
              hidden: true
            })
          }
        } else if (isTop || scrollDiff > DELTA) {
          if (isHidden || (isTop && this.state.hasShadow)) {
            this.setState({
              hidden: false,
              hasShadow: !isTop
            })
          }
        }
        scrollBefore = scrollCurrent
      }
    })(),
    300
  )

  private isUnmounted = false

  public componentDidMount() {
    document.addEventListener('scroll', this.throttledScrollCallback)
  }

  public componentWillUnmount() {
    this.isUnmounted = true
    document.removeEventListener('scroll', this.throttledScrollCallback)
  }

  public render() {
    const {getBEMClassNames} = this

    return (
      <header
        className={getBEMClassNames(
          '',
          {
            hidden: this.state.hidden,
            shadow: this.state.hasShadow
          }
        )}
      >
        <div className={getBEMClassNames('content', {}, { container: true })}>
          <h1 className={getBEMClassNames('logo')}>
            <Link tabIndex={0} className={getBEMClassNames('logo-text')} to="/">
              Keymail
            </Link>
          </h1>
          {this.networkStatus}
          {this.userMenu}
        </div>
      </header>
    )
  }

  private get networkStatus() {
    const {isPending} = this.injectedProps.ethereumStore
    if (isPending) {
      return null
    }

    const {getBEMClassNames} = this
    const {ethereumConnectStatus} = this.injectedProps.ethereumStore

    return (
      <>
        <Tooltip title={CONNECT_STATUS_INDICATOR_TEXTS[ethereumConnectStatus]}>
          <span
            title="Network status"
            className={getBEMClassNames('network-indicator-wrapper')}
          >
            <span
              className={getBEMClassNames('network-indicator', {
                [CONNECT_STATUS_INDICATOR_MODIFIER[ethereumConnectStatus]]: true
              })}
            />
          </span>
        </Tooltip>
        <span
          className={getBEMClassNames('network-options-button', {}, {'ant-dropdown-link': true})}
          // looks like antd does not support keyboard accessibility well
          // tabIndex={0}
        >
          {this.networkText}
        </span>
      </>
    )
  }

  private get networkText() {
    const {
      hasError,
      isMetaMaskLocked,
      currentEthereumNetwork
    } = this.injectedProps.ethereumStore

    return (
      <span
        className={this.getBEMClassNames('network-text')}
        title="Current Ethereum network"
      >
        {hasError && !isMetaMaskLocked
          ? 'No network'
          : (
            ETHEREUM_NETWORK_NAMES[currentEthereumNetwork!]
            || `Custom(${currentEthereumNetwork})`
          )
        }
      </span>
    )
  }

  private get userMenu() {
    const {isPending} = this.injectedProps.ethereumStore
    if (isPending) {
      return null
    }

    const {hasUser} = this.injectedProps.usersStore
    if (!hasUser) {
      return null
    }

    const {getBEMClassNames} = this
    const {user} = this.injectedProps.usersStore.currentUserStore!

    return (
      <Dropdown
        trigger={['click']}
        overlay={this.userOptions}
        placement="bottomRight"
      >
        <a
          title={user.userAddress}
          className={getBEMClassNames('user-options-button', {}, {'ant-dropdown-link': true})}
          // looks like antd does not support keyboard accessibility well
          // tabIndex={0}
        >
          {this.userAvatar}
          <Icon type="down" className={getBEMClassNames('user-avatar-down-icon')} />
        </a>
      </Dropdown>
    )
  }

  private get userAvatar() {
    const {getBEMClassNames} = this
    const {avatarHash} = this.injectedProps.usersStore.currentUserStore!

    return (
      <HashAvatar
        className={getBEMClassNames('user-avatar')}
        shape="square"
        size="small"
        hash={avatarHash}
      />
    )
  }

  private get userOptions() {
    const {getBEMClassNames} = this
    const {
      users,
      canCreateOrImportUser
    } = this.injectedProps.usersStore
    const {
      user,
      isDatabaseLoaded
    } = this.injectedProps.usersStore.currentUserStore!

    const canExportUser = isDatabaseLoaded && !this.state.isExporting

    return (
      <Menu>
        <Menu.Item
          className={getBEMClassNames('current-user-address')}
          disabled={true}
        >
          {`Using `}
          <Tooltip
            placement="topLeft"
            title="Click to copy"
          >
            <span
              title={user.userAddress}
              className={getBEMClassNames('user-address')}
              onClick={this.handleCopyUserAddress}
            >
              {user.userAddress.slice(0, 8)}...
            </span>
          </Tooltip>
        </Menu.Item>
        <Menu.Item>
          <Link to="/broadcast">
            Broadcast
          </Link>
        </Menu.Item>
        <Menu.Item>
          <Link to="/profile">
            Profile
          </Link>
        </Menu.Item>
        <Menu.Item
          disabled={!canExportUser}
        >
          <a onClick={canExportUser ? this.handleExport : noop}>
            Export account
          </a>
        </Menu.Item>
        <Menu.Divider />
        {users.length > 1
          ? (
            <Menu.SubMenu title={<span>Switch user</span>}>
              {
                users
                  .filter((_user) => _user.userAddress !== user.userAddress)
                  .map((_user) => (
                    <Menu.Item key={`${_user.userAddress}@${_user.networkId}`}>
                      <SwitchUserOption user={_user} onSelect={this.handleSelectUser} />
                    </Menu.Item>
                  ))
              }
            </Menu.SubMenu>
          )
          : null
        }
        {
          canCreateOrImportUser
            ? (
              <Menu.Item>
                <Link className={getBEMClassNames('register-new')} to="/register">
                  Sign up/Import
                </Link>
              </Menu.Item>
            )
            : null
        }
      </Menu>
    )
  }

  private handleSelectUser = (user: Iuser) => {
    window.setTimeout(
      () => this.injectedProps.usersStore.switchUser(user),
      300
    )
  }

  private handleExport = async () => {
    this.setState({
      isExporting: true
    })
    try {
      const {
        exportUser
      } = this.injectedProps.usersStore.currentUserStore!
      await exportUser()
    } catch (err) {
      storeLogger.error('Unexpected export user error:', err)
      if (!this.isUnmounted) {
        message.error('Export user fail, please retry.')
      }
    } finally {
      if (!this.isUnmounted) {
        this.setState({
          isExporting: false
        })
      }
    }
  }

  private handleCopyUserAddress = () => {
    const {
      user,
    } = this.injectedProps.usersStore.currentUserStore!
    if (copy(user.userAddress)) {
      message.success('User address copied!', 1.3)
    }
  }
}

const CONNECT_STATUS_INDICATOR_MODIFIER = Object.freeze({
  [ETHEREUM_CONNECT_STATUS.PENDING]: 'pending',
  [ETHEREUM_CONNECT_STATUS.ACTIVE]: 'active',
  [ETHEREUM_CONNECT_STATUS.ERROR]: 'error'
}) as {
  [connectStatus: number]: string
}

const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
  [ETHEREUM_CONNECT_STATUS.ACTIVE]: 'Active',
  [ETHEREUM_CONNECT_STATUS.ERROR]: 'Error'
}) as {
  [connectStatus: number]: string
}

type Iprops = IextendableClassNamesProps & RouteComponentProps<{}>

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  hidden: boolean
  hasShadow: boolean
  isExporting: boolean
}

export default withRouter(Header)
