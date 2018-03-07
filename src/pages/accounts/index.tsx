import * as React from 'react'
import { RouteComponentProps } from 'react-router-dom'

// component
import {
  Divider,
  Icon,
  Upload,
  message,
  List,
  Modal,
  Button,
  Alert,
  Tooltip,
} from 'antd'
import { UploadFile } from 'antd/lib/upload/interface.d'
import AccountListItem from './AccountListItem'
import UserAddress from '../../components/UserAddress'
import StatusButton, { STATUS_TYPE } from '../../components/StatusButton'

// style
import * as classes from './index.css'

// state management
import { inject, observer} from 'mobx-react'
import { IStores } from '../../stores'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { UsersStore, REGISTER_FAIL_CODE } from '../../stores/UsersStore'
import { IUser, UserStore, USER_STATUS } from '../../stores/UserStore'

// helper
import { storeLogger } from '../../utils/loggers'
import { sleep } from '../../utils'
import { Lambda } from 'mobx'
import AccountRegisterStatus, { REGISTER_STATUS } from './AccountRegisterStatus'

@inject(mapStoreToProps)
@observer
class Accounts extends React.Component<IProps, IState> {
  public readonly state = defaultState

  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>
  private disposeWalletAccountReaction: Lambda | undefined
  private retryCheckStatus: (() => void) | undefined
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
    const {
      hasRegisterRecordOnLocal,
      hasRegisterRecordOnChain,
      hasUser,
      walletCorrespondingUserStore,
    } = usersStore

    return (
      <div className={classes.container}>
        <section>
          <h2 className="title">
            Register New Account
          </h2>
          <h3>Account selected in MetaMask</h3>
          {this.renderCurrentWalletAccount(metaMaskStore, walletCorrespondingUserStore)}
          {this.renderRegisterStatusButton(
            usersStore, hasRegisterRecordOnLocal, hasRegisterRecordOnChain, walletCorrespondingUserStore,
          )}
          {this.renderExtraRegisterInfo(usersStore, hasRegisterRecordOnLocal, hasRegisterRecordOnChain)}
          <Divider />
        </section>
        {this.renderSignInToOtherAccountsSection(metaMaskStore, usersStore)}
        <section>
          <h3 className="title">
            {hasUser ? 'Import/Export Account' : 'Import Backup Account'}
          </h3>
          <div className={classes.importExportButtons} >
            <Upload
              action="/"
              beforeUpload={this.handleImport}
              accept=".json"
              disabled={this.state.isImporting}
            >
              <Button icon="upload">
                {hasUser ? 'Import Backup Account' : 'Import'}
              </Button>
            </Upload>
            {this.renderExportButton(usersStore)}
          </div>
        </section>
      </div>
    )
  }

  private renderCurrentWalletAccount(
    metaMaskStore: MetaMaskStore,
    walletCorrespondingUserStore?: UserStore,
  ) {
    const currentEthereumAccount = metaMaskStore.currentEthereumAccount!

    if (walletCorrespondingUserStore == null) {
      // unregistered, display user address only
      return <UserAddress className={classes.userAddress} address={currentEthereumAccount} />
    }

    return (
      <AccountListItem
        key={walletCorrespondingUserStore.user.userAddress}
        userStore={walletCorrespondingUserStore}
      />
    )
  }

  private renderRegisterStatusButton(
    usersStore: UsersStore,
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
    walletCorrespondingUserStore?: UserStore,
  ) {
    const { isCheckingRegisterRecord } = usersStore
    const canTakeover = !hasRegisterRecordOnLocal && hasRegisterRecordOnChain
    const handleClick = canTakeover ? this.handleConfirmTakeOver : this.handleRegister

    const { isCreatingTransaction } = this.state
    const shouldDisableButton = isCheckingRegisterRecord || hasRegisterRecordOnLocal || isCreatingTransaction

    const [statusType, statusContent] = this.getStatusTypeAndContent(
      isCheckingRegisterRecord,
      walletCorrespondingUserStore,
    )

    return (
      <StatusButton
        className={classes.registerButtonWrapper}
        buttonClassName={classes.registerButton}
        disabled={shouldDisableButton}
        statusType={statusType}
        statusContent={statusContent}
        onClick={handleClick}
      >
        Register
      </StatusButton>
    )
  }

  private getStatusTypeAndContent(
    isCheckingRegisterRecord: boolean,
    walletCorrespondingUserStore?: UserStore,
  ): [STATUS_TYPE, React.ReactNode | undefined] {

    if (isCheckingRegisterRecord) {
      const type = STATUS_TYPE.LOADING
      const content = (
        <>
          Checking...
          <Tooltip title="Checking register record on blockchain...">
            <Icon className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </>
      )
      return [type, content]
    }

    if (
      walletCorrespondingUserStore != null
      && walletCorrespondingUserStore.user.status === USER_STATUS.OK
    ) {
      const type = STATUS_TYPE.SUCCESS
      const content = 'Registered'
      return [type, content]
    }

    const { registerStatus, registerStatusContent } = this.state
    const statusType = REGISTER_STATUS_ICON_TYPES[registerStatus]
    let statusContent = registerStatusContent

    if (walletCorrespondingUserStore != null) {
      const canRetry = (
        registerStatus === REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL ||
        registerStatus === REGISTER_STATUS.UNEXCEPTED_ERROR
      )
      const retryButton = (
        <Button
          type="primary"
          onClick={this.retryCheckStatus}
        >
          Retry
        </Button>
      )

      statusContent = (
        <>
          <AccountRegisterStatus
            key={walletCorrespondingUserStore.user.userAddress}
            userStore={walletCorrespondingUserStore}
            getRetry={this.getCheckStatusRetry}
            onStatusChanged={this.handleRegisterStatusChanged}
            onRegisterCompleted={this.handleRegisterCompleted}
          />
          {
            canRetry
            ? retryButton
            : null
          }
        </>
      )
    }

    return [statusType, statusContent]
  }

  private renderExtraRegisterInfo(
    usersStore: UsersStore,
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
  ) {
    const { registerStatus } = this.state
    const { extraRegisterInfo } = classes

    if (usersStore.isCheckingRegisterRecord) {
      return null
    }

    if (registerStatus === TRANSACTION_CREATION_STATUS.PENDING) {
      return (
        <p className={extraRegisterInfo}>
          Please confirm the transaction in MetaMask.
          <Tooltip title="Please click the MetaMask extension icon">
            <Icon className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </p>
      )
    }

    if (hasRegisterRecordOnLocal) {
      // TODO: help link
      return <a className={extraRegisterInfo}>How to select a different Ethereum address?</a>
    }

    if (hasRegisterRecordOnChain) {
      return (
        <Alert
          message="This address is already registered, register a new account will take over it."
          type="warning"
          showIcon
        />
      )
    }

    return null
  }

  private renderSignInToOtherAccountsSection(
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
      <section>
        <h2 className="title">
          Manage Accounts
        </h2>
        <List
          className={classes.otherAccounts}
          rowKey={((user: IUser) => user.userAddress)}
          dataSource={otherUsers}
          renderItem={(user: IUser) => (
            <AccountListItem userStore={usersStore.getUserStore(user)} />
          )}
        />
        <Divider />
      </section>
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
        Export Current Account
      </StatusButton>
    )
  }

  private getCheckStatusRetry = (retry: () => void) => {
    this.retryCheckStatus = retry
  }

  private handleRegisterStatusChanged = (status: REGISTER_STATUS) => {
    if (this.isUnmounted) {
      return
    }

    this.setState({
      registerStatus: status,
    })
  }

  private handleRegisterCompleted = async () => {
    if (this.isUnmounted) {
      return
    }

    const { usersStore } = this.injectedProps
    const { users } = usersStore
    if (users.length === 1) {
      await usersStore.useUser(users[0])

      // redirect and guide user to proving
      this.props.history.push('/profile')
      // await render..
      await sleep(100)
      message.success('You have successfully registered and logged in!')

      await sleep(4000)
      message.info('You can now let others know you by proving yourself on social media!')
    }
  }

  private handleRegister = () => {
    this.setState({
      isCreatingTransaction: true,
      registerStatus: TRANSACTION_CREATION_STATUS.CHECKING,
      registerStatusContent: 'Checking...',
    })

    this.injectedProps.usersStore.register({
      transactionWillCreate: this.transactionWillCreate,
      registerDidFail: this.registerDidFail,
      transactionDidCreate: this.transactionDidCreate,
    })
      .catch(this.registerDidFail)
  }

  private handleConfirmTakeOver = () => {
    Modal.confirm({
      title: 'Are you sure take over this address?',
      content: 'After take over, you can NOT use the account currently binding to this address anymore!',
      okText: 'Take over it',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: this.handleRegister,
    })
  }

  private transactionWillCreate = () => {
    if (this.isUnmounted) {
      return
    }
    this.setState({
      registerStatus: TRANSACTION_CREATION_STATUS.PENDING,
      registerStatusContent: 'Pending authorization',
    })
  }

  private transactionDidCreate = () => {
    if (this.isUnmounted) {
      return
    }
    this.setState({
      isCreatingTransaction: false,
    })
  }

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
    if (this.isUnmounted) {
      return
    }
    this.setState({
      registerStatus: TRANSACTION_CREATION_STATUS.FAILED,
      registerStatusContent: this.getRegisterErrorStr(err, code),
      isCreatingTransaction: false,
    })
  }

  private getRegisterErrorStr(err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) {
    switch (code) {
      case REGISTER_FAIL_CODE.OCCUPIED:
        return `Taken over.`
      case REGISTER_FAIL_CODE.UNKNOWN:
      default:
        if ((err as Error).message.includes('User denied transaction signature')) {
          return 'Transaction rejected.'
        }
        console.log(err, code)
        storeLogger.error('Unexpected register error:', err as Error)
        return 'Something went wrong, please retry.'
    }
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

          this.injectedProps.history.push('/profile')
          await sleep(50)
          message.success('You have successfully imported account and logged in!')

          await sleep(4000)
          message.info('You can now let others know you by proving yourself on social media!')
        } else {
          await sleep(50)
          message.success('Account imported successfully')
        }
      } catch (err) {
        if (this.isUnmounted) {
          return
        }

        if ((err as Error).message === 'Network not match') {
          message.error('You were trying to import an account not belongs to current network!')
          return
        }

        if ((err as Error).message.includes('Key already exists in the object store')) {
          message.info('You already have this account!')
          return
        }

        storeLogger.error(err)
        message.error('Something went wrong! Please retry.')
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
      storeLogger.error('Unexpected export user error:', err)
      if (this.isUnmounted) {
        return
      }

      this.setState({
        exportButtonContent: 'Export user fail, please retry.',
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

enum TRANSACTION_CREATION_STATUS {
  DEFAULT = 'default',
  CHECKING = 'checking',
  PENDING = 'pending',
  FAILED = 'failed',
}

const REGISTER_STATUS_ICON_TYPES = Object.freeze({
  [TRANSACTION_CREATION_STATUS.CHECKING]: STATUS_TYPE.LOADING,
  [TRANSACTION_CREATION_STATUS.PENDING]: STATUS_TYPE.LOADING,
  [TRANSACTION_CREATION_STATUS.FAILED]: STATUS_TYPE.ERROR,
  [REGISTER_STATUS.PENDING]: STATUS_TYPE.LOADING,
  [REGISTER_STATUS.IDENTITY_UPLOADING]: STATUS_TYPE.LOADING,
  [REGISTER_STATUS.IDENTITY_UPLOADED]: STATUS_TYPE.LOADING,
  [REGISTER_STATUS.DONE]: STATUS_TYPE.SUCCESS,
  [REGISTER_STATUS.TIMEOUT]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.TAKEOVERED]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.TRANSACTION_ERROR]: STATUS_TYPE.ERROR,
})

// typing
interface IProps extends RouteComponentProps<{}> { }

const defaultState: Readonly<IState> = {
  isCreatingTransaction: false,
  isImporting: false,
  isExporting: false,
  registerStatus: TRANSACTION_CREATION_STATUS.DEFAULT,
  registerStatusContent: undefined,
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
  registerStatus: TRANSACTION_CREATION_STATUS | REGISTER_STATUS
  registerStatusContent?: JSX.Element | string
  exportButtonContent?: string
}

export default Accounts
