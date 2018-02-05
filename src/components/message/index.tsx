import * as React from 'react'

import * as classnames from 'classnames'
import * as styles from './index.css'

import {
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  MESSAGE_STATUS_STR,
} from '../../stores/SessionStore'
import {
  IContact,
} from '../../stores/UserStore'

interface IProps {
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  contact: IContact
  plainText?: string
  status: MESSAGE_STATUS
}

class Message extends React.Component<IProps> {
  public render() {
    const {
      isFromYourself,
      contact,
      timestamp,
      plainText,
      messageType,
      status,
    } = this.props

    const time = new Date(timestamp)
    const timeStr =
      `${Date.now() - time.getTime() > 86400 * 1000 ? `${
        time.getDate()
      }/${
        time.getMonth() + 1
      }/${
        time.getFullYear()
      } ` : ''}${
        time.getHours().toString().padStart(2, '0')
      }:${
        time.getMinutes().toString().padStart(2, '0')
      }:${
        time.getSeconds().toString().padStart(2, '0')
      }`

    if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
      return <li>
        Session had been closed by {contact.userAddress} at {timeStr}</li>
    }

    let statusStr: string | undefined
    if (isFromYourself) {
      statusStr = MESSAGE_STATUS_STR[status]
    }

    return <li className={classnames(styles.message, {[styles.messageSelf]: isFromYourself})}>
      <div className={styles.metaInfo}>
        <span
          title={`${contact.userAddress}`}
          className={styles.sender}
        >
          {isFromYourself ? 'me' : contact.userAddress}
        </span>
        <span className={styles.time}>{timeStr}</span>
      </div>
      <p className={styles.content}>{plainText}</p>
      {statusStr ? statusStr : null}
    </li>
  }
}

export default Message
