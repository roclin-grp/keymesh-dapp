import * as React from 'react'
import { RouteComponentProps, Link } from 'react-router-dom'

// component
import {
  Divider,
  List,
  Button,
} from 'antd'
import AccountListItem from './AccountListItem'
import StatusButton, { STATUS_TYPE } from '../../components/StatusButton'
import RestoreUserButton from '../../components/RestoreUserButton'

// style
import * as classes from './index.css'

// state management
import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { UsersStore } from '../../stores/UsersStore'
import { IUser } from '../../stores/UserStore'

// helper
import { storeLogger } from '../../utils/loggers'
import { Lambda } from 'mobx'

@inject(mapStoreToProps)
@observer
class Accounts extends React.Component<IProps, IState> {
  public readonly state = defaultState

  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>
  private disposeWalletAccountReaction: Lambda | undefined
  private isUnmounted = false

  public componentDidMount() {
    const { metaMaskStore } = this.injectedProps
    // reset state when wallet account have changed
    this.disposeWalletAccountReaction = metaMaskStore.listenForWalletAccountChange(this.resetState)
  }
  public componentWillUnmount() {
    this.isUnmounted = true

    const { disposeWalletAccountReaction } = this
    if (disposeWalletAccountReaction) {
      disposeWalletAccountReaction()
    }
  }

  public render() {
    const { usersStore } = this.injectedProps

    return (
      <div className="page-container">
        <section className="block">
          {this.renderAccountList(
            usersStore,
          )}
          <Divider />
          <div className="vertical-align-container">
            <RestoreUserButton />
            {this.renderBackupButton(usersStore)}
          </div>
        </section>
      </div>
    )
  }

  private renderAccountList(
    usersStore: UsersStore,
  ) {
    const { users } = usersStore

    return (
      <>
        <h2>Registered Accounts</h2>
        <List
          className={classes.otherAccounts}
          rowKey={((user: IUser) => user.userAddress)}
          dataSource={users}
          renderItem={(user: IUser) => (
            <AccountListItem userStore={usersStore.getUserStore(user)} />
          )}
        />
        <Divider />
        <Button size="large" type="primary">
          <Link to="/register">
            Register New Account
          </Link>
        </Button>
      </>
    )
  }

  private renderBackupButton(usersStore: UsersStore) {
    const { currentUserStore } = usersStore
    if (currentUserStore == null) {
      return null
    }

    const { backupStatus } = this.state

    const isExporting = backupStatus === BACKUP_USER_STATUS.PROCESSING
    const statusType = backupStatus ? ICON_TYPES[backupStatus] : undefined
    const statusContent = backupStatus ? STATUS_CONTENT[backupStatus] : undefined
    const helpContent = backupStatus ? HELP_MESSAGES[backupStatus] : undefined

    return (
      <StatusButton
        className={classes.exportButton}
        buttonProps={{ type: undefined, size: 'default', icon: 'download' }}
        disabled={isExporting}
        statusType={statusType}
        statusContent={statusContent}
        helpContent={helpContent}
        onClick={this.handleBackup}
      >
        Backup Current Account
      </StatusButton>
    )
  }

  private handleBackup = async () => {
    this.setState({
      backupStatus: BACKUP_USER_STATUS.PROCESSING,
    })

    const { currentUserStore } = this.injectedProps.usersStore

    if (currentUserStore == null) {
      return
    }

    try {
      await currentUserStore.exportUser()
      this.setState({
        backupStatus: undefined,
      })
    } catch (err) {
      storeLogger.error('Unexpected backup error:', err)
      if (this.isUnmounted) {
        return
      }

      this.setState({
        backupStatus: BACKUP_USER_STATUS.FAILED,
      })
    }
  }

  private resetState = () => {
    this.setState(defaultState)
  }
}

function mapStoreToProps({
  metaMaskStore,
  usersStore,
}: IStores) {
  return {
    metaMaskStore,
    usersStore,
  }
}

export enum BACKUP_USER_STATUS {
  PROCESSING,
  FAILED,
}

const ICON_TYPES = Object.freeze({
  [BACKUP_USER_STATUS.PROCESSING]: STATUS_TYPE.LOADING,
  [BACKUP_USER_STATUS.FAILED]: STATUS_TYPE.ERROR,
})

const STATUS_CONTENT = Object.freeze({
  [BACKUP_USER_STATUS.PROCESSING]: 'Processing...',
  [BACKUP_USER_STATUS.FAILED]: 'Backup failed',
})

const HELP_MESSAGES = Object.freeze({
  [BACKUP_USER_STATUS.FAILED]: 'Sorry! you can retry later',
})

interface IProps extends RouteComponentProps<{}> { }

const defaultState: Readonly<IState> = {
  backupStatus: undefined,
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

interface IState {
  backupStatus?: BACKUP_USER_STATUS
}

export default Accounts
