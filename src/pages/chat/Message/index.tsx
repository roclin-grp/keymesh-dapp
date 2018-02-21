import * as React from 'react'

// component
import {
  Tooltip,
  Icon,
} from 'antd'
import UserAddress from '../../../components/UserAddress'

// style
import * as classnames from 'classnames'
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

@inject(mapStoreToProps)
@observer
class Message extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>

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

  public render() {
    const {
      message: {
        isFromYourself,
        timestamp,
        plainText,
        messageType,
        transactionHash,
      },
      contact,
    } = this.props
    const {
      messageStatus,
    } = this.injectedProps.chatMessageStore

    let timeStr = ''
    if (timestamp > 0) {
      const time = new Date(timestamp)
      timeStr =
        `${Date.now() - time.getTime() > 86400 * 1000 ? `${
          time.getDate().toString().padStart(2, '0')
        }/${
          (time.getMonth() + 1).toString().padStart(2, '0')
        }/${
          time.getFullYear()
        } ` : ''}${
          time.getHours().toString().padStart(2, '0')
        }:${
          time.getMinutes().toString().padStart(2, '0')
        }:${
          time.getSeconds().toString().padStart(2, '0')
        }`
    }

    if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
      return <li>
        Session had been closed by {contact.userAddress} at {timeStr}
      </li>
    }

    let statusStr: string | undefined
    if (isFromYourself) {
      statusStr = MESSAGE_STATUS_STR[messageStatus]
    }

    return (
      <li className={classnames(styles.message, {[styles.messageSelf]: isFromYourself})}>
        <div className={styles.metaInfo}>
          <span
            title={`${contact.userAddress}`}
            className={styles.sender}
          >
            {
              isFromYourself
              ? 'me'
              : <UserAddress address={contact.userAddress} maxLength={11} />
            }
          </span>
          <span className={styles.time}>{timeStr}</span>
        </div>
        <div className={styles.content}>
          <p className={styles.messageText}>{plainText}</p>
          {statusStr
            ? (
              <Tooltip title="Transaction processing" placement="bottom">
                <a
                  className={styles.messageStatus}
                  target="_blank"
                  href={`${
                    ETHEREUM_NETWORK_TX_URL_PREFIX[this.injectedProps.metaMaskStore.currentEthereumNetwork!] || '#'
                  }${transactionHash!}`}
                >
                  <Icon className={styles.messageStatusIcon} type="loading"/>
                  <span>{statusStr}</span>
                </a>
              </Tooltip>
            )
            : null
          }
        </div>
      </li>
    )
  }

  private checkingDidFail = () => {
    // just retry
    window.setTimeout(
      () => {
        this.componentDidMount()
      },
      3000,
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
