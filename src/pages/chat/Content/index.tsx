import * as React from 'react'

// component
import {
  List,
  Button,
} from 'antd'
import Session from '../Session'
import NewConversationDialog from '../NewConversationDialog'
import Dialog from '../Dialog'

// style
import * as styles from './index.css'
import classnames from 'classnames'

// state management
import {
  observer,
} from 'mobx-react'
import {
  UserStore,
} from '../../../stores/UserStore'

import { ISession } from '../../../databases/SessionsDB'

@observer
class ChatContent extends React.Component<IProps> {
  public render() {
    const {
      user,
      sessionsStore,
    } = this.props.userStore

    return (
      <div className={classnames(styles.content, 'container')}>
        <div className={styles.sessionList}>
          <div className={styles.sessionListTopBar}>
            <Button
              onClick={this.handleNewConversationClick}
              className={styles.newConversationButton}
              icon="plus"
              size="small"
              type="primary"
            />
          </div>
          <List
            className={styles.sessionListInner}
            dataSource={sessionsStore.sessions}
            renderItem={(session: ISession) => (
              <Session
                className={classnames({
                  [styles.selectedSession]: sessionsStore.isCurrentSession(session.sessionTag),
                })}
                key={session.sessionTag}
                sessionStore={sessionsStore.getSessionStore(session)}
                onClick={this.handleSelectSession}
              />
            )}
            // Here is a hack, since antd does not provide renderEmpty prop
            // you can actually put any JSX.Element into emptyText
            locale={{emptyText: <>No session</>}}
          />
        </div>
        {
          sessionsStore.hasSelectedSession
            ? <Dialog sessionStore={sessionsStore.currentSessionStore!} />
            : <NewConversationDialog sessionsStore={sessionsStore} user={user} />
        }
      </div>
    )
  }

  private handleSelectSession = async (session: ISession) => {
    const {
      sessionsStore,
    } = this.props.userStore
    if (
      !sessionsStore.isSwitchingSession
      && !sessionsStore.isCurrentSession(session.sessionTag)
    ) {
      // TODO: catch and warn if session data could load
      await sessionsStore.selectSession(session)
    }
  }

  private handleNewConversationClick = () => {
    this.props.userStore.sessionsStore.unselectSession()
  }
}

interface IProps {
  userStore: UserStore
}

export default ChatContent
