import * as React from 'react'

// component
import HashAvatar from '../../../components/HashAvatar'
import UserAddress from '../../../components/UserAddress'
import {
  List,
  Badge,
} from 'antd'

// style
import * as styles from './index.css'
import classnames from 'classnames'

// state management
import {
  observer,
} from 'mobx-react'
import {
  ISession,
  SessionStore,
} from '../../../stores/SessionStore'

import { getSessionTimestamp } from '../../../utils/time'

@observer
class Session extends React.Component<IProps> {
  public render() {
    const {
      contact,
      summary,
      lastUpdate,
      unreadCount,
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
              <Badge count={unreadCount} overflowCount={99}>
                <HashAvatar
                  size="large"
                  shape="square"
                  hash={SessionStore.getAvatarHashByContact(contact)}
                />
              </Badge>
            )}
            title={<UserAddress address={contact.userAddress} maxLength={11} />}
            description={<span className={styles.summary}>{summary}</span>}
          />
          <span>{getSessionTimestamp(lastUpdate)}</span>
        </List.Item>
      </a>
    )
  }

  private handleClick = () => {
    const {
      onClick,
      sessionStore,
    } = this.props
    onClick(sessionStore.session)
  }
}

interface IProps {
  className?: string
  sessionStore: SessionStore
  onClick: (session: ISession) => void
}

export default Session
