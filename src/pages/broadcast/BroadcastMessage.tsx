import * as React from 'react'
import {
  Link,
} from 'react-router-dom'

import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import {
  Icon,
} from 'antd'
import HashAvatar from '../../components/HashAvatar'
import UserAddress from '../../components/UserAddress'
import {
  IBroadcastMessage,
  MESSAGE_STATUS,
} from '../../stores/BroadcastMessagesStore'
import { UserCachesStore } from '../../stores/UserCachesStore'
import { UserProofsStateStore } from '../../stores/UserProofsStateStore'

import * as styles from './BroadcastMessage.css'
import {
  isUndefined,
} from '../../utils'
import { timeAgo, beforeOneDay } from '../../utils/time'
import classnames from 'classnames'

import {
  SOCIALS,
  VERIFY_SOCIAL_STATUS,
} from '../../stores/BoundSocialsStore'

interface IProps {
  message: IBroadcastMessage
  userCachesStore: UserCachesStore
  userProofsStateStore: UserProofsStateStore
}

@observer
export default class BroadcastMessage extends React.Component<IProps> {
  // FIXME: no @observable inside React component
  @observable
  private avatarHash: string = ''
  @observable
  private timeText: string = ''
  private updateTimeTimeout!: number

  public async componentDidMount() {
    const {
      userCachesStore: {
        getAvatarHashByUserAddress,
      },
      userProofsStateStore,
      message: {
        author,
      },
    } = this.props
    const avatarHash = await getAvatarHashByUserAddress(author!)
    this.updateTimeText()
    runInAction(() => {
      this.avatarHash = avatarHash
    })

    if (!userProofsStateStore.isFetchingUserProofs) {
      // verify existed proof
      this.verifyIfBeforeOneDay()
      // fetch proving per 15 mins
      userProofsStateStore.startFetchingUserProofs(15 * 60 * 1000)
    }
  }

  public componentWillUnmount() {
    const {
      userProofsStateStore,
    } = this.props
    window.clearTimeout(this.updateTimeTimeout)
    if (userProofsStateStore.isFetchingUserProofs) {
      userProofsStateStore.stopFetchingUserProofs()
    }
  }

  public render() {
    const { message } = this.props
    const userAddress = message.author!
    const messageStatus = message.status!
    const username = this.getUsername()

    return <div className={styles.broadcastMessage}>
      <HashAvatar
        className={styles.avatar}
        shape="circle"
        size="large"
        hash={this.avatarHash}
      />
      <div className={styles.body}>
        <div className={styles.infoWrapper}>
          <Link to={`/profile/${userAddress}`}>
            <span className={styles.username}>{username}</span>
            {this.getSocialIcons()}
            <UserAddress
              className={classnames(styles.userAddress, {
                [styles.userAddressHasUsername]: username !== null,
              })}
              maxLength={username ? 8 : 16}
              address={userAddress}
            />
          </Link>
          {` ${this.timeText}`}
        </div>
        <p className={styles.content}>{message.message}</p>
        {
          messageStatus !== MESSAGE_STATUS.DELIVERED
            ? (
              <p
                className={classnames(styles.status, MESSAGE_MODIFIER_CLASSES[messageStatus])}
              >
                {MESSAGE_STATUS_STR[messageStatus]}
              </p>
            )
            : null
        }
      </div>
    </div>
  }

  private updateTimeText() {
    runInAction(() => {
      this.timeText = timeAgo(this.props.message.timestamp)
    })

    this.updateTimeTimeout = window.setTimeout(() => this.updateTimeText(), 60 * 1000)
  }

  private verifyIfBeforeOneDay() {
    const {
      userBoundSocials,
      verifyStatuses,
      verifyTwitter,
      verifyFacebook,
      verifyGithub,
    } = this.props.userProofsStateStore
    return (Object.keys(userBoundSocials).filter((key) => key !== 'nonce') as SOCIALS[])
      .forEach((platform) => {
        if (
          !isUndefined(userBoundSocials[platform])
          && beforeOneDay(verifyStatuses[platform].lastVerifiedAt)
        ) {
          switch (platform) {
            case SOCIALS.TWITTER: return verifyTwitter()
            case SOCIALS.FACEBOOK: return verifyFacebook()
            case SOCIALS.GITHUB: return verifyGithub()
            default:
          }
        }
        return
      })
  }

  private getUsername() {
    const {
      userBoundSocials,
      verifyStatuses,
    } = this.props.userProofsStateStore
    const validPlatform = (Object.keys(userBoundSocials).filter((key) => key !== 'nonce') as SOCIALS[])
      .find((platform) => (
          !isUndefined(userBoundSocials[platform])
          && verifyStatuses[platform].status === VERIFY_SOCIAL_STATUS.VALID
      ))

    if (!isUndefined(validPlatform)) {
      return userBoundSocials[validPlatform]!.username
    }

    return null
  }

  private getSocialIcons() {
    const {
      userBoundSocials,
      verifyStatuses,
    } = this.props.userProofsStateStore
    return (Object.keys(userBoundSocials).filter((key) => key !== 'nonce') as SOCIALS[])
      .reduce<JSX.Element[]>(
        (result, platform) => {
          if (
            !isUndefined(userBoundSocials[platform])
            && verifyStatuses[platform].status === VERIFY_SOCIAL_STATUS.VALID
          ) {
            return result.concat((
              <Icon
                key={platform}
                type={platform}
                className={classnames(styles.socialIcon, PALTFORM_MODIFIER_CLASSES[platform])}
              />
            ))
          }
          return result
        },
        [],
      )
  }
}

const MESSAGE_MODIFIER_CLASSES = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: styles.delivering,
  [MESSAGE_STATUS.FAILED]: styles.failed,
})

const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
})

const PALTFORM_MODIFIER_CLASSES = Object.freeze({
  [SOCIALS.TWITTER]: styles.iconTwitter,
  [SOCIALS.FACEBOOK]: styles.iconFacebook,
  [SOCIALS.GITHUB]: styles.iconGitHub,
})
