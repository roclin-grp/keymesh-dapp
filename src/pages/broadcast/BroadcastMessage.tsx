import * as React from 'react'

import { Link } from 'react-router-dom'
import { Icon } from 'antd'
import UserAvatar from '../../components/UserAvatar'
import Username from '../../components/Username'

import { observer } from 'mobx-react'
import {
  IBroadcastMessage,
  MESSAGE_STATUS,
} from '../../stores/BroadcastMessagesStore'
import { UserCachesStore } from '../../stores/UserCachesStore'
import { UserProofsStateStore } from '../../stores/UserProofsStateStore'
import { PALTFORM_MODIFIER_CLASSES } from '../../stores/SocialProofsStore'

import * as styles from './BroadcastMessage.css'
import classnames from 'classnames'

import { sleep } from '../../utils'
import { getBroadcastEstimateTime, getBroadcastTime } from '../../utils/time'

@observer
export default class BroadcastMessage extends React.Component<IProps, IState> {
  public state = defaultState

  private isUnmounted = false
  public async componentDidMount() {
    this.updateTimeText()

    // fetch proving per 15 mins
    this.props.userProofsStateStore.startFetchUserProofs(15 * 60 * 1000)
  }

  public componentWillUnmount() {
    this.isUnmounted = true
    this.props.userProofsStateStore.stopFetchUserProofs()
  }

  public render() {
    const { message } = this.props
    const userAddress = message.author!

    return <div className={styles.broadcastMessage}>
      <UserAvatar
        userAddress={userAddress}
        className={styles.avatar}
        shape="circle"
        size="large"
      />
      <div className={styles.body}>
        <div className={styles.infoWrapper}>
          <Link to={`/profile/${userAddress}`}>
            <Username
              className={classnames(styles.username)}
              userAddress={userAddress}
              maxLength={16}
            />
            {this.renderPlatformIcons()}
          </Link>
          <span title={getBroadcastTime(message.timestamp)}>
            {` ${this.state.timeText}`}
          </span>
        </div>
        <p className={styles.content}>{message.message}</p>
        {this.renderMessageStatus()}
      </div>
    </div>
  }

  private async updateTimeText() {
    while (!this.isUnmounted) {
      const timeText = getBroadcastEstimateTime(this.props.message.timestamp)
      this.setState({
        timeText,
      })

      await sleep(60 * 1000)
    }
  }

  private renderPlatformIcons() {
    const { getValidProofs } = this.props.userProofsStateStore
    const validProofs = getValidProofs()

    const platformIcons: JSX.Element[] = []
    for (const validProof of validProofs) {
      const platform = validProof.platform
      platformIcons.push((
        <Icon
          key={platform}
          type={platform}
          className={classnames(styles.socialIcon, PALTFORM_MODIFIER_CLASSES[platform])}
        />
      ))
    }

    return platformIcons
  }

  private renderMessageStatus() {
    const messageStatus = this.props.status
    if (messageStatus === MESSAGE_STATUS.DELIVERED) {
      return null
    }
    return (
      <p className={classnames(styles.status, MESSAGE_MODIFIER_CLASSES[messageStatus])}>
        {MESSAGE_STATUS_STR[messageStatus]}
      </p>
    )
  }
}

interface IProps {
  message: IBroadcastMessage
  userCachesStore: UserCachesStore
  userProofsStateStore: UserProofsStateStore
  status: MESSAGE_STATUS
}

interface IState {
  timeText: string
}

const defaultState: Readonly<IState> = {
  timeText: '',
}

const MESSAGE_MODIFIER_CLASSES = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: styles.delivering,
  [MESSAGE_STATUS.FAILED]: styles.failed,
})

const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
})
