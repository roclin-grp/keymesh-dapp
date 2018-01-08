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
import { Store } from '../../store'

import {
  Steps,
  Icon,
} from 'antd'
import CommonHeaderPage from '../../containers/CommonHeaderPage'

import {
  getBEMClassNamesMaker
} from '../../utils'

import {
  TRUSTBASE_CONNECT_STATUS,
  REGISTER_FAIL_CODE,
  USER_STATUS,
} from '../../constants'

import './index.css'

interface Iparams {
  networkId: string
}

type Iprops = RouteComponentProps<Iparams>

interface IinjectedProps extends Iprops {
  store: Store
}

interface Istate {
  done: boolean
  error: IregisterError | null
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

@inject('store') @observer
class CheckRegister extends React.Component<Iprops, Istate> {
  public static readonly blockName = 'check-register'

  public readonly state = Object.freeze({
    done: false,
    error: null as IregisterError | null
  })

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(CheckRegister.blockName, this.props)

  private unmounted = false
  public componentDidMount() {
    const {
      store: {
        connectStatus,
        currentUser,
        checkRegister,
        listenForConnectStatusChange
      }
    } = this.injectedProps
    if (
      connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS
      && currentUser
      && currentUser.registerRecord
    ) {
      checkRegister(currentUser, {
        identityDidUpload: this.identityDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
    listenForConnectStatusChange(this.connectStatusListener)
  }
  public componentWillUnmount() {
    const {
      removeConnectStatusListener,
      clearRegisteringUser
    } = this.injectedProps.store
    this.unmounted = true
    clearRegisteringUser()
    removeConnectStatusListener(this.connectStatusListener)
  }
  public render() {
    const {
      currentUser,
      connectStatus,
      canConnectToIdentitesContract
    } = this.injectedProps.store
    const {
      done: isDone,
      error
    } = this.state
    const { getBEMClassNames } = this

    const isPending = connectStatus === TRUSTBASE_CONNECT_STATUS.PENDING
    if (!isPending && (!currentUser || (currentUser.status === USER_STATUS.OK || !canConnectToIdentitesContract))) {
      return <Redirect to="/" />
    }

    const hasError = error !== null

    const isIdentityUploaded = currentUser && currentUser.status === USER_STATUS.IDENTITY_UPLOADED

    return (
      <CommonHeaderPage prefixClass={CheckRegister.blockName} className={getBEMClassNames()}>
        {
          currentUser
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
      currentUser,
      uploadPreKeys
    } = this.injectedProps.store
    if (!currentUser) {
      return
    }
    uploadPreKeys(currentUser, undefined, undefined, {
      preKeysDidUpload: this.preKeysDidUpload,
      preKeysUploadDidFail: this.preKeysUploadDidFail
    }).catch(this.preKeysUploadDidFail)
  }

  private preKeysDidUpload = () => {
    if (this.unmounted) {
      return
    }
    this.setState({
      done: true
    })
    const {
      currentUser,
      updateUserStatusToOk
    } = this.injectedProps.store
    if (!currentUser) {
      return
    }
    window.setTimeout(
      () => {
        updateUserStatusToOk(currentUser)
      },
      5000
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
  private connectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => {
    const {
      store: {
        checkRegister,
        currentUser
      },
    } = this.injectedProps
    if (this.unmounted) {
      return
    }
    if (
      prev !== TRUSTBASE_CONNECT_STATUS.SUCCESS
      && cur === TRUSTBASE_CONNECT_STATUS.SUCCESS
      && currentUser
      && currentUser.registerRecord
    ) {
      checkRegister(currentUser, {
        identityDidUpload: this.identityDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
  }
}

export default withRouter(CheckRegister)
