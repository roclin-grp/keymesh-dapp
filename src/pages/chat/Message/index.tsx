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
  IMessage,
  ChatMessageStore,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
} from '../../../stores/ChatMessageStore'
import {
  IContact,
} from '../../../stores/UserStore'
import {
  MetaMaskStore,
  ETHEREUM_NETWORK_TX_URL_PREFIX,
} from '../../../stores/MetaMaskStore'

import { getMessageTimeStamp } from '../../../utils/time'
import { sleep } from '../../../utils'

@inject(mapStoreToProps)
@observer
class Message extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>
  private unmounted = false

  public componentDidMount() {
    const {
      messageStatus,
      checkMessageStatus,
    } = this.injectedProps.chatMessageStore
    if (messageStatus === MESSAGE_STATUS.DELIVERING) {
      checkMessageStatus({
        checkingDidFail: this.checkingDidFail,
      }).catch(this.checkingDidFail)
    }
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {
      message: {
        isFromYourself,
        timestamp,
        plainText,
        messageType,
      },
      contact,
    } = this.props
    const timestampStr = getMessageTimeStamp(timestamp)

    if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
      return (
        <li>
          Session had been closed at {timestampStr}
        </li>
      )
    }

    return (
      <li className={classnames(styles.message, {[styles.messageSelf]: isFromYourself})}>
        <div className={styles.metaInfo}>
          <span
            title={`${contact.userAddress}`}
            className={styles.sender}
          >
            {this.renderSender()}
          </span>
          <span className={styles.time}>{timestampStr}</span>
        </div>
        <div className={styles.content}>
          <p className={styles.messageText}>{plainText}</p>
          {this.renderStatus()}
        </div>
      </li>
    )
  }

  private renderSender() {
    const { isFromYourself } = this.props.message
    if (isFromYourself) {
      return 'me'
    }

    return <UserAddress address={this.props.contact.userAddress} maxLength={11} />
  }

  private renderStatus() {
    const { isFromYourself, transactionHash } = this.props.message
    if (!isFromYourself) {
      return null
    }

    const currentNetwork = this.injectedProps.metaMaskStore.currentEthereumNetwork!
    const explorerURL = ETHEREUM_NETWORK_TX_URL_PREFIX[currentNetwork]

    const iconElement = <Icon className={styles.messageStatusIcon} type="loading"/>
    const statusStr = MESSAGE_STATUS_STR[this.injectedProps.chatMessageStore.messageStatus]

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

  private checkingDidFail = async () => {
    await sleep(3000)
    if (!this.unmounted) {
      // retry checking
      this.componentDidMount()
    }
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
    chatMessageStore: usersStore.currentUserStore!.chatMessagesStore.getMessageStore(
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
  contact: IContact
  plainText?: string
}

interface IInjectedProps {
  chatMessageStore: ChatMessageStore
  metaMaskStore: MetaMaskStore
}

export default Message
