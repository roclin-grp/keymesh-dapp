import * as React from 'react'

import { Icon } from 'antd'

import composeClass from 'classnames'
import * as classes from './index.css'

import { observable, action } from 'mobx'
import { getUserInfoByAddress, IProcessedUserInfo } from '../../stores/UserCachesStore'
import { PALTFORM_MODIFIER_CLASSES } from '../../stores/SocialProofsStore'
import { MetaMaskStore } from '../../stores/MetaMaskStore'

class UsernameData {
  @observable
  public username!: string | JSX.Element

  constructor(private readonly metaMaskStore: MetaMaskStore) {}

  @action
  public setUsername(name: string | JSX.Element) {
    this.username = name
  }

  public async fetchUserInfoUsername(userAddress: string, showAllUsernames?: boolean) {
    // TODO: use cache
    const userInfo = await getUserInfoByAddress(this.metaMaskStore.networkID, userAddress)
    if (userInfo == null) {
      return
    }

    const username = getUserName(userInfo, showAllUsernames)

    this.setUsername(username)
  }
}

export function getUserName(
  userInfo: IProcessedUserInfo, showAllUsernames = false,
): string | JSX.Element {
  const { verifications } = userInfo
  if (verifications.length === 0) {
    return userInfo.userAddress
  }

  const displayName = (
    <span className={classes.displayName} key="displayName">
      {userInfo.displayUsername!}
    </span>
  )

  if (!showAllUsernames) {
    return displayName
  }

  const userNameComponent: JSX.Element[] = [displayName]
  for (const verification of verifications) {
    const { platformName, username } = verification
    userNameComponent.push((
      <span
        key={platformName}
        className={composeClass(classes.platformUserName, 'vertical-align-container')}
      >
        <Icon
          key={platformName} // weird unique 'key' props warning
          type={platformName}
          className={composeClass(classes.socialIcon, PALTFORM_MODIFIER_CLASSES[platformName])}
        />
        @{username}
      </span>
    ))
  }
  return <span>{userNameComponent}</span>
}

export default UsernameData
