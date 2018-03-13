import * as React from 'react'

import { Avatar } from 'antd'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { UsersStore } from '../../stores/UsersStore'

import UserAvatarData, { getSrcFromKeyMeshAvatarHash } from './data'
import { IProcessedUserInfo } from '../../stores/UserCachesStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'

@inject(({
  usersStore,
  metaMaskStore,
}: IStores): IInjectedProps => ({
  usersStore,
  metaMaskStore,
}))
@observer
class UserAvatar extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IProps & IInjectedProps>

  private readonly data = new UserAvatarData(
    this.injectedProps.usersStore,
    this.injectedProps.metaMaskStore,
  )

  public async componentWillMount() {
    const { userInfo, keyMeshAvatarHash } = this.props
    const sizePx = this.getSize()

    if (userInfo != null && userInfo.avatarImgURL != null) {
      this.data.setSrc(userInfo.avatarImgURL)
      return
    }

    if (keyMeshAvatarHash != null) {
      const imgSrc = getSrcFromKeyMeshAvatarHash(keyMeshAvatarHash, sizePx)
      this.data.setSrc(imgSrc)
      return
    }

    const { userAddress } = this.props
    if (userInfo == null) {
      this.data.fetchUserInfoAvatar(userAddress)
    }

    this.data.fetchKeyMeshHashAvatar(this.props.userAddress, sizePx)
  }

  public render() {
    const {size = 'default', shape = 'square', className} = this.props
    const { avatarSrc } = this.data
    return (
      <Avatar
        className={className}
        shape={shape}
        size={size}
        src={avatarSrc}
        icon={avatarSrc ? undefined : 'user'}
      />
    )
  }

  private getSize(): number {
    const {size = 'default', picSize} = this.props
    const sizePx = picSize || SIZE_PX[size]
    return sizePx
  }
}

interface IProps {
  userAddress: string
  userInfo?: IProcessedUserInfo
  keyMeshAvatarHash?: string
  size?: 'large' | 'small' | 'default'
  shape?: 'circle' | 'square'
  className?: string
  picSize?: number
}

interface IInjectedProps {
  usersStore: UsersStore
  metaMaskStore: MetaMaskStore
}

const SIZE_PX = Object.freeze({
  large: 40,
  small: 24,
  default: 32,
})

export default UserAvatar
