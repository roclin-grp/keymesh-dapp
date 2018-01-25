import * as React from 'react'
import {
  withRouter,
  Redirect,
  Link,
  RouteComponentProps,
} from 'react-router-dom'

import {
  inject,
  observer,
} from 'mobx-react'

import {
  EthereumStore,
  UsersStore,
  Istores,
} from '../../stores'

import {
  Steps,
  Icon,
} from 'antd'
import CommonHeaderPage from '../../containers/CommonHeaderPage'

import {
  getBEMClassNamesMaker,
  noop,
} from '../../utils'

import {
  ETHEREUM_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  USER_STATUS,
} from '../../constants'

import './index.css'

interface Iparams {
  networkId: string
}

type Iprops = RouteComponentProps<Iparams>

interface IinjectedProps extends Iprops {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  done: boolean
  error: IregisterError | null
  shouldPreventRedirect: boolean
}

enum REGISTER_PROGRESS {
  CONFIRMATION = 1,
  UPLOAD_PRE_KEYS,
  DONE
}

interface IregisterError {
  type: REGISTER_ERROR_TYPE
  message: string | React.ReactNode
}

enum REGISTER_ERROR_TYPE {
  UNEXCEPTED = 0,
  OCCUPIED,
  TIMEOUT,
  UPLOAD_PRE_KEYS_ERROR
}

const refreshThePage = <Link replace={true} to="/check-register">click here</Link>

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class CheckRegister extends React.Component<Iprops, Istate> {
  public static readonly blockName = 'check-register'

  public readonly state = Object.freeze({
    done: false,
    error: null as IregisterError | null,
    shouldPreventRedirect: false
  })

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(CheckRegister.blockName, this.props)

  private removeEthereumConnectStatusChangeListener = noop
  private unmounted = false
  public componentDidMount() {
    const {
      ethereumStore: {
        ethereumConnectStatus,
        listenForEthereumConnectStatusChange
      },
      usersStore: {
        currentUserStore,
        hasUser,
      },
    } = this.injectedProps
    const user = hasUser ? currentUserStore!.user : undefined
    if (
      ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.SUCCESS
      && hasUser
      && user!.registerRecord
    ) {
      currentUserStore!.checkIdentityUploadStatus({
        identityDidUpload: this.identityDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
    this.removeEthereumConnectStatusChangeListener = listenForEthereumConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    this.unmounted = true
    this.removeEthereumConnectStatusChangeListener()
  }
  public render() {
    const {
      ethereumStore: {
        ethereumConnectStatus,
      },
      usersStore: {
        currentUserStore,
        hasUser
      },
    } = this.injectedProps
    const user = hasUser ? currentUserStore!.user : undefined
    const {
      done: isDone,
      error,
      shouldPreventRedirect
    } = this.state
    const { getBEMClassNames } = this

    const isPending = ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.PENDING
    if (!shouldPreventRedirect && !isPending && (!hasUser || (user!.status === USER_STATUS.OK))) {
      return <Redirect to="/" />
    }

    const hasError = error !== null

    const isIdentityUploaded = hasUser && user!.status !== USER_STATUS.PENDING

    return (
      <CommonHeaderPage prefixClass={CheckRegister.blockName} className={getBEMClassNames()}>
        {
          hasUser
          ? (
            <>
              <h2 className={getBEMClassNames('title', {}, { title: true })}>
                Register progress
              </h2>
              <div className={getBEMClassNames('progress', {}, { container: true })}>
                <Steps
                  status={hasError ? 'error' : undefined}
                  current={
                    isIdentityUploaded
                      ? (isDone ? REGISTER_PROGRESS.DONE : REGISTER_PROGRESS.UPLOAD_PRE_KEYS)
                      : REGISTER_PROGRESS.CONFIRMATION
                  }
                >
                  <Steps.Step
                    status="finish"
                    title="Submit"
                    icon={<Icon type="user-add" />}
                  />
                  <Steps.Step
                    title="Confirmation"
                    description="1~5 mins"
                    icon={<Icon type={isIdentityUploaded || hasError ? 'solution' : 'loading'} />}
                  />
                  <Steps.Step
                    title="Upload keys"
                    description="1~5 secs"
                    icon={
                      <Icon
                        type={
                          isIdentityUploaded && !isDone && !hasError
                            ? 'loading'
                            : 'cloud-upload'
                          }
                      />
                    }
                  />
                  <Steps.Step title="Done" icon={<Icon type="smile-o" />} />
                </Steps>
              </div>
              {
                isDone
                ? (
                  <>
                    <Icon type="check-circle" className={getBEMClassNames('result-icon', { success: true })}/>
                    <h3 className={getBEMClassNames('subtitle')}>
                      Reigster completed!
                    </h3>
                    <p className="center">
                      please <Link to="/">click here</Link> if you are not redirected in a few seconds
                    </p>
                  </>
                )
                : hasError
                  ? (
                    <>
                    <Icon type="close-circle-o" className={getBEMClassNames('result-icon', { error: true })} />
                    <h3 className={getBEMClassNames('subtitle')}>
                      Oops! Something has gone wrong!
                    </h3>
                    {(error as IregisterError).message}
                  </>
                  )
                  : null
              }
            </>
          )
          : null
        }
      </CommonHeaderPage>
    )
  }

  private identityDidUpload = () => {
    if (this.unmounted) {
      return
    }
    const {
      uploadPreKeys
    } = this.injectedProps.usersStore.currentUserStore!

    uploadPreKeys({
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail
    }).catch(this.preKeysUploadDidFail)
  }

  private preKeysDidUpload = async () => {
    if (this.unmounted) {
      return
    }

    this.setState({
      done: true,
      shouldPreventRedirect: true
    })
    await this.injectedProps.usersStore.currentUserStore!.updateUserStatusToOK()
    window.setTimeout(
      () => {
        if (this.unmounted) {
          return
        }

        this.setState({
          shouldPreventRedirect: false
        })
      },
      3000
    )
  }

  private preKeysUploadDidFail = (err: Error) => {
    if (this.unmounted) {
      return
    }
    this.setState({
      error: {
        type: REGISTER_ERROR_TYPE.UPLOAD_PRE_KEYS_ERROR,
        message: (
          <p className="center">
            Can not upload your public keys to our server, please check your internet connection, and
            {refreshThePage}
            to retry
          </p>
        )
      }
    })
  }

  private registerDidFail = (err: Error | null, code = REGISTER_FAIL_CODE.UNKNOWN) => {
    if (this.unmounted) {
      return
    }
    let type = REGISTER_ERROR_TYPE.UNEXCEPTED
    let message: string | React.ReactNode
    switch (code) {
      case REGISTER_FAIL_CODE.OCCUPIED:
        type = REGISTER_ERROR_TYPE.OCCUPIED
        message = (
          <>
            <p className="center">User address already registered.</p>
            <p className="center">
              Please <Link to="/">click here</Link> if you are not redirected in a few seconds
            </p>
          </>
        )
        break
      case REGISTER_FAIL_CODE.TIMEOUT:
        type = REGISTER_ERROR_TYPE.UNEXCEPTED
        message = (
          <p className="center">
            Transaction was not mined within 50 blocks, you can
            {refreshThePage}
            to retry.
          </p>
        )
        break
      case REGISTER_FAIL_CODE.UNKNOWN:
      // tslint:disable-next-line no-switch-case-fall-through
      default:
        type = REGISTER_ERROR_TYPE.UNEXCEPTED
        message = (
          <p className="center">Something has gone wrong, you can {refreshThePage} to retry.</p>
        )
    }
    if (type === REGISTER_ERROR_TYPE.OCCUPIED) {
      window.setTimeout(
        () => {
          if (this.unmounted) {
            return
          }
          if (this.injectedProps.location.pathname === '/check-register') {
            this.injectedProps.history.replace('/')
          }
        },
        5000
      )
    }
    this.setState({
      error: {
        type,
        message
      }
    })
  }
  private connectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => {
    const {
      usersStore: {
        currentUserStore,
        hasUser
      },
    } = this.injectedProps
    if (this.unmounted) {
      return
    }
    if (
      prev !== ETHEREUM_CONNECT_STATUS.SUCCESS
      && cur === ETHEREUM_CONNECT_STATUS.SUCCESS
      && hasUser
      && currentUserStore!.user.registerRecord
    ) {
      currentUserStore!.checkIdentityUploadStatus({
        identityDidUpload: this.identityDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
  }
}

export default withRouter(CheckRegister)
