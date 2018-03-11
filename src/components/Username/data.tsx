import * as React from 'react'

import { Icon } from 'antd'

import composeClass from 'classnames'
import * as classes from './index.css'

import { observable, action } from 'mobx'
import { searchUserByAddress, IProcessedUserInfo } from '../../stores/UserCachesStore'
import { PLATFORMS } from '../../stores/SocialProofsStore'

class UsernameData {
  @observable
  public username!: string | JSX.Element

  @action
  public setUsername(name: string | JSX.Element) {
    this.username = name
  }

  public async fetchUserInfoUsername(userAddress: string, showAllUsernames?: boolean) {
    // TODO: use cache
    const userInfos = await searchUserByAddress(userAddress)
    if (userInfos.length === 0) {
      return
    }

    const username = getUserName(userInfos[0], showAllUsernames)

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

  if (!showAllUsernames) {
    return <span>{userInfo.displayUsername!}</span>
  }

  const userNameComponent: JSX.Element[] = []
  for (const verification of verifications) {
    const { platformName, username } = verification
    userNameComponent.push((
      <span
        key={platformName}
        className={composeClass(classes.platformUserName, 'vertical-align-container')}
      >
        <Icon
          type={platformName}
          className={composeClass(classes.socialIcon, PALTFORM_MODIFIER_CLASSES[platformName])}
        />
        @{username}
      </span>
    ))
  }
  return <span>{userNameComponent}</span>
}

export const PALTFORM_MODIFIER_CLASSES = Object.freeze({
  [PLATFORMS.TWITTER]: 'twitterTone',
  [PLATFORMS.FACEBOOK]: 'facebookTone',
  [PLATFORMS.GITHUB]: 'gitHubTone',
})

export default UsernameData
