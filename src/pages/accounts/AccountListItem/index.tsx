import * as React from 'react'
import { Link, withRouter, RouteComponentProps } from 'react-router-dom'

// component
import { List, Button, Popconfirm, Icon } from 'antd'
import HashAvatar from '../../../components/HashAvatar'
import AccountRegisterStatus, { REGISTER_STATUS } from '../AccountRegisterStatus'

// style
import classnames from 'classnames'
import * as classes from './index.css'

// state management
import { UserStore } from '../../../stores/UserStore'

class AccountListItem extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    isDeleting: false,
    status: REGISTER_STATUS.PENDING,
  }

  private retryCheckStatus: (() => void) | undefined
  private isUnmounted = false
  public componentWillUnmount() {
    this.isUnmounted = true
  }

  public render() {
    const { avatarHash, user, isUsing } = this.props.userStore

    return (
      <List.Item
        className={classes.container}
        actions={this.renderActions()}
      >
        <List.Item.Meta
          avatar={<HashAvatar
            shape="circle"
            hash={avatarHash}
          />}
          title={
            <Link to={`/profile${isUsing ? '' : `/${user.userAddress}`}`}>
              {user.userAddress}
            </Link>}
        />
        <div className={classes.listContent}>
          {this.renderListContent()}
        </div>
      </List.Item>
    )
  }

  private renderActions() {
    const { user, isUsing, isCurrentWalletCorrespondingUser, isRegisterCompleted } = this.props.userStore
    const { status, isDeleting } = this.state

    if (!isRegisterCompleted) {
      return []
    }

    const deleteButton = (
      <Popconfirm
        title="Are you sure delete this account?"
        onConfirm={this.handleDeleteUser}
        okText="Delete"
        okType="danger"
      >
        <Button
          key={`delete-${user.userAddress}`}
          loading={isDeleting}
          type="danger"
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </Popconfirm>
    )

    switch (status) {
      case REGISTER_STATUS.DONE:
        if (isUsing) {
          return [
            deleteButton,
          ]
        }

        return [
          <Button
            key={`sign-in-${user.userAddress}`}
            type="primary"
            onClick={this.handleSwitchUser}
          >
            Sign In
          </Button>,
          deleteButton,
        ]
      case REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL:
      case REGISTER_STATUS.UNEXCEPTED_ERROR:
        if (isCurrentWalletCorrespondingUser) {
          return [
            deleteButton,
          ]
        }

        return [
          <Button
            key={`retry-${user.userAddress}`}
            type="primary"
            onClick={this.retryCheckStatus}
          >
            Retry
          </Button>,
          deleteButton,
        ]
      case REGISTER_STATUS.TRANSACTION_ERROR:
      default:
        return [
          deleteButton,
        ]
    }
  }

  private renderListContent() {
    const { userStore } = this.props
    const { isUsing, isCurrentWalletCorrespondingUser } = userStore
    if (isCurrentWalletCorrespondingUser && (isUsing || !userStore.isRegisterCompleted)) {
      return null
    }

    if (isUsing) {
      return 'Current'
    }

    const { status } = this.state
    return (
      <>
        <Icon
          className={classnames(classes.statusIcon, REGISTER_STATUS_ICON_MODIFIERS[status])}
          type={REGISTER_STATUS_ICON_TYPES[status]}
        />
        <AccountRegisterStatus
          userStore={userStore}
          onStatusChanged={this.handleStatusChanged}
          getRetry={this.getCheckStatusRetry}
        />
      </>
    )
  }

  private getCheckStatusRetry = (retry: () => void) => {
    this.retryCheckStatus = retry
  }

  private handleStatusChanged = (status: REGISTER_STATUS) => {
    if (this.isUnmounted) {
      return
    }

    this.setState({
      status,
    })
  }

  private handleDeleteUser = async () => {
    this.setState({
      isDeleting: true,
    })

    await this.props.userStore.deleteUser()

    if (this.isUnmounted) {
      return
    }

    this.setState({
      isDeleting: false,
    })
  }

  private handleSwitchUser = () => {
    this.props.userStore.useUser()
  }
}

const REGISTER_STATUS_ICON_TYPES = Object.freeze({
  [REGISTER_STATUS.PENDING]: 'loading',
  [REGISTER_STATUS.IDENTITY_UPLOADING]: 'loading',
  [REGISTER_STATUS.IDENTITY_UPLOADED]: 'loading',
  [REGISTER_STATUS.TIMEOUT]: 'exclamation-circle',
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: 'exclamation-circle',
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: 'exclamation-circle',
  [REGISTER_STATUS.TAKEOVERED]: 'exclamation-circle',
  [REGISTER_STATUS.TRANSACTION_ERROR]: 'close-circle',
})

const REGISTER_STATUS_ICON_MODIFIERS = Object.freeze({
  [REGISTER_STATUS.TIMEOUT]: classes.warn,
  [REGISTER_STATUS.UNEXCEPTED_ERROR]: classes.warn,
  [REGISTER_STATUS.UPLOAD_PRE_KEYS_FAIL]: classes.warn,
  [REGISTER_STATUS.TAKEOVERED]: classes.warn,
  [REGISTER_STATUS.TRANSACTION_ERROR]: classes.error,
})

// typing
interface IProps extends RouteComponentProps<{}> {
  userStore: UserStore
  className?: string
}

interface IState {
  status: REGISTER_STATUS
  isDeleting: boolean
}

export default withRouter(AccountListItem)
