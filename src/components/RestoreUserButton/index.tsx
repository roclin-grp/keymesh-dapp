import * as React from 'react'

import { RouteComponentProps, withRouter } from 'react-router'

import { Upload } from 'antd'
import StatusButton, { STATUS_TYPE } from '../StatusButton'
import { UploadFile } from 'antd/lib/upload/interface'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { UsersStore } from '../../stores/UsersStore'

import { sleep } from '../../utils'
import { storeLogger } from '../../utils/loggers'

@inject(mapStoreToProps)
@observer
class RestoreUserButton extends React.Component<IProps, IState> {
  public readonly state = defaultState
  private isUnmounted = false

  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>

  public componentWillUnmount() {
    this.isUnmounted = true
  }

  public render() {
    const { status } = this.state

    const isRestoringUser = status === RESTORE_USER_STATUS.PROCESSING
    const statusType = status == null ? undefined : RESTORE_STATUS_ICON_TYPE[status]
    const statusContent = status == null ? undefined : RESTORE_BUTTON_STATUS_CONTENT[status]
    const helpContent = status == null ? undefined : RESTORE_BUTTON_HELP_MESSAGES[status]

    return (
      <Upload
        action="/"
        beforeUpload={this.handleRestoreUser}
        accept=".json"
        disabled={isRestoringUser}
        showUploadList={false}
      >
        <StatusButton
          statusType={statusType}
          statusContent={statusContent}
          helpContent={helpContent}
          disabled={isRestoringUser}
          buttonProps={{ icon: 'upload', type: undefined, size: 'default' }}
        >
          Restore Account Backup
        </StatusButton>
      </Upload>
    )
  }

  private handleRestoreUser = (_: UploadFile, files: UploadFile[]) => {
    if (files.length === 0) {
      return false
    }

    this.setState({
      status: RESTORE_USER_STATUS.PROCESSING,
    })

    const file: File = files[0] as any
    const reader = new FileReader()
    reader.onload = async (oFREvent) => {
      try {
        const { usersStore, history } = this.injectedProps
        const user = await usersStore.importUser((oFREvent.target as any).result)
        if (this.isUnmounted) {
          return
        }

        this.setState(
          { status: RESTORE_USER_STATUS.SUCCESS },
          async () => {
            await sleep(1500)
            if (this.isUnmounted) {
              return
            }

            this.setState({ status: undefined })
          },
        )
        await usersStore.useUser(user)

        const { currentUserStore } = usersStore

        if (currentUserStore == null) {
          return
        }
        if (currentUserStore.gettingStartedQuests.totalCompletedCount === 4) {
          return
        }

        history.push('/getting-started')
      } catch (err) {
        if (this.isUnmounted) {
          return
        }

        if ((err as Error).message === 'Network not match') {
          this.setState({
            status: RESTORE_USER_STATUS.NETWORK_MISMATCH,
          })
          return
        }

        if ((err as Error).message.includes('Key already exists in the object store')) {
          this.setState({
            status: RESTORE_USER_STATUS.DUPLICATE,
          })
          return
        }

        storeLogger.error('Failed to restore user: ', err)
        this.setState({
          status: RESTORE_USER_STATUS.UNKNOWN_ERROR,
        })
      }
    }
    reader.readAsText(file)
    return false
  }
}

function mapStoreToProps({
  usersStore,
}: IStores) {
  return {
    usersStore,
  }
}

interface IProps extends RouteComponentProps<{}> {}

interface IInjectedProps {
  usersStore: UsersStore
}

interface IState {
  status?: RESTORE_USER_STATUS,
}

const defaultState: Readonly<IState> = {
  status: undefined,
}

export enum RESTORE_USER_STATUS {
  PROCESSING,
  SUCCESS,
  NETWORK_MISMATCH,
  DUPLICATE,
  UNKNOWN_ERROR,
}

const RESTORE_STATUS_ICON_TYPE = Object.freeze({
  [RESTORE_USER_STATUS.PROCESSING]: STATUS_TYPE.LOADING,
  [RESTORE_USER_STATUS.SUCCESS]: STATUS_TYPE.SUCCESS,
  [RESTORE_USER_STATUS.NETWORK_MISMATCH]: STATUS_TYPE.WARN,
  [RESTORE_USER_STATUS.DUPLICATE]: STATUS_TYPE.WARN,
  [RESTORE_USER_STATUS.UNKNOWN_ERROR]: STATUS_TYPE.ERROR,
})

const RESTORE_BUTTON_STATUS_CONTENT = Object.freeze({
  [RESTORE_USER_STATUS.PROCESSING]: 'Restoring...',
  [RESTORE_USER_STATUS.SUCCESS]: 'Backup restored!',
  [RESTORE_USER_STATUS.NETWORK_MISMATCH]: 'Network mismatch',
  [RESTORE_USER_STATUS.DUPLICATE]: 'Duplicate account',
  [RESTORE_USER_STATUS.UNKNOWN_ERROR]: 'Restore failed',
})

const RESTORE_BUTTON_HELP_MESSAGES = Object.freeze({
  [RESTORE_USER_STATUS.NETWORK_MISMATCH]: 'This account backup belongs to another network',
  [RESTORE_USER_STATUS.DUPLICATE]: 'This account already exists',
  [RESTORE_USER_STATUS.UNKNOWN_ERROR]: 'Sorry! you can retry later',
})

export default withRouter(RestoreUserButton)
