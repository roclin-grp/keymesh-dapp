import * as React from 'react'

import {
  Link,
  withRouter,
  RouteComponentProps,
} from 'react-router-dom'

import { inject, observer } from 'mobx-react'

import { sha3 } from 'trustbase'

import * as copy from 'copy-to-clipboard'
const throttle = require('lodash.throttle')

import {
  // downloadObjectAsJson,
  getBEMClassNamesMaker,
  IextendableClassNamesProps,
} from '../../utils'

import {
  NETWORKS,
  ETHEREUM_CONNECT_STATUS,
  ETHEREUM_CONNECT_ERROR,
  NETWORK_NAMES,
  CONNECT_STATUS_INDICATOR_MODIFIER,
  CONNECT_STATUS_INDICATOR_TEXTS,
  USER_STATUS,
} from '../../constants'

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

interface Iprops extends IextendableClassNamesProps, RouteComponentProps<{}> {
  shouldRefreshSessions?: boolean
}

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  hidden: boolean
  hasShadow: boolean
}

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

  public static defaultProps = {
    shouldRefreshSessions: false,
    className: '',
    prefixClass: ''
  }

  public readonly state = {
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
      ethereumStore: {
        ethereumConnectStatus,
        ethereumConnectErrorCode,
        currentEthereumNetwork,
      },
      usersStore: {
        currentUserStore,
        hasUser
      },
    } = this.injectedProps
    const {getBEMClassNames} = this
    const isPending = ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.PENDING
    const hasConnectError = ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.ERROR
    const user = hasUser ? currentUserStore!.user : undefined

    const networkText = (
      <span
        className={getBEMClassNames('network-text')}
        title="Current Ethereum network"
      >
        {hasConnectError && ethereumConnectErrorCode !== ETHEREUM_CONNECT_ERROR.LOCKED
          ? 'No network'
          : (
            NETWORK_NAMES[currentEthereumNetwork as NETWORKS]
            || `Custom(${currentEthereumNetwork})`
          )
        }
      </span>
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
                  {networkText}
                </span>
                {hasUser
                  ? (
                    <Dropdown
                      trigger={['click']}
                      overlay={this.userOptions}
                      placement="bottomRight"
                    >
                      <a
                        title={user!.userAddress}
                        className={getBEMClassNames('user-options-button', {}, {'ant-dropdown-link': true})}
                        // looks like antd does not support keyboard accessibility well
                        // tabIndex={0}
                      >
                        {this.userAvatar}
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

  private get userAvatar() {
    const {user} = this.injectedProps.usersStore.currentUserStore!

    const avatarShape = 'square'
    const avatarSize = 'small'
    const avatarClassName = this.getBEMClassNames('user-avatar')

    return (
      <HashAvatar
        className={avatarClassName}
        shape={avatarShape}
        size={avatarSize}
        hash={user.status !== USER_STATUS.PENDING
          ? sha3(`${user.userAddress}${user.blockHash}`)
          : ''
        }
      />
    )
  }

  private get userOptions() {
    const {
      getBEMClassNames
    } = this
    const {
      users,
      canCreateOrImportUser
    } = this.injectedProps.usersStore
    const {user} = this.injectedProps.usersStore.currentUserStore!
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
              title={user!.userAddress}
              className={getBEMClassNames('user-address')}
              onClick={this.handleCopyUserAddress}
            >
              {user!.userAddress.slice(0, 8)}...
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
        {users.length > 1
          ? (
            <Menu.SubMenu title={<span>Switch user</span>}>
              {
                users
                  .filter((_user) => _user.userAddress !== user!.userAddress)
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
    // const {
    //   currentUserStore,
    //   dumpCurrentUser
    // } = this.injectedProps.usersStore
    // const {user} = currentUserStore!
    // const dumped = await dumpCurrentUser()
    // downloadObjectAsJson(dumped, `keymail@${user.networkId}@${user.userAddress}`)
  }

  private handleCopyUserAddress = () => {
    const {
      currentUserStore,
    } = this.injectedProps.usersStore
    const {user} = currentUserStore!
    if (copy(user.userAddress)) {
      message.success('User address copied!', 1.3)
    }
  }
}

export default withRouter(Header)
