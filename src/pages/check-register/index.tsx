import * as React from 'react'
import {
  Redirect,
  Link,
  RouteComponentProps,
} from 'react-router-dom'

// component
import {
  Steps,
  Icon,
} from 'antd'

// style
import './index.css'

// state management
import {
  inject,
  observer,
} from 'mobx-react'
import {
  IStores,
} from '../../stores'
import {
  EthereumStore,
} from '../../stores/EthereumStore'
import {
  UsersStore,
  REGISTER_FAIL_CODE,
} from '../../stores/UsersStore'
import {
  USER_STATUS,
} from '../../stores/UserStore'

// helper
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

@inject(({
  ethereumStore,
  usersStore
}: IStores) => ({
  ethereumStore,
  usersStore
}))
@observer
class CheckRegister extends React.Component<IProps, IState> {
  public static readonly blockName = 'check-register'

  public readonly state = Object.freeze({
    done: false,
    error: null as IRegisterError | null,
    shouldPreventRedirect: false
  })

  private readonly injectedProps = this.props as Readonly<IInjectedProps>

  private readonly getBEMClassNames = getBEMClassNamesMaker(CheckRegister.blockName, this.props)

  private unmounted = false

  public componentDidMount() {
    const {
      currentUserStore
    } = this.injectedProps.usersStore

    if (!currentUserStore!.isRegisterCompleted) {
      currentUserStore!.checkIdentityUploadStatus({
        identityDidUpload: this.identityDidUpload,
        registerDidFail: this.registerDidFail
      }).catch(this.registerDidFail)
    }
  }

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    const {
      currentUserStore
    } = this.injectedProps.usersStore
    const {
      done: isDone,
      error,
      shouldPreventRedirect,
    } = this.state

    if (currentUserStore!.isRegisterCompleted && !shouldPreventRedirect) {
      return <Redirect to="/" />
    }

    const { getBEMClassNames } = this
    const hasError = error !== null
    const user = currentUserStore!.user
    const isIdentityUploaded = user.status !== USER_STATUS.PENDING

    return (
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
              {(error as IRegisterError).message}
            </>
            )
            : null
        }
      </>
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
    // await this.injectedProps.usersStore.currentUserStore!.updateUserStatusToOK()
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
      default:
        type = REGISTER_ERROR_TYPE.UNEXCEPTED
        message = (
          <p className="center">Something has gone wrong, you can {refreshThePage} to retry.</p>
        )
    }
    this.setState({
      error: {
        type,
        message
      }
    })
  }
}

const refreshThePage = <Link replace={true} to="/check-register">click here</Link>

// constant
enum REGISTER_PROGRESS {
  CONFIRMATION = 1,
  UPLOAD_PRE_KEYS,
  DONE
}

enum REGISTER_ERROR_TYPE {
  UNEXCEPTED = 0,
  OCCUPIED,
  TIMEOUT,
  UPLOAD_PRE_KEYS_ERROR
}

// typing
type IProps = RouteComponentProps<{}>

interface IInjectedProps extends IProps {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface IState {
  done: boolean
  error: IRegisterError | null
  shouldPreventRedirect: boolean
}

interface IRegisterError {
  type: REGISTER_ERROR_TYPE
  message: string | React.ReactNode
}

export default CheckRegister
