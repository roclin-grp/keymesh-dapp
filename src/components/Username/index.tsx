import * as React from 'react'

import UserAddress from '../UserAddress'

import { observer, inject } from 'mobx-react'

import UsernameData, { getUserName } from './data'
import { IProcessedUserInfo } from '../../stores/UserCachesStore'
import { IStores } from '../../stores'
import { MetaMaskStore } from '../../stores/MetaMaskStore'

@inject((({
  metaMaskStore,
}: IStores): IInjectedProps => ({
  metaMaskStore,
})))
@observer
class Username extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IProps & IInjectedProps>
  private readonly data = new UsernameData(this.injectedProps.metaMaskStore)

  public async componentWillMount() {
    const { userInfo, displayUsername, showAllUsernames } = this.props

    if (displayUsername != null) {
      this.data.setUsername(displayUsername)
    }

    if (userInfo != null) {
      const usernameComponent = getUserName(userInfo, showAllUsernames)
      this.data.setUsername(usernameComponent)
      return
    }

    const { userAddress } = this.props
    if (userInfo == null) {
      this.data.fetchUserInfoUsername(userAddress, showAllUsernames)
    }

    this.data.setUsername(userAddress)
  }

  public render() {
    const { maxLength, overflowPadding, userAddress, className } = this.props
    if (typeof this.data.username === 'string') {
      return (
        <UserAddress
          className={className}
          userAddress={userAddress}
          maxLength={maxLength}
          overflowPadding={overflowPadding}
        />
      )
    }

    return React.cloneElement(this.data.username, { className })
  }
}

interface IProps {
  userAddress: string
  userInfo?: IProcessedUserInfo
  displayUsername?: string
  showAllUsernames?: boolean
  className?: string
  maxLength?: number
  overflowPadding?: string
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
}

export default Username
