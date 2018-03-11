import * as React from 'react'

// component
import UserAvatar from '../../../components/UserAvatar'
import Username from '../../../components/Username'
import {
  List,
  Badge,
} from 'antd'

// style
import * as styles from './index.css'
import classnames from 'classnames'

// state management
import { SessionStore } from '../../../stores/SessionStore'

import { getSessionTimestamp } from '../../../utils/time'
import { ISession } from '../../../databases/SessionsDB'

class Session extends React.Component<IProps> {
  public render() {
    const {
      meta,
      data,
    } = this.props.sessionStore.session

    return (
      <a
        className={classnames(styles.listItem, this.props.className)}
        onClick={this.handleClick}
      >
        <List.Item
        >
          <List.Item.Meta
            avatar={(
              <Badge count={meta.unreadCount} overflowCount={99}>
                <UserAvatar
                  userAddress={data.contact}
                  size="large"
                  shape="square"
                />
              </Badge>
            )}
            title={this.renderTitle()}
            description={this.renderSummary()}
          />
          {this.renderTimestamp()}
        </List.Item>
      </a>
    )
  }

  private renderTitle() {
    const { session } = this.props.sessionStore
    if (session.meta.isNewSession) {
      return <span className={styles.newConversationText}>New conversation</span>
    }

    return (
      <Username
        className={styles.username}
        userAddress={session.data.contact}
        maxLength={11}
      />
    )
  }

  private handleClick = () => {
    const {
      onClick,
      sessionStore,
    } = this.props
    onClick(sessionStore.session)
  }

  private renderSummary() {
    const { summary } = this.props.sessionStore.session.data
    if (summary === '') {
      // empty session
      return null
    }

    return <span className={styles.summary}>{summary}</span>
  }

  private renderTimestamp() {
    const { session } = this.props.sessionStore

    if (session.data.summary === '') {
      // empty session
      return null
    }

    return <span>{getSessionTimestamp(session.meta.lastUpdate)}</span>
  }
}

interface IProps {
  className?: string
  sessionStore: SessionStore
  onClick: (session: ISession) => void
}

export default Session
