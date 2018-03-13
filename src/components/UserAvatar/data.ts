import { observable, action } from 'mobx'
import { UsersStore } from '../../stores/UsersStore'
import { searchUserByAddress } from '../../stores/UserCachesStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'

const Identicon = require('identicon.js')

class UserAvatarData {
  @observable
  public avatarSrc: string | undefined

  constructor(private readonly usersStore: UsersStore, private readonly metaMaskStore: MetaMaskStore) {
  }

  @action
  public setSrc(src: string) {
    this.avatarSrc = src
  }

  public async fetchKeyMeshHashAvatar(userAddress: string, size: number) {
    const { userCachesStore } = this.usersStore
    const fetchedAvatarHash = await userCachesStore.getAvatarHashByUserAddress(userAddress)

    if (this.avatarSrc != null) {
      // already using user info avatar
      return
    }

    const src = getSrcFromKeyMeshAvatarHash(fetchedAvatarHash, size)
    this.setSrc(src)
  }

  public async fetchUserInfoAvatar(userAddress: string) {
    // TODO: use cache
    const userInfo = await searchUserByAddress(this.metaMaskStore.networkID, userAddress)
    if (userInfo == null) {
      return
    }

    const { avatarImgURL } = userInfo

    if (avatarImgURL == null) {
      return
    }

    this.setSrc(avatarImgURL)
  }
}

export function getSrcFromKeyMeshAvatarHash(keyMeshAvatarHash: string, size: number) {
  const identiconData = new Identicon(keyMeshAvatarHash, { size, format: 'svg', margin: 0.1 }).toString()
  return `data:image/svg+xml;base64,${identiconData}`
}

export default UserAvatarData
