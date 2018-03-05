import * as React from 'react'

// component
import {
  Tooltip,
  Icon,
} from 'antd'
import UserAddress from '../../../components/UserAddress'

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
import { IMessage, MESSAGE_STATUS, MESSAGE_TYPE } from '../../../databases/MessagesDB'

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

    if (data.messageType === MESSAGE_TYPE.CLOSE_SESSION) {
      return (
        <li>
          Session had been closed at {timestampStr}
        </li>
      )
    }

    return (
      <li className={classnames(styles.message, {[styles.messageSelf]: meta.isFromYourself})}>
        <div className={styles.metaInfo}>
          <span
            title={`${contact}`}
            className={styles.sender}
          >
            {this.renderSender()}
          </span>
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

    return <UserAddress address={this.props.contact} maxLength={11} />
  }

  private renderStatus() {
    const { isFromYourself, transactionHash } = this.props.message.meta
    if (!isFromYourself) {
      return null
    }

    const currentNetwork = this.injectedProps.metaMaskStore.currentEthereumNetwork!
    const explorerURL = ETHEREUM_NETWORK_TX_URL_PREFIX[currentNetwork]

    const { messageStatus } = this.injectedProps.chatMessageStore
    if (messageStatus === MESSAGE_STATUS.DELIVERED) {
      return null
    }

    const iconElement = <Icon className={styles.messageStatusIcon} type="loading"/>
    const statusStr = <span>{MESSAGE_STATUS_STR[messageStatus]}</span>

    let statusContent: JSX.Element
    if (explorerURL == null) {
      statusContent = (
        <span className={styles.messageStatus}>
          {iconElement}
          {statusStr}
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
        </a>
      )
    }

    return (
      <Tooltip title="Transaction processing" placement="bottom">
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
