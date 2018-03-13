import * as React from 'react'

// component
import {
  Tooltip,
  Icon,
} from 'antd'
import Username from '../../../components/Username'
import { Link } from 'react-router-dom'

// style
import classnames from 'classnames'
import * as styles from './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../../stores'
import {
  ChatMessageStore,
} from '../../../stores/ChatMessageStore'
import {
  MetaMaskStore,
  ETHEREUM_NETWORK_TX_URL_PREFIX,
} from '../../../stores/MetaMaskStore'

import { getMessageTimeStamp } from '../../../utils/time'
import { IMessage, MESSAGE_STATUS } from '../../../databases/MessagesDB'

import ENV from '../../../config'

@inject(mapStoreToProps)
@observer
class Message extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>

  public render() {
    const {
      message: {
        meta,
        data,
      },
      contact,
    } = this.props
    const timestampStr = getMessageTimeStamp(data.timestamp)

    // if (data.messageType === MESSAGE_TYPE.CLOSE_SESSION) {
    //   return (
    //     <li>
    //       Session had been closed at {timestampStr}
    //     </li>
    //   )
    // }

    return (
      <li className={classnames(styles.message, {[styles.messageSelf]: meta.isFromYourself})}>
        <div className={styles.metaInfo}>
          <Link
            title={`${contact}`}
            className={styles.sender}
            to={`/profile/${contact}`}
          >
            {this.renderSender()}
          </Link>
          <span className={styles.time}>{timestampStr}</span>
        </div>
        <div className={styles.content}>
          <p className={styles.messageText}>{data.payload}</p>
          {this.renderStatus()}
        </div>
      </li>
    )
  }

  private renderSender() {
    const { isFromYourself } = this.props.message.meta
    if (isFromYourself) {
      return 'me'
    }

    return <Username userAddress={this.props.contact} maxLength={11} />
  }

  private renderStatus() {
    const { isFromYourself, transactionHash } = this.props.message.meta
    if (!isFromYourself) {
      return null
    }

    const currentNetwork = this.injectedProps.metaMaskStore.currentEthereumNetwork!
    const explorerURL = ETHEREUM_NETWORK_TX_URL_PREFIX[currentNetwork]

    const { messageStatus, confirmationCounter } = this.injectedProps.chatMessageStore
    if (messageStatus === MESSAGE_STATUS.DELIVERED) {
      return null
    }

    const isFailed = messageStatus === MESSAGE_STATUS.FAILED

    const iconType = isFailed ? 'close-circle-o' : 'loading'
    const iconElement = (
      <Icon className={classnames(styles.messageStatusIcon, { [styles.failed]: isFailed })} type={iconType} />
    )

    const statusStr = (
      <span
        className={classnames(styles.messageStatusStr, { [styles.failed]: isFailed })}
      >
          {MESSAGE_STATUS_STR[messageStatus]}
      </span>
    )

    const displayConfirmationCounter = (
      confirmationCounter >= ENV.REQUIRED_CONFIRMATION_NUMBER
        ? ENV.REQUIRED_CONFIRMATION_NUMBER
        : confirmationCounter
    )

    if (displayConfirmationCounter === ENV.REQUIRED_CONFIRMATION_NUMBER) {
      return null
    }

    const confirmationCounterStr = isFailed
      ? null
      : `(${displayConfirmationCounter}/${ENV.REQUIRED_CONFIRMATION_NUMBER})`

    let statusContent: JSX.Element
    if (explorerURL == null) {
      statusContent = (
        <span className={styles.messageStatus}>
          {iconElement}
          {statusStr}
          {confirmationCounterStr}
        </span>
      )
    } else {
      statusContent = (
        <a
          className={styles.messageStatus}
          target="_blank"
          href={`${explorerURL}${transactionHash!}`}
        >
          {iconElement}
          {statusStr}
          {confirmationCounterStr}
        </a>
      )
    }

    const tooltipTitle = isFailed ? 'Transaction has error' : 'Transaction processing'

    return (
      <Tooltip placement="left" title={tooltipTitle}>
        {statusContent}
      </Tooltip>
    )
  }
}

function mapStoreToProps(
  {
    metaMaskStore,
    usersStore,
  }: IStores,
  props: IProps,
): IInjectedProps {
  return {
    // FIXME: pass sessionStore to this component
    chatMessageStore: usersStore.currentUserStore!.sessionsStore.currentSessionStore!.getMessageStore(
      props.message,
    ),
    metaMaskStore,
  }
}

const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
})

interface IProps {
  message: IMessage
  contact: string
  plainText?: string
}

interface IInjectedProps {
  chatMessageStore: ChatMessageStore
  metaMaskStore: MetaMaskStore
}

export default Message
