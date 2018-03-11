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
import logo from './logo.svg'

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
  // ETHEREUM_NETWORK_NAMES,
  // METAMASK_CONNECT_STATUS,
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
import { iterableQuests } from '../../stores/UserStore/GettingStartedQuests'

// helper
import copy from 'copy-to-clipboard'

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
  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  public render() {
    return (
      <header className={styles.header}>
        <div className={classnames('fullscreen-container', 'vertical-align-container')}>
          <h1 className={classnames(styles.logo, 'vertical-align-container')}>
            <Link
              tabIndex={0}
              className={styles.logoLink}
              to="/"
            >
              <img
                src={logo}
                alt="KeyMesh Logo"
                className={styles.logoImage}
              />
              <span className={styles.logoText}>KeyMesh</span>
            </Link>
          </h1>
          <Menu
            inlineIndent={24}
            openTransitionName="slide-up"
            theme="light"
            className={classnames(styles.menu, 'vertical-align-container')}
            selectedKeys={[this.props.location.pathname]}
            mode="horizontal"
          >
            <Menu.Item key="/broadcast">
              <Link to="/broadcast" className={styles.menuItem}>
                <Icon type="notification" className={styles.menuIcon} />
                Broadcast
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
          {this.renderGettingStarted()}
          {/* {this.renderNetworkStatus()} */}
          {this.renderUserMenu()}
        </div>
      </header>
    )
  }

  private renderGettingStarted() {
    const { currentUserStore } = this.injectedProps.usersStore
    if (!currentUserStore) {
      return null
    }

    const { totalCompletedCount } = this.injectedProps.usersStore.currentUserStore!.gettingStartedQuests
    const questsCount = iterableQuests.length

    return (
      <Link className={styles.gettingStarted} to="/getting-started">
        <Icon className={styles.gettingStartedIcon} type="bars" />
        Getting Started ({`${totalCompletedCount}/${questsCount}`})
      </Link>
    )
  }

  // private renderNetworkStatus() {
  //   const { isPending } = this.injectedProps.metaMaskStore
  //   if (isPending) {
  //     return null
  //   }

  //   const { connectStatus } = this.injectedProps.metaMaskStore

  //   return (
  //     <>
  //       <Tooltip title={CONNECT_STATUS_INDICATOR_TEXTS[connectStatus]}>
  //         <span
  //           title="Network status"
  //           className={styles.networkIndicatorWrapper}
  //         >
  //           <span
  //             className={classnames(
  //               styles.networkIndicator,
  //               CONNECT_STATUS_INDICATOR_MODIFIER_CLASSES[connectStatus],
  //             )}
  //           />
  //         </span>
  //       </Tooltip>
  //       <span
  //         className={classnames(styles.networkOptionsButton, 'ant-dropdown-link')}
  //       // looks like antd does not support keyboard accessibility well
  //       // tabIndex={0}
  //       >
  //         {this.renderNetworkText()}
  //       </span>
  //     </>
  //   )
  // }

  // private renderNetworkText() {
  //   const {
  //     isNotAvailable,
  //     isLocked,
  //     currentEthereumNetwork,
  //   } = this.injectedProps.metaMaskStore

  //   return (
  //     <span
  //       className={styles.networkText}
  //       title="Current Ethereum network"
  //     >
  //       {isNotAvailable && !isLocked
  //         ? 'No network'
  //         : (
  //           ETHEREUM_NETWORK_NAMES[currentEthereumNetwork!]
  //           || `Custom(${currentEthereumNetwork})`
  //         )
  //       }
  //     </span>
  //   )
  // }

  private renderUserMenu() {
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
        <Link to="/register">
          <Button
            type="primary"
          >
            Sign Up
          </Button>
        </Link>
      )
    }
    if (!hasUser && usableUsers.length > 0) {
      return (
        <Link to="/accounts">
          <Button
            type="primary"
          >
            Sign In
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
        overlay={this.renderUserOptions()}
        placement="bottomRight"
      >
        <a
          title={user.userAddress}
          className={classnames(styles.userOptionsButton, 'ant-dropdown-link')}
        // looks like antd does not support keyboard accessibility well
        // tabIndex={0}
        >
          {this.renderUserAvatar()}
          <Icon type="down" className={styles.userAvatarDownIcon} />
        </a>
      </Dropdown>
    )
  }

  private renderUserAvatar() {
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

  private renderUserOptions() {
    const {
      usableUsers,
    } = this.injectedProps.usersStore
    const {
      user,
    } = this.injectedProps.usersStore.currentUserStore!

    return (
      <Menu>
        <Menu.Item
          className={styles.currentUserAddress}
          disabled={true}
        >
          <Tooltip
            placement="topLeft"
            title="Copy account address"
          >
            <a className={styles.userAddressLink} onClick={this.handleCopyUserAddress}>
              <UserAddress
                userAddress={user.userAddress}
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
            My Accounts
          </Link>
        </Menu.Item>

        <Menu.Item>
          <Link to="/register">
            <Icon type="user-add" /> Register
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

  private handleCopyUserAddress = () => {
    const {
      user,
    } = this.injectedProps.usersStore.currentUserStore!
    if (copy(user.userAddress)) {
      message.success('Address copied', 2)
    }
  }
}

// constant
// const CONNECT_STATUS_INDICATOR_MODIFIER_CLASSES = Object.freeze({
//   [METAMASK_CONNECT_STATUS.PENDING]: '',
//   [METAMASK_CONNECT_STATUS.ACTIVE]: styles.networkIndicatorActive,
//   [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: styles.networkIndicatorNotAvailable,
// })

// const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
//   [METAMASK_CONNECT_STATUS.ACTIVE]: 'MetaMask Active',
//   [METAMASK_CONNECT_STATUS.NOT_AVAILABLE]: 'MetaMask Locked',
// })

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
}

export default withRouter(Header)
