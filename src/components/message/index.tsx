import * as React from 'react'

import {
  MESSAGE_TYPE
} from '../../constants'

import './index.css'

interface Iprops {
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  contact: string
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
        Session had been closed by {contact} at {`${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()} ${time.getHours()}:${time.getMinutes()}`}
      </li>
    }
    return <li className={`message${isFromYourself ? ' message--self' : ''}`}>
      <div className="meta-info">
        <span className="sender">{isFromYourself ? 'me' : contact}</span>
        <span className="time">
          {`${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()} ${time.getHours()}:${time.getMinutes()}`}
        </span>
      </div>
      <p className="content">{plainText}</p>
    </li>
  }
}

export default Message
