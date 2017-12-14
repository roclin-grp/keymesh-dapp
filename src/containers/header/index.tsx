import * as React from 'react'

import { Link } from 'react-router-dom'
import { withRouter, Redirect } from 'react-router-dom'

import { inject, observer } from 'mobx-react'
import { Store } from '../../store'
import { getUsernameHash as web3UtilsSha3 } from 'trustbase'

import {
  NETWORKS,
  TRUSTBASE_CONNECT_STATUS,
  NETWORK_NAMES,
  CONNECT_STATUS_INDICATOR_COLORS,
  CONNECT_STATUS_INDICATOR_TEXTS,
  USER_STATUS
} from '../../constants'

import NetworkOption from '../../components/networkOption'
import UserOption from '../../components/userOption'
import Avatar from '../../components/avatar'
import { Iuser } from '../../../typings/interface'

const noop = () => {/**/}

interface Iprops {
  store: Store,
  shouldRefreshSessions?: boolean
  history: {
    replace: (path: string) => void
  }
  location: {
    pathname: string
  }
}

interface Istate {
  showNetworks: boolean
  showUsers: boolean
}

@inject('store') @observer
class Header extends React.Component<Iprops, Istate> {
  public static defaultProps = {
    shouldRefreshSessions: false
  }
  public readonly state = {
    showNetworks: false,
    showUsers: false
  }
  public componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOtherPlaceHideNetworks)
    document.removeEventListener('click', this.handleClickOtherPlaceHideUsers)
  }
  public render() {
    const {
      connectStatus,
      currentEthereumNetwork,
      currentUser,
      currentNetworkUsers,
      offlineAvailableNetworks,
      offlineSelectedEthereumNetwork
    } = this.props.store

    // FIXME: put this in abstract page component?
    if (currentUser && this.props.location.pathname !== '/register') {
      if (currentUser.status === USER_STATUS.PENDING && this.props.location.pathname !== '/check-register') {
        return <Redirect to="/check-register" />
      }
      if (currentUser.status === USER_STATUS.IDENTITY_UPLOADED && this.props.location.pathname !== '/upload-pre-keys') {
        return <Redirect to="/upload-pre-keys" />
      }
    }
    return <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        backgroundColor: 'white',
        marginBottom: 20
      }}>
      <div
        style={{
          maxWidth: '1200px',
          padding: '0 20px',
          minWidth: '1000px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '50px'
        }}
      >
        <h1
          style={{
          fontSize: '20px',
          margin: 0,
          color: 'black'
        }}>
          <Link style={{textDecoration: 'none', color: 'black'}} to="/">Keymail</Link>
        </h1>
        <span style={{flexGrow: 1}} />
        <div
          style={{
            marginRight: 20,
            fontSize: '14px',
          }}>
          <span
            title={(CONNECT_STATUS_INDICATOR_TEXTS as any)[connectStatus]}
            style={{
              color: (CONNECT_STATUS_INDICATOR_COLORS as any)[connectStatus] as string,
              fontWeight: 'bold',
              marginRight: 10,
              userSelect: 'none'
            }}>
            ●
          </span>
          {
            connectStatus !== TRUSTBASE_CONNECT_STATUS.PENDING
              ? <span style={{cursor: 'default'}} title="Current Ethereum network">{
                connectStatus === TRUSTBASE_CONNECT_STATUS.ERROR
                || connectStatus === TRUSTBASE_CONNECT_STATUS.OFFLINE
                  ? 'No network'
                  : (
                    (NETWORK_NAMES as any)[currentEthereumNetwork as NETWORKS]
                    || `Custom(${currentEthereumNetwork})`
                  )
              }</span>
              : offlineSelectedEthereumNetwork
                  ? <span
                      style={{
                        display: 'inline-block',
                        height: 50,
                        lineHeight: '50px',
                        cursor: offlineAvailableNetworks.length > 1 ? 'pointer' : 'default'
                      }}
                      title="Current Ethereum network"
                      onClick={offlineAvailableNetworks.length > 1 ? this.handleShowNetworks : noop}>
                      {`${(NETWORK_NAMES as any)[offlineSelectedEthereumNetwork as NETWORKS]
                      || `Custom(${currentEthereumNetwork})`}`}
                      {
                        offlineAvailableNetworks.length > 1
                          ? <span
                              style={{
                                display: 'inline-block',
                                margin: '3px 8px',
                                width: '4px',
                                height: '4px',
                                color: 'transparent',
                                transform: 'rotate(-45deg)',
                                border: '1px solid #a5a5a5',
                                borderTopColor: 'transparent',
                                borderRightColor: 'transparent',
                                transformOrigin: '2px 5px'}}>
                            </span>
                          : null
                      }
                    </span>
                  : null
          }
          {
            connectStatus !== TRUSTBASE_CONNECT_STATUS.PENDING
            && connectStatus !== TRUSTBASE_CONNECT_STATUS.OFFLINE
            && connectStatus !== TRUSTBASE_CONNECT_STATUS.ERROR
            && offlineAvailableNetworks.length > 1
              ? <ul style={{display: this.state.showNetworks ? 'block' : 'none', zIndex: 99}}>{
                offlineAvailableNetworks
                  .filter((networkId) => networkId !== currentEthereumNetwork)
                  .map((network) => <NetworkOption
                    key={network}
                    networkId={network}
                    onSelect={this.handleSelectNetwork}
                  />)
              }</ul>
              : null
          }
        </div>
        <div>
          {
            currentUser
              ? <span
                  title={currentUser.username}
                  style={{
                    display: 'block',
                    height: 50,
                    lineHeight: '50px',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                  onClick={this.handleShowUsers}>
                {currentUser.status !== USER_STATUS.PENDING
                  ? <Avatar size={40} hash={web3UtilsSha3(`${currentUser.usernameHash}${currentUser.blockHash}`)} />
                  : null}
                {currentUser.username}
                {
                  currentNetworkUsers.length > 0
                    ? <span
                      style={{
                        display: 'inline-block',
                        margin: '3px 8px',
                        width: '4px',
                        height: '4px',
                        color: 'transparent',
                        transform: 'rotate(-45deg)',
                        border: '1px solid #a5a5a5',
                        borderTopColor: 'transparent',
                        borderRightColor: 'transparent',
                        transformOrigin: '2px 5px'}}>
                    </span>
                    : null
                }
              </span>
              : connectStatus !== TRUSTBASE_CONNECT_STATUS.PENDING
                ? <Link
                  to="/register"
                  style={{
                    display: 'block',
                    backgroundColor: 'orange',
                    color: 'white',
                    padding: '5px 10px',
                    fontSize: 14,
                    textDecoration: 'none',
                    height: 15
                  }}
                >
                  Register
                </Link>
                : null
          }
          {
            currentUser
              ? <ul style={{
                  display: this.state.showUsers ? 'block' : 'none',
                  zIndex: 99,
                  position: 'absolute',
                  backgroundColor: 'white',
                  color: 'black',
                  padding: 0,
                  margin: 0,
                  marginTop: -3,
                  boxShadow: 'rgba(0, 0, 0, 0.117647) 0px 1px 6px, rgba(0, 0, 0, 0.117647) 0px 1px 4px'
                }}>
                  {
                    currentNetworkUsers
                      .filter((user) => user.usernameHash !== currentUser.usernameHash)
                      .map((user) => <UserOption
                        key={`${user.usernameHash}@${user.networkId}`}
                        user={user}
                        onSelect={this.handleSelectUser}
                      />)
                  }
                  {
                    connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS
                    ? <li
                      style={{
                        display: 'block',
                        listStyle: 'none',
                    }}>
                      <Link
                        to="/register"
                        style={{
                          fontSize: 14,
                          height: 25,
                          lineHeight: '25px',
                          padding: '10px 20px',
                          display: 'block',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          color: 'orange'
                        }}>
                        Register
                      </Link>
                    </li>
                    : null
                  }
              </ul>
              : null
          }
        </div>
      </div>
    </header>
  }

  private handleShowNetworks = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    this.setState(({showNetworks}) => {
      return {
        showNetworks: !showNetworks
      }
    }, () => {
      this.state.showNetworks
        ? document.addEventListener('click', this.handleClickOtherPlaceHideNetworks)
        : document.removeEventListener('click', this.handleClickOtherPlaceHideNetworks)
    })
  }

  private handleClickOtherPlaceHideNetworks = () => {
    if (this.state.showNetworks) {
      const selection = window.getSelection()
      if (selection.type === 'Range') {
        return
      }
      document.removeEventListener('click', this.handleClickOtherPlaceHideNetworks)
      this.setState({
        showNetworks: false
      })
    }
  }

  private handleSelectNetwork = (networkId: NETWORKS) => {
    this.props.store.selectOfflineNetwork(networkId, this.props.shouldRefreshSessions).catch(() => {/**/})
  }

  private handleShowUsers = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    const selection = window.getSelection()
    if (selection.type === 'Range') {
      return
    }
    this.setState(({showUsers}) => {
      return {
        showUsers: !showUsers
      }
    }, () => {
      this.state.showUsers
        ? document.addEventListener('click', this.handleClickOtherPlaceHideUsers)
        : document.removeEventListener('click', this.handleClickOtherPlaceHideUsers)
    })
  }

  private handleClickOtherPlaceHideUsers = () => {
    if (this.state.showUsers) {
      const selection = window.getSelection()
      if (selection.type === 'Range') {
        return
      }
      document.removeEventListener('click', this.handleClickOtherPlaceHideUsers)
      this.setState({
        showUsers: false
      })
    }
  }

  private handleSelectUser = (user: Iuser) => {
    const pathname = this.props.location.pathname
    const callback = pathname === '/check-register' || pathname === '/upload-pre-keys'
      ? () => this.props.history.replace('/')
      : undefined
    this.props.store.useUser(user, this.props.shouldRefreshSessions, callback).catch(() => {/**/})
  }
}

export default withRouter(Header as any)
