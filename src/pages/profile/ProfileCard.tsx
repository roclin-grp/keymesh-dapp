import * as React from 'react'

import { Link } from 'react-router-dom'
import UserAvatar from '../../components/UserAvatar'
import { Button, Divider, Icon, Tooltip } from 'antd'

import * as classes from './ProfileCard.css'
import composeClass from 'classnames'

import { observer } from 'mobx-react'
import { IProcessedUserInfo, IUserInfoVerications } from '../../stores/UserCachesStore'
import { UserProofsStateStore } from '../../stores/UserProofsStateStore'
import {
  platformNames,
  PALTFORM_MODIFIER_CLASSES,
  PLATFORMS,
  PLATFORM_LABELS,
  IVerifiedStatus,
  VERIFIED_SOCIAL_STATUS,
} from '../../stores/SocialProofsStore'

@observer
class ProfileCard extends React.Component<IProps> {
  public componentWillMount() {
    this.props.proofsStateStore.startFetchUserProofs(5000)
  }

  public componentWillUnmount() {
    this.props.proofsStateStore.stopFetchUserProofs()
  }

  public render() {
    const { userInfo, isFirstCard } = this.props
    const { userAddress } = userInfo
    const isFirstDecoratorClass = { [classes.isFrist]: isFirstCard }
    return (
      <section
        className={composeClass(
          classes.container,
          'block',
          'center-align-column-container',
          isFirstDecoratorClass,
        )}
      >
        {this.renderAvatar(userInfo)}
        {this.renderUsername(userInfo)}
        <div className={composeClass(classes.addressWrapper, isFirstDecoratorClass)}>
          <span className={classes.addressTitle}>
            Ethereum Address
          </span>
          <span className={classes.address}>
            {userAddress}
          </span>
        </div>
        <Divider />
        {this.renderVerifications(userInfo)}
        <Button className={classes.messageButton} type="primary">
          <Link to={`/messages?to=${userAddress}`}>
            Message
          </Link>
        </Button>
      </section>
    )
  }

  private renderAvatar(userInfo: IProcessedUserInfo) {
    const { isFirstCard } = this.props

    if (!isFirstCard) {
      return null
    }

    return (
      <UserAvatar
        className={classes.avatar}
        picSize={120}
        userAddress={userInfo.userAddress}
        userInfo={userInfo}
      />
    )
  }

  private renderUsername(userInfo: IProcessedUserInfo) {
    const { isFirstCard } = this.props

    if (!isFirstCard) {
      return null
    }

    const { displayUsername } = userInfo

    if (displayUsername == null) {
      return null
    }

    return <h3 className={classes.displayName}>{displayUsername}</h3>
  }

  private renderVerifications(userInfo: IProcessedUserInfo) {
    const { isSelf } = this.props
    const { verifications } = userInfo
    if (verifications.length === 0 && !isSelf) {
      return
    }

    const verificationMap: { [platform: string]: IUserInfoVerications | undefined } = {}
    for (const verification of verifications) {
      verificationMap[verification.platformName] = verification
    }

    const result: React.ReactNode[] = []
    for (const platformName of platformNames) {
      // TODO: remove this to enable other platform
      if (platformName !== PLATFORMS.TWITTER) {
        continue
      }

      const verification = verificationMap[platformName]
      if (!isSelf && verification == null) {
        continue
      }

      if (verification) {
        result.push((
          <div className={classes.verificationWrapper} key={platformName}>
            <div className={classes.verificationBasicInfo}>
              <Icon
                key={platformName}
                type={platformName}
                className={composeClass(classes.socialIcon, PALTFORM_MODIFIER_CLASSES[platformName])}
              />
              <span>@{verification.username}</span>
              {this.renderProofStatus(platformName)}
            </div>
            {this.renderExtraInfo(platformName, verification)}
            <Divider />
          </div>
        ))
        continue
      }

      if (isSelf) {
        result.push((
          <div className={classes.verificationWrapper} key={platformName}>
            <div className={classes.verificationBasicInfo}>
              <Icon
                key={platformName}
                type={platformName}
                className={composeClass(classes.socialIcon, classes.notConnected)}
              />
              <span className={classes.notConnected}>
                Not connected to {PLATFORM_LABELS[platformName]}
              </span>
              <Link className={classes.connectLink} to={`/proving/${platformName}`}>
                Connect
                <Icon className={classes.connectIcon} type="caret-right" />
              </Link>
            </div>
            <Divider />
          </div>
        ))
      }
    }

    return result
  }

  private renderProofStatus(platformName: PLATFORMS) {
    const { isSelf } = this.props
    const { proofsStateStore } = this.props
    const {
      verifications,
      isVerifying: isVerifyings,
    } = proofsStateStore

    const isVerifying = isVerifyings[platformName]
    const verification = verifications[platformName]
    const { verifiedStatus } = verification

    const status = this.getCurrentStatus(isVerifying, verifiedStatus)
    let verificationStatusText = (
      <span className={composeClass(classes.verificationStatusText, STATUS_MODIFIER[status])} >
        {VERIFICATION_STATUS_TEXT[status]}
      </span>
    )

    if (isSelf) {
      verificationStatusText = (
        <Tooltip title="Click to overwrite the proof" placement="bottom">
          <Link
            to={`/proving/${platformName}`}
            className={classes.overwriteLink}
          >
            {verificationStatusText}
          </Link>
        </Tooltip>
      )
    }

    let verificationStatusIcon = (
      <a
        role="button"
        onClick={
          isVerifying ? undefined
          : () => proofsStateStore.verify(platformName, verification.socialProof!.proofURL)
        }
      >
        <Icon
          type={CHECK_STATUS_INDICATOR_ICON_TYPES[status]}
          className={composeClass(classes.verificationStatusIcon, STATUS_MODIFIER[status])}
        />
      </a>
    )

    if (!isVerifying) {
      verificationStatusIcon = (
        <Tooltip title="Click to re-check" placement="right">
          {verificationStatusIcon}
        </Tooltip>
      )
    }

    return (
      <div className={classes.statusWrapper}>
        {verificationStatusText}
        {verificationStatusIcon}
      </div>
    )
  }

  private renderExtraInfo(platformName: PLATFORMS, verification: IUserInfoVerications) {
    if (platformName === PLATFORMS.TWITTER) {
      return (
        <div className={classes.extraInfo}>
          <span className={classes.extraInfoItem}>{`${verification.info!.followers_count} Followers`}</span>
          <span className={classes.extraInfoItem}>{`${verification.info!.friends_count} Following`}</span>
        </div>
      )
    }

    return null
  }

  private getCurrentStatus(isVerifying: boolean, verifiedStatus?: IVerifiedStatus): STATUS {
    if (isVerifying || !verifiedStatus) {
      return STATUS.CHECKING
    }

    return verifiedStatus.status === VERIFIED_SOCIAL_STATUS.VALID ? STATUS.VALID : STATUS.INVALID
  }
}

enum STATUS {
  CHECKING,
  VALID,
  INVALID,
}

const VERIFICATION_STATUS_TEXT = {
  [STATUS.CHECKING]: 'Checking',
  [STATUS.VALID]: 'Verified',
  [STATUS.INVALID]: 'Invalid',
}

const CHECK_STATUS_INDICATOR_ICON_TYPES = {
  [STATUS.CHECKING]: 'loading',
  [STATUS.VALID]: 'check-circle',
  [STATUS.INVALID]: 'exclamation-circle',
}

const STATUS_MODIFIER = {
  [STATUS.CHECKING]: classes.checking,
  [STATUS.VALID]: classes.valid,
  [STATUS.INVALID]: classes.invalid,
}

interface IProps {
  isFirstCard: boolean,
  isSelf: boolean,
  userInfo: IProcessedUserInfo,
  proofsStateStore: UserProofsStateStore,
}

export default ProfileCard
