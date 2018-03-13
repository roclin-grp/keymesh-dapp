import * as React from 'react'
import { Link, withRouter, RouteComponentProps } from 'react-router-dom'

// component
import { Tooltip, Icon, Dropdown, Menu, message, Button } from 'antd'
import SwitchUserOption from './SwitchUserOption'
import UserAvatar from '../../components/UserAvatar'
import UserAddress from '../../components/UserAddress'

// style
import composeClass from 'classnames'
import * as classes from './index.css'
import logo from './logo.svg'

import { observer } from 'mobx-react'
import { IStores } from '../../stores'
import { IUser } from '../../stores/UserStore'
import { iterableQuests } from '../../stores/UserStore/GettingStartedQuests'

// helper
import copy from 'copy-to-clipboard'
import { sleep } from '../../utils'

@observer
class Header extends React.Component<IProps> {
  public render() {
    const { stores } = this.props
    return (
      <header className={classes.header}>
        <div
          className={composeClass(
            'fullscreen-container',
            'vertical-align-container',
          )}
        >
          <h1 className={composeClass(classes.logo, 'vertical-align-container')}>
            <Link tabIndex={0} className={classes.logoLink} to="/">
              <img src={logo} alt="KeyMesh Logo" className={classes.logoImage} />
              <span className={classes.logoText}>KeyMesh</span>
            </Link>
          </h1>
          <Menu
            inlineIndent={24}
            openTransitionName="slide-up"
            theme="light"
            className={composeClass(classes.menu, 'vertical-align-container')}
            selectedKeys={[this.props.location.pathname]}
            mode="horizontal"
          >
            <Menu.Item key="/broadcast">
              <Link to="/broadcast" className={classes.menuItem}>
                <Icon type="notification" className={classes.menuIcon} />
                Broadcast
              </Link>
            </Menu.Item>
            {stores && stores.usersStore.hasUser ? (
              <Menu.Item key="/messages">
                <Link to="/messages" className={classes.menuItem}>
                  <Icon type="message" className={classes.menuIcon} />
                  Messages
                </Link>
              </Menu.Item>
            ) : null}
          </Menu>
          {this.renderGettingStarted(stores)}
          {/* {this.renderNetworkStatus()} */}
          {this.renderUserMenu(stores)}
        </div>
      </header>
    )
  }

  private renderGettingStarted(stores?: IStores) {
    if (stores == null) {
      return
    }

    const { usersStore } = stores
    const { currentUserStore } = usersStore
    if (!currentUserStore) {
      return null
    }

    const { totalCompletedCount } = currentUserStore.gettingStartedQuests
    const questsCount = iterableQuests.length

    return (
      <Link className={classes.gettingStarted} to="/getting-started">
        <Icon className={classes.gettingStartedIcon} type="bars" />
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

  private renderUserMenu(stores?: IStores) {
    if (stores == null) {
      return null
    }

    const { isPending, isActive } = stores.metaMaskStore

    if (isPending) {
      return null
    }

    const { usersStore } = stores
    const { usableUsers, isLoadingUsers, hasUser } = usersStore

    if (
      isActive &&
      !isLoadingUsers &&
      usableUsers.length === 0
    ) {
      return (
        <Link to="/register">
          <Button type="primary">Sign Up</Button>
        </Link>
      )
    }

    if (!hasUser && usableUsers.length > 0) {
      return (
        <Link to="/accounts">
          <Button type="primary">Sign In</Button>
        </Link>
      )
    }

    const { currentUserStore } = usersStore
    if (!currentUserStore) {
      return null
    }

    const { user } = currentUserStore
    const { userAddress } = user

    return (
      <Dropdown
        trigger={['click']}
        overlay={this.renderUserOptions(usableUsers, user)}
        placement="bottomRight"
      >
        <a
          title={userAddress}
          className={composeClass(classes.userOptionsButton, 'ant-dropdown-link')}
        >
          {this.renderUserAvatar(userAddress)}
          <Icon type="down" className={classes.userAvatarDownIcon} />
        </a>
      </Dropdown>
    )
  }

  private renderUserAvatar(userAddress: string) {
    return (
      <UserAvatar
        key={userAddress}
        className={classes.userAvatar}
        shape="square"
        size="small"
        userAddress={userAddress}
      />
    )
  }

  private renderUserOptions(usableUsers: IUser[], currentUser: IUser) {
    return (
      <Menu>
        <Menu.Item className={classes.currentUserAddress} disabled={true}>
          <Tooltip placement="topLeft" title="Copy account address">
            <a
              className={classes.userAddressLink}
              onClick={this.handleCopyUserAddress}
            >
              <UserAddress
                userAddress={currentUser.userAddress}
                className={classes.userAddress}
                maxLength={8}
              />
            </a>
          </Tooltip>
        </Menu.Item>
        <Menu.Item>
          <Link to="/profile">Profile</Link>
        </Menu.Item>

        <Menu.Divider />
        {usableUsers.length > 1 ? (
          <Menu.SubMenu title={<span>Switch user</span>}>
            {usableUsers
              .filter((_user) => _user.userAddress !== currentUser.userAddress)
              .map((_user) => (
                <Menu.Item key={_user.userAddress}>
                  <SwitchUserOption
                    user={_user}
                    onSelect={this.handleSelectUser}
                  />
                </Menu.Item>
              ))}
          </Menu.SubMenu>
        ) : null}
        <Menu.Item>
          <Link to="/accounts">My Accounts</Link>
        </Menu.Item>

        <Menu.Item>
          <Link to="/register">
            <Icon type="user-add" /> Register
          </Link>
        </Menu.Item>
      </Menu>
    )
  }

  private handleSelectUser = async (user: IUser) => {
    await sleep(300)
    this.props.stores!.usersStore.useUser(user)
  }

  private handleCopyUserAddress = () => {
    const { userAddress } = this.props.stores!.usersStore.currentUserStore!.user
    if (copy(userAddress)) {
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
  stores?: IStores
}

export default withRouter(Header)
