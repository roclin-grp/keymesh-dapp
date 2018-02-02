import * as React from 'react'
import {
  Link,
  withRouter,
  RouteComponentProps,
} from 'react-router-dom'

// component
import {
  Tooltip,
  Icon,
  Dropdown,
  Menu,
  message,
  Button,
} from 'antd'
import SwitchUserOption from '../../components/SwitchUserOption'
import HashAvatar from '../../components/HashAvatar'

// style
import './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../stores'
import {
  MetaMaskStore,
  ETHEREUM_NETWORK_NAMES,
  METAMASK_CONNECT_STATUS,
} from '../../stores/MetaMaskStore'
import {
  ContractStore
} from '../../stores/ContractStore'
import {
  UsersStore
} from '../../stores/UsersStore'
import {
  IUser
} from '../../stores/UserStore'

// helper
import * as copy from 'copy-to-clipboard'
import {
  noop,
} from '../../utils'
import {
  getBEMClassNamesMaker,
  IExtendableClassNamesProps
} from '../../utils/classNames'
import { storeLogger } from '../../utils/loggers'

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
class Header extends React.Component<IProps, IState> {
  public static readonly blockName = 'header'

  public readonly state = Object.freeze({
    hidden: false,
    hasShadow: false,
    isExporting: false,
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(Header.blockName, this.props)

  private isUnmounted = false

  public componentWillUnmount() {
    this.isUnmounted = true
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
          {this.getNetworkStatus()}
          {this.getUserMenu()}
        </div>
      </header>
    )
  }

  private getNetworkStatus() {
    const {isPending} = this.injectedProps.metaMaskStore
    if (isPending) {
      return null
    }

    const {getBEMClassNames} = this
    const {connectStatus} = this.injectedProps.metaMaskStore

    return (
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
        <span
          className={getBEMClassNames('network-options-button', {}, {'ant-dropdown-link': true})}
          // looks like antd does not support keyboard accessibility well
          // tabIndex={0}
        >
          {this.getNetworkText()}
        </span>
      </>
    )
  }

  private getNetworkText() {
    const {
      isNotAvailable,
      isLocked,
      currentEthereumNetwork
    } = this.injectedProps.metaMaskStore

    return (
      <span
        className={this.getBEMClassNames('network-text')}
        title="Current Ethereum network"
      >
        {isNotAvailable && !isLocked
          ? 'No network'
          : (
            ETHEREUM_NETWORK_NAMES[currentEthereumNetwork!]
            || `Custom(${currentEthereumNetwork})`
          )
        }
      </span>
    )
  }

  private getUserMenu() {
    const {
      isPending,
      isActive,
    } = this.injectedProps.metaMaskStore
    if (isPending) {
      return null
    }

    const {
      usersStore: {
        usableUsers,
        isLoadingUsers,
        hasUser,
      },
      contractStore: {
        isNotAvailable: contractsNotAvailable
      },
    } = this.injectedProps

    if (isActive && !contractsNotAvailable && !isLoadingUsers && usableUsers.length === 0) {
      return (
        <Link to="/accounts">
          <Button
            size="large"
            type="primary"
          >
            Create account
          </Button>
        </Link>
      )
    }
    if (!hasUser) {
      return null
    }

    const {getBEMClassNames} = this
    const {user} = this.injectedProps.usersStore.currentUserStore!

    return (
      <Dropdown
        trigger={['click']}
        overlay={this.getUserOptions()}
        placement="bottomRight"
      >
        <a
          title={user.userAddress}
          className={getBEMClassNames('user-options-button', {}, {'ant-dropdown-link': true})}
          // looks like antd does not support keyboard accessibility well
          // tabIndex={0}
        >
          {this.getUserAvatar()}
          <Icon type="down" className={getBEMClassNames('user-avatar-down-icon')} />
        </a>
      </Dropdown>
    )
  }

  private getUserAvatar() {
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

  private getUserOptions() {
    const {getBEMClassNames} = this
    const {
      usableUsers,
    } = this.injectedProps.usersStore
    const {
      user,
    } = this.injectedProps.usersStore.currentUserStore!

    const canExportUser = !this.state.isExporting

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
          <Link to="/discover">
            Discover
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
        {usableUsers.length > 1
          ? (
            <Menu.SubMenu title={<span>Switch user</span>}>
              {
                usableUsers
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
        <Menu.Item>
          <Link className={getBEMClassNames('manage-accounts')} to="/accounts">
            Manage accounts
          </Link>
        </Menu.Item>
      </Menu>
    )
  }

  private handleSelectUser = (user: IUser) => {
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

// constant
const CONNECT_STATUS_INDICATOR_MODIFIER = Object.freeze({
  [METAMASK_CONNECT_STATUS.PENDING]: 'pending',
  [METAMASK_CONNECT_STATUS.ACTIVE]: 'active',
  [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: 'no-account'
}) as {
  [connectStatus: number]: string
}

const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
  [METAMASK_CONNECT_STATUS.ACTIVE]: 'Active',
  [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: 'No account'
}) as {
  [connectStatus: number]: string
}

// typing
type IProps = IExtendableClassNamesProps & RouteComponentProps<{}>

interface IInjectedProps extends IProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
  contractStore: ContractStore
}

interface IState {
  hidden: boolean
  hasShadow: boolean
  isExporting: boolean
}

export default withRouter(Header)
