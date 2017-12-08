import * as React from 'react'

import {
  MESSAGE_TYPE
} from '../../constants'

import './index.css'
import { Icontact } from '../../../typings/interface'

interface Iprops {
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  contact: Icontact
  plainText?: string
}

interface Istate {
}

class Message extends React.Component<Iprops, Istate> {
  public render() {
    const {
      isFromYourself,
      contact,
      timestamp,
      plainText,
      messageType
    } = this.props
    const time = new Date(timestamp * 1000)
    if (messageType === MESSAGE_TYPE.CLOSE_SESSION) {
      return <li className="close-session-msg">
        Session had been closed by {contact.username}({contact.usernameHash}) at {`${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()} ${time.getHours()}:${time.getMinutes()}`}
      </li>
    }
    return <li className={`message${isFromYourself ? ' message--self' : ''}`}>
      <div className="meta-info">
        <span
          title={`${contact.username}(${contact.usernameHash.slice(0, 9)}...${contact.usernameHash.slice(-4)})`}
          className="sender">
          {isFromYourself ? 'me' : contact.username}
        </span>
        <span className="time">
          {`${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()} ${time.getHours()}:${time.getMinutes()}`}
        </span>
      </div>
      <p className="content">{plainText}</p>
    </li>
  }
}

export default Message
