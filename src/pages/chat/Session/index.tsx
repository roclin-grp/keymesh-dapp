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
  SessionStore,
} from '../../../stores/SessionStore'

import { getSessionTimestamp } from '../../../utils/time'
import { ISession } from '../../../databases/SessionsDB'

@observer
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
                <HashAvatar
                  size="large"
                  shape="square"
                  hash="" // FXIME
                />
              </Badge>
            )}
            title={<UserAddress address={data.contact} maxLength={11} />}
            description={<span className={styles.summary}>{data.summary}</span>}
          />
          <span>{getSessionTimestamp(meta.lastUpdate)}</span>
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
