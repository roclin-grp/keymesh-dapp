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
import SwitchUserOption from './SwitchUserOption'
import HashAvatar from '../../components/HashAvatar'
import UserAddress from '../../components/UserAddress'

// style
import classnames from 'classnames'
import * as styles from './index.css'

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
  ContractStore,
} from '../../stores/ContractStore'
import {
  UsersStore,
} from '../../stores/UsersStore'
import {
  IUser,
} from '../../stores/UserStore'

// helper
import copy from 'copy-to-clipboard'
import {
  noop,
} from '../../utils'
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
  public readonly state = Object.freeze({
    isExporting: false,
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private isUnmounted = false

  public componentWillUnmount() {
    this.isUnmounted = true
  }

  public render() {
    return (
      <header className={styles.header}>
        <div className={classnames(styles.content, 'container')}>
          <h1 className={styles.logo}>
            <Link
              tabIndex={0}
              className={styles.logoText}
              to="/"
            >
              Keymesh
            </Link>
          </h1>
          <Menu
            inlineIndent={24}
            openTransitionName="slide-up"
            theme="light"
            className={classnames(styles.menu, 'menu-site')}
            selectedKeys={[this.props.location.pathname]}
            mode="horizontal"
          >
            <Menu.Item key="/discover">
              <Link to="/discover" className={styles.menuItem}>
                <Icon type="bulb" className={styles.menuIcon} />
                Discover
              </Link>
            </Menu.Item>
            {
              this.injectedProps.usersStore.hasUser
                ? <Menu.Item key="/messages">
                  <Link to="/messages" className={styles.menuItem}>
                    <Icon type="message" className={styles.menuIcon} />
                    Messages
                  </Link>
                </Menu.Item>
                : null
            }
          </Menu>
          {this.getNetworkStatus()}
          {this.getUserMenu()}
        </div>
      </header>
    )
  }

  private getNetworkStatus() {
    const { isPending } = this.injectedProps.metaMaskStore
    if (isPending) {
      return null
    }

    const { connectStatus } = this.injectedProps.metaMaskStore

    return (
      <>
        <Tooltip title={CONNECT_STATUS_INDICATOR_TEXTS[connectStatus]}>
          <span
            title="Network status"
            className={styles.networkIndicatorWrapper}
          >
            <span
              className={classnames(
                styles.networkIndicator,
                CONNECT_STATUS_INDICATOR_MODIFIER_CLASSES[connectStatus],
              )}
            />
          </span>
        </Tooltip>
        <span
          className={classnames(styles.networkOptionsButton, 'ant-dropdown-link')}
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
      currentEthereumNetwork,
    } = this.injectedProps.metaMaskStore

    return (
      <span
        className={styles.networkText}
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
        isNotAvailable: contractsNotAvailable,
      },
    } = this.injectedProps

    if (isActive && !contractsNotAvailable && !isLoadingUsers && usableUsers.length === 0) {
      return (
        <Link to="/accounts">
          <Button
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

    const { user } = this.injectedProps.usersStore.currentUserStore!

    return (
      <Dropdown
        trigger={['click']}
        overlay={this.getUserOptions()}
        placement="bottomRight"
      >
        <a
          title={user.userAddress}
          className={classnames(styles.userOptionsButton, 'ant-dropdown-link')}
        // looks like antd does not support keyboard accessibility well
        // tabIndex={0}
        >
          {this.getUserAvatar()}
          <Icon type="down" className={styles.userAvatarDownIcon} />
        </a>
      </Dropdown>
    )
  }

  private getUserAvatar() {
    const { avatarHash } = this.injectedProps.usersStore.currentUserStore!

    return (
      <HashAvatar
        className={styles.userAvatar}
        shape="square"
        size="small"
        hash={avatarHash}
      />
    )
  }

  private getUserOptions() {
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
          className={styles.currentUserAddress}
          disabled={true}
        >
          {`Using `}
          <Tooltip
            placement="topLeft"
            title="Click to copy"
          >
            <a className={styles.userAddressLink} onClick={this.handleCopyUserAddress}>
              <UserAddress
                address={user.userAddress}
                className={styles.userAddress}
                maxLength={8}
              />
            </a>
          </Tooltip>
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
                    <Menu.Item key={_user.userAddress}>
                      <SwitchUserOption user={_user} onSelect={this.handleSelectUser} />
                    </Menu.Item>
                  ))
              }
            </Menu.SubMenu>
          )
          : null
        }
        <Menu.Item>
          <Link to="/accounts">
            Manage accounts
          </Link>
        </Menu.Item>
      </Menu>
    )
  }

  private handleSelectUser = (user: IUser) => {
    window.setTimeout(
      () => this.injectedProps.usersStore.useUser(user),
      300,
    )
  }

  private handleExport = async () => {
    this.setState({
      isExporting: true,
    })
    try {
      const {
        exportUser,
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
          isExporting: false,
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
const CONNECT_STATUS_INDICATOR_MODIFIER_CLASSES = Object.freeze({
  [METAMASK_CONNECT_STATUS.PENDING]: '',
  [METAMASK_CONNECT_STATUS.ACTIVE]: styles.networkIndicatorActive,
  [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: styles.networkIndicatorNotAvailable,
})

const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
  [METAMASK_CONNECT_STATUS.ACTIVE]: 'MetaMask Active',
  [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: 'MetaMask Locked',
})

// typing
interface IProps extends RouteComponentProps<{}> {
  className?: string
}

interface IInjectedProps extends IProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
  contractStore: ContractStore
}

interface IState {
  isExporting: boolean
}

export default withRouter(Header)
