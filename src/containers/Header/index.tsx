import * as React from 'react'

import {
  Link,
  withRouter,
  RouteComponentProps,
} from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'

import { sha3 } from 'trustbase'

import * as copy from 'copy-to-clipboard'
const throttle = require('lodash.throttle')

import {
  storeLogger,
  downloadObjectAsJson,
  getBEMClassNamesMaker,
  IextendableClassNamesProps,
} from '../../utils'

import {
  NETWORKS,
  TRUSTBASE_CONNECT_STATUS,
  NETWORK_NAMES,
  CONNECT_STATUS_INDICATOR_MODIFIER,
  CONNECT_STATUS_INDICATOR_TEXTS,
  USER_STATUS,
} from '../../constants'

import {
  Tooltip,
  Avatar,
  Icon,
  Dropdown,
  Menu,
  message,
} from 'antd'

import SwitchNetworkOption from '../../components/SwitchNetworkOption'
import SwitchUserOption from '../../components/SwitchUserOption'
import HashAvatar from '../../components/HashAvatar'
import { Iuser } from '../../../typings/interface'

import './index.css'

interface Iprops extends IextendableClassNamesProps, RouteComponentProps<{}> {
  shouldRefreshSessions?: boolean
}

interface IinjectedProps extends Iprops {
  store: Store
}

interface Istate {
  isSwitchingUser: boolean
  hidden: boolean
  hasShadow: boolean
}

@inject('store') @observer
class Header extends React.Component<Iprops, Istate> {
  public static readonly blockName = 'header'

  public static defaultProps = {
    shouldRefreshSessions: false,
    className: '',
    prefixClass: ''
  }

  public readonly state = {
    isSwitchingUser: false,
    hidden: false,
    hasShadow: false
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
    const {
      connectStatus,
      currentEthereumNetwork,
      currentUser,
      currentNetworkUsers,
      offlineAvailableNetworks,
      offlineSelectedEthereumNetwork,
      canCreateOrImportUser
    } = this.injectedProps.store
    const {getBEMClassNames} = this
    const isPending = connectStatus === TRUSTBASE_CONNECT_STATUS.PENDING
    const hasMoreThanOneNetworks = offlineAvailableNetworks.length > 1
    const hasConnectError = connectStatus === TRUSTBASE_CONNECT_STATUS.ERROR
    const isOffline = connectStatus === TRUSTBASE_CONNECT_STATUS.OFFLINE
    const canSelectNetworks = isOffline && hasMoreThanOneNetworks

    const userAvatar = (() => {
      if (!currentUser) {
        return null
      }

      const avatarShape = 'square'
      const avatarSize = 'small'
      const avatarClassName = getBEMClassNames('user-avatar')

      if (this.state.isSwitchingUser) {
        return (
          <Avatar
            className={avatarClassName}
            icon="ellipsis"
            shape={avatarShape}
            size={avatarSize}
          />
        )
      }

      return (
        <HashAvatar
          className={avatarClassName}
          shape={avatarShape}
          size={avatarSize}
          hash={currentUser.status !== USER_STATUS.PENDING
            ? sha3(`${currentUser.userAddress}${currentUser.blockHash}`)
            : ''
          }
        />
      )
    })()

    const userOptions = currentUser
      ? (
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
                title={currentUser.userAddress}
                className={getBEMClassNames('user-address')}
                onClick={this.handleCopyUserAddress}
              >
                {currentUser.userAddress.slice(0, 8)}...
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
          <Menu.Item>
            <a onClick={this.handleExport}>
              Export account
            </a>
          </Menu.Item>
          <Menu.Divider />
          {currentNetworkUsers.length > 1
            ? (
              <Menu.SubMenu title={<span>Switch user</span>}>
                {
                  currentNetworkUsers
                    .filter((user) => user.userAddress !== currentUser.userAddress)
                    .map((user) => (
                      <Menu.Item key={`${user.userAddress}@${user.networkId}`}>
                        <SwitchUserOption user={user} onSelect={this.handleSelectUser} />
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
      : null

    const networkText = (
      <span
        className={getBEMClassNames('network-text')}
        title="Current Ethereum network"
      >
        {!offlineSelectedEthereumNetwork && (hasConnectError || isOffline)
            ? 'No network'
            : (
              NETWORK_NAMES[currentEthereumNetwork as NETWORKS]
              || NETWORK_NAMES[offlineSelectedEthereumNetwork as NETWORKS]
              || `Custom(${currentEthereumNetwork})`
            )
        }
      </span>
    )

    const networkOptions = (
      <Menu>
        {canSelectNetworks
          ? (
            <>
            <Menu.SubMenu title={<span>Switch network</span>}>
              {offlineAvailableNetworks
                .filter((networkId) => networkId !== currentEthereumNetwork)
                .map((networkId) => (
                  <Menu.Item key={networkId}>
                    <SwitchNetworkOption
                      networkId={networkId}
                      onSelect={this.handleSelectNetwork}
                    />
                  </Menu.Item>
                ))
              }
            </Menu.SubMenu>
            <Menu.Divider />
            </>
          )
          : null
        }
        <Menu.Item>
          <Link to="network-settings">
            Settings
          </Link>
        </Menu.Item>
      </Menu>
    )

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
          {!isPending
            ? (
              <>
                <Tooltip title={CONNECT_STATUS_INDICATOR_TEXTS[connectStatus]}>
                  <span
                    title="Network status"
                    className={getBEMClassNames('network-indicator-wrapper')}
                  >
                    <span
                      className={getBEMClassNames('network-indicator', {
                        [CONNECT_STATUS_INDICATOR_MODIFIER[connectStatus]]: true
                      })}
                    />
                  </span>
                </Tooltip>
                <Dropdown
                  trigger={['click']}
                  overlay={networkOptions}
                  placement="bottomRight"
                >
                  <a
                    className={getBEMClassNames('network-options-button', {}, {'ant-dropdown-link': true})}
                    // looks like antd does not support keyboard accessibility well
                    // tabIndex={0}
                  >
                    {networkText}
                    <Icon type="down" className={getBEMClassNames('user-avatar-down-icon')} />
                  </a>
                </Dropdown>
                {currentUser
                  ? (
                    <Dropdown
                      trigger={['click']}
                      overlay={userOptions}
                      placement="bottomRight"
                    >
                      <a
                        title={currentUser.userAddress}
                        className={getBEMClassNames('user-options-button', {}, {'ant-dropdown-link': true})}
                        // looks like antd does not support keyboard accessibility well
                        // tabIndex={0}
                      >
                        {userAvatar}
                        <Icon type="down" className={getBEMClassNames('user-avatar-down-icon')} />
                      </a>
                    </Dropdown>
                  )
                  : null
                }
              </>
            )
            : null
          }
        </div>
      </header>
    )
  }

  private handleSelectNetwork = (networkId: NETWORKS) => {
    this.injectedProps.store.selectOfflineNetwork(networkId, this.props.shouldRefreshSessions).catch((err: Error) => {
      storeLogger.error(err)
      message.error('Something has gone wrong! please retry.')
    })
  }

  private handleSelectUser = (user: Iuser) => {
    this.setState({
      isSwitchingUser: true
    })
    window.setTimeout(
      () => this.injectedProps.store.useUser(user, this.props.shouldRefreshSessions, this.selectUserCallback),
      50
    )
  }

  private selectUserCallback = () => {
    if (this.isUnmounted) {
      return
    }
    const pathname = this.injectedProps.location.pathname
    this.setState({
      isSwitchingUser: false
    })
    if (pathname === '/check-register' || pathname === '/upload-pre-keys') {
      this.injectedProps.history.replace('/')
    }
  }

  private handleExport = async () => {
    const {
      currentUser,
      dumpCurrentUser
    } = this.injectedProps.store
    if (currentUser) {
      const dumped = await dumpCurrentUser()
      downloadObjectAsJson(dumped, `keymail@${currentUser.networkId}@${currentUser.userAddress}`)
    }
  }

  private handleCopyUserAddress = () => {
    const {currentUser} = this.injectedProps.store
    if (currentUser) {
      if (copy(currentUser.userAddress)) {
        message.success('User address copied!', 1.3)
      }
    }
  }
}

export default withRouter(Header)
