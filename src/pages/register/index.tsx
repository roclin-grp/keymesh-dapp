import * as React from 'react'
import { RouteComponentProps } from 'react-router-dom'

import securedAccountImg from './secured-account.svg'

// component
import {
  Divider,
  Icon,
  Upload,
  Modal,
  message,
  Button,
  Tooltip,
  Alert,
} from 'antd'
import { UploadFile } from 'antd/lib/upload/interface.d'
import UserAddress from '../../components/UserAddress'
import StatusButton, { STATUS_TYPE } from '../../components/StatusButton'

// style
import * as classes from './index.css'
import composeClass from 'classnames'

// state management
import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { UsersStore, REGISTER_FAIL_CODE } from '../../stores/UsersStore'
import { UserStore, USER_STATUS } from '../../stores/UserStore'

// helper
import { storeLogger } from '../../utils/loggers'
import { sleep } from '../../utils'
import { Lambda } from 'mobx'
import AccountRegisterStatus, { REGISTER_STATUS } from '../../components/AccountRegisterStatus'

@inject(mapStoreToProps)
@observer
class Register extends React.Component<IProps, IState> {
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
      walletCorrespondingUserStore,
    } = usersStore
    const currentEthereumAccount = metaMaskStore.currentEthereumAccount!

    return (
      <div className="page-container">
        <Alert
          className={classes.ethPrompt}
          closable={true}
          message={<h3>Do you need some Rinkeby test tokens?</h3>}
          description={
            <>
              <p>
                The KeyMesh BETA runs on the Rinkeby Test Network, so you can’t use real $ETH to pay for transactions.
              </p>
              <p>
                You can get free tokens from {' '}
                <a href="https://faucet.rinkeby.io" target="_blank">
                  https://faucet.rinkeby.io
                </a>
              </p>
            </>
          }
          type="info"
        />
        <section className={composeClass(classes.signupSection, 'block')}>
          <h2 className="title">
            Power Up Your Ethereum Address
          </h2>
          <img className={classes.securedAccountImg} src={securedAccountImg} />
          <p className="description">
            You will create a new cryptographic identity for secure communication, and publish it on the blockchain
          </p>
          <h3>Your Ethereum Address</h3>
          <UserAddress className={classes.userAddress} address={currentEthereumAccount} />
          {this.renderRegisterStatusButton(
            usersStore, hasRegisterRecordOnLocal, hasRegisterRecordOnChain, walletCorrespondingUserStore,
          )}
          <Divider />
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
        </section>
      </div>
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
      hasRegisterRecordOnLocal,
      hasRegisterRecordOnChain,
      isCheckingRegisterRecord,
      walletCorrespondingUserStore,
    )

    return (
      <StatusButton
        buttonClassName={classes.registerButton}
        disabled={shouldDisableButton}
        statusType={statusType}
        statusContent={statusContent}
        onClick={handleClick}
      >
        Sign Up With MetaMask
      </StatusButton>
    )
  }

  private getStatusTypeAndContent(
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
    isCheckingRegisterRecord: boolean,
    walletCorrespondingUserStore?: UserStore,
  ): [STATUS_TYPE, React.ReactNode | undefined] {

    if (isCheckingRegisterRecord) {
      const type = STATUS_TYPE.LOADING
      const content = (
        <>
          Checking...
          <Tooltip title="Checking if address is registered">
            <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
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
      let content: JSX.Element | string = 'Registered'
      if (!walletCorrespondingUserStore.isUsing) {
        content = (
          <>
            {content}
            <a
              className={classes.signInButton}
              onClick={() => walletCorrespondingUserStore.useUser()}
            >
              Sign In
            </a>
          </>
        )
      }
      return [type, content]
    }

    const { registerStatus, registerStatusContent } = this.state
    const statusType = REGISTER_STATUS_ICON_TYPES[registerStatus]
    let statusContent = registerStatusContent

    if (
      statusContent == null &&
      !hasRegisterRecordOnLocal &&
      hasRegisterRecordOnChain
    ) {
      const type = STATUS_TYPE.WARN
      const content = (
        <>
          Registered on another device
          <Tooltip title="You can register anyway, or restore the account backup from your other device">
            <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
          </Tooltip>
        </>
      )

      return [type, content]
    }

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

    await usersStore.useUser(users[users.length - 1])

    if (users.length === 1) {
      this.props.history.push('/getting-started')
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
      iconType: 'warning',
      // title: 'Are you sure take over this address?',
      content: 'If you take over this address, your account on the other device will stop working.',
      okText: 'Take Over',
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
        storeLogger.error('Unexpected register error:', err as Error)
        return 'Something went wrong, please retry.'
    }
  }

  // TODO: tranform import button to status button
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
  [TRANSACTION_CREATION_STATUS.FAILED]: STATUS_TYPE.WARN,
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
  registerStatus: TRANSACTION_CREATION_STATUS | REGISTER_STATUS
  registerStatusContent?: JSX.Element | string
  exportButtonContent?: string
}

export default Register
