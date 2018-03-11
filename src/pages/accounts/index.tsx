import * as React from 'react'
import { RouteComponentProps, Link } from 'react-router-dom'

// component
import {
  Divider,
  Upload,
  message,
  List,
  Button,
} from 'antd'
import { UploadFile } from 'antd/lib/upload/interface.d'
import AccountListItem from './AccountListItem'
import StatusButton, { STATUS_TYPE } from '../../components/StatusButton'

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
import { sleep } from '../../utils'
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
    const { metaMaskStore, usersStore } = this.injectedProps

    return (
      <div className="page-container">
        <section className="block">
          {this.renderAccountList(
            metaMaskStore,
            usersStore,
          )}
          <Divider />
          <div className="vertical-align-container">
            <Upload
              action="/"
              beforeUpload={this.handleImport}
              accept=".json"
              disabled={this.state.isImporting}
            >
              <Button icon="upload">
                Restore Account Backup
              </Button>
            </Upload>
            {this.renderExportButton(usersStore)}
          </div>
        </section>
      </div>
    )
  }

  private renderAccountList(
    metaMaskStore: MetaMaskStore,
    usersStore: UsersStore,
  ) {
    const { users } = usersStore
    const currentEthereumAccount = metaMaskStore.currentEthereumAccount!

    const otherUsers = users.filter((user) => user.userAddress !== currentEthereumAccount)
    if (otherUsers.length === 0) {
      return null
    }

    return (
      <>
        <h2>Registered Accounts</h2>
        <List
          className={classes.otherAccounts}
          rowKey={((user: IUser) => user.userAddress)}
          dataSource={otherUsers}
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

  private renderExportButton(usersStore: UsersStore) {
    const { currentUserStore } = usersStore
    if (currentUserStore == null) {
      return null
    }

    const { isExporting } = this.state

    return (
      <StatusButton
        className={classes.exportButton}
        buttonProps={{ type: undefined, size: 'default', icon: 'download' }}
        disabled={isExporting}
        statusType={isExporting ? STATUS_TYPE.LOADING : undefined}
        statusContent={isExporting ? 'Exporting...' : this.state.exportButtonContent}
        onClick={this.handleExport}
      >
        Backup Account
      </StatusButton>
    )
  }

  private handleImport = (_: UploadFile, files: UploadFile[]) => {
    if (files.length === 0) {
      return false
    }
    this.setState({
      isImporting: true,
    })
    const file: File = files[0] as any
    const reader = new FileReader()
    reader.onload = async (oFREvent) => {
      try {
        const user = await this.injectedProps.usersStore.importUser((oFREvent.target as any).result)
        if (this.isUnmounted) {
          return
        }

        if (this.injectedProps.usersStore.users.length === 1) {
          await this.injectedProps.usersStore.useUser(user)

          this.injectedProps.history.push('/getting-started')
          await sleep(50)
          message.success('Account backup restored!')
        } else {
          await sleep(50)
          message.success('Account backup restored!')
        }
      } catch (err) {
        if (this.isUnmounted) {
          return
        }

        if ((err as Error).message === 'Network not match') {
          message.error('This account backup belongs to another network')
          return
        }

        if ((err as Error).message.includes('Key already exists in the object store')) {
          message.info('This account already exists')
          return
        }

        storeLogger.error(err)
        message.error('Something went wrong')
      } finally {
        if (!this.isUnmounted) {
          this.setState({
            isImporting: false,
          })
        }
      }
    }
    reader.readAsText(file)
    return false
  }

  private handleExport = async () => {
    this.setState({
      isExporting: true,
    })

    try {
      await this.injectedProps.usersStore.currentUserStore!.exportUser()
    } catch (err) {
      storeLogger.error('Unexpected backup error:', err)
      if (this.isUnmounted) {
        return
      }

      this.setState({
        exportButtonContent: 'Backup failed.',
      })
    } finally {
      if (!this.isUnmounted) {
        this.setState({
          isExporting: false,
        })
      }
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

// typing
interface IProps extends RouteComponentProps<{}> { }

const defaultState: Readonly<IState> = {
  isCreatingTransaction: false,
  isImporting: false,
  isExporting: false,
  exportButtonContent: undefined,
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

interface IState {
  isCreatingTransaction: boolean
  isImporting: boolean
  isExporting: boolean
  exportButtonContent?: JSX.Element | string
}

export default Accounts
