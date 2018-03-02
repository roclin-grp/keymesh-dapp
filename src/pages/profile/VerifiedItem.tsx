import * as React from 'react'

import { Link } from 'react-router-dom'

import { Icon, Tooltip } from 'antd'

import * as classes from './VerifiedItem.css'
import classnames from 'classnames'

import { observer } from 'mobx-react'
import {
  PLATFORMS,
  VERIFIED_SOCIAL_STATUS,
  PALTFORM_MODIFIER_CLASSES,
  ISocialProof,
  IVerifiedStatus,
} from '../../stores/SocialProofsStore'

@observer
class VerifiedItem extends React.Component<IProps> {
  public render() {
    const { platform } = this.props
    const currentStatus = this.getCurrentStatus()

    return (
      <li className={classnames(classes.verifiedItem, STATUS_MODIFIER[currentStatus])}>
        <Icon type={platform} className={classnames(classes.platformIcon, PALTFORM_MODIFIER_CLASSES[platform])} />
        {this.renderUsername(currentStatus)}
        <Tooltip title="Click to re-check" placement="right">
          <Icon
            onClick={this.props.verify}
            type={CHECK_STATUS_INDICATOR_ICON_TYPES[currentStatus]}
            className={classes.checkStatusIndicatorIcon}
          />
        </Tooltip>
      </li>
    )
  }

  private renderUsername(currentStatus: STATUS) {
    const {
      isSelf,
      platform,
      socialProof: {
        username,
        proofURL,
      },
    } = this.props

    const platformElement = <span className={classes.platformText}>@{platform}</span>

    if (isSelf) {
      return (
        <Link className={classes.username} to={`/proving/${platform}`} title="Click to overwrite the proof">
          {username}{platformElement}
        </Link>
      )
    }

    if (currentStatus === STATUS.VALID) {
      return (
        <a className={classes.username} href={proofURL} target="_blank" title={username}>
          {username}{platformElement}
        </a>
      )
    }

    return (
      <span className={classes.username}>
        {username}{platformElement}
      </span>
    )
  }

  private getCurrentStatus(): STATUS {
    const {
      isVerifying,
      verifiedStatus,
  } = this.props
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

const CHECK_STATUS_INDICATOR_ICON_TYPES = {
  [STATUS.CHECKING]: 'clock-circle',
  [STATUS.VALID]: 'check-circle',
  [STATUS.INVALID]: 'cross-circle',
}

const STATUS_MODIFIER = {
  [STATUS.CHECKING]: classes.checking,
  [STATUS.VALID]: classes.valid,
  [STATUS.INVALID]: classes.invalid,
}

interface IProps {
  platform: PLATFORMS
  socialProof: ISocialProof
  verifiedStatus?: IVerifiedStatus
  isSelf: boolean
  isVerifying: boolean
  verify: () => Promise<void>
}

export default VerifiedItem
