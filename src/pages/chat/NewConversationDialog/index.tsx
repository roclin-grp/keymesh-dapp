import * as React from 'react'

// component
import { Link } from 'react-router-dom'
import { Input, Icon, message, List } from 'antd'
import UserAvatar from '../../../components/UserAvatar'
import Username from '../../../components/Username'

// style
import * as classes from './index.css'
import composeClass from 'classnames'

// state management
import { IUser } from '../../../stores/UserStore'
import { SessionsStore } from '../../../stores/SessionsStore'
import { IProcessedUserInfo, searchUserByAddress, searchUser } from '../../../stores/UserCachesStore'

// helper
import debounce from 'lodash.debounce'
import { isAddress } from '../../../utils/cryptos'
import { storeLogger } from '../../../utils/loggers'

class NewConversationDialog extends React.Component<IProps, IState> {
  public readonly state: Readonly<IState> = {
    users: [],
    inputValue: '',
    isTyping: false,
  }

  private userAddressInput: Input | null = null
  private unmounted = false

  public componentWillUnmount() {
    this.unmounted = true
  }

  public render() {
    return (
      <div className={classes.dialog}>
        <Input
          autoFocus={true}
          className={classes.searchInputWrapper}
          spellCheck={false}
          placeholder="Ethereum address or Twitter handle"
          prefix={<Icon type="search" className={classes.prefixIcon} />}
          suffix={this.renderResetUserAddress()}
          value={this.state.inputValue}
          onChange={this.handleChanged}
          onPressEnter={this.handleSelectFirstUser}
          ref={(node) => this.userAddressInput = node}
        />
        {this.renderUsers()}
      </div>
    )
  }

  private renderResetUserAddress() {
    if (this.state.inputValue === '') {
      return null
    }

    return (
      <a onClick={this.resetUserAddress} className={classes.resetUserAddress}>
        <Icon type="close-circle" onClick={this.resetUserAddress} />
      </a>
    )
  }

  private renderUsers() {
    const { users, searchText, inputValue, isTyping } = this.state

    if (inputValue === '') {
      return (
        <>
          {/* <p className={classes.recommandationText}>Feeling lonely around here? Say hi to us :)</p>
          {this.renderUser({
            userAddress: '0x861551981a6Ec84FD70c421fDfA759B148a11Be7',
            displayUsername: 'KeyMesh',
            description: 'The KeyMesh Team',
            verifications: [
              {
                platformName: 'twitter',
                username: 'KeyMesh',
              },
              {
                platformName: 'facebook',
                username: 'realKeyMesh',
              },
            ],
          })} */}
        </>
      )
    }

    if (searchText != null || isTyping) {
      return (
        <div className={composeClass(classes.loading, 'vertical-align-container')}>
          <Icon className={classes.loadingIcon} type="loading" />
          Searching...
        </div>
      )
    }

    if (inputValue === this.props.user.userAddress) {
      return (
        <p className={classes.helpText}>
          Can't send message to yourself.
        </p>
      )
    }

    if (isAddress(inputValue) && users.length === 0) {
      return (
        <p className={classes.helpText}>
          Sorry, we can't find anyone matching this address.
        </p>
      )
    }

    if (users.length === 0) {
      return (
        <p className={classes.helpText}>
          Sorry, we can't find anyone matching this name.
        </p>
      )
    }

    return (
      <List
        dataSource={users}
        renderItem={this.renderUser}
      >
      </List>
    )
  }

  private renderUser = (userInfo: IProcessedUserInfo) => {
    const { userAddress } = userInfo
    return (
      <div
        key={userAddress}
        className={classes.userItemContainer}
        role="button"
        onClick={() => this.handleSelectUser(userInfo)}
      >
        <List.Item>
          <List.Item.Meta
            avatar={
              <Link to={`/profile/${userAddress}`} onClick={(e) => e.stopPropagation()}>
                <UserAvatar
                  userAddress={userAddress}
                  userInfo={userInfo}
                  className={classes.userItemAvatar}
                />}
              </Link>
            }
            title={<Username userAddress={userAddress} userInfo={userInfo} showAllUsernames={true} />}
            description={userInfo.description}
          />
        </List.Item>
      </div>
    )
  }

  private handleChanged: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const { value } = event.target

    this.setState(
      {
        inputValue: value,
        isTyping: true,
      },
      () => {
        this.handleSearchDebounced()
      },
    )
  }

  private handleSearch = async () => {
    this.setState({ isTyping: false })

    const { inputValue } = this.state
    if (inputValue === '' || inputValue === this.props.user.userAddress) {
      this.setState({
        searchText: undefined,
        users: [],
      })
      return
    }

    this.setState({
      searchText: inputValue,
    })

    const { networkId } = this.props.user
    if (isAddress(inputValue)) {
      try {
        await this.props.sessionsStore.validateReceiver(inputValue)

        this.setResultUsers([{ userAddress: inputValue, verifications: [] }], inputValue)

        const userInfo = await searchUserByAddress(networkId, inputValue)
        if (userInfo == null) {
          return
        }
        this.setResultUsers([userInfo], inputValue)
      } catch (err) {
        this.setResultUsers([], inputValue)
        return
      }
    }

    const searchUserInfos = await searchUser(networkId, inputValue)
    const { userAddress } = this.props.user
    const excludedSelfUserInfos = searchUserInfos.filter((info) => info.userAddress !== userAddress)
    this.setResultUsers(excludedSelfUserInfos, inputValue)
  }
  // tslint:disable-next-line member-ordering
  private handleSearchDebounced = debounce(this.handleSearch, 300)

  private setResultUsers(result: IProcessedUserInfo[], inputValue: string) {
    // make sure we still need this result
    if (this.state.searchText !== inputValue) {
      return
    }

    this.setState({
      searchText: undefined,
      users: result,
    })
  }

  private handleSelectUser = async (userData: IProcessedUserInfo) => {
    const { tryCreateNewConversation } = this.props
    try {
      await tryCreateNewConversation(userData.userAddress, true)
    } catch (err) {
      this.handCreateFail(err)
    }
  }

  private handleSelectFirstUser = async () => {
    const { users } = this.state
    if (users.length === 0) {
      return
    }

    this.handleSelectUser(users[0])
  }

  private handCreateFail(err: Error) {
    if (this.unmounted) {
      return
    }

    // TODO: show error detail
    storeLogger.error(err)
    message.error('Create session fail, please retry')
  }

  private resetUserAddress = () => {
    this.setState({
      inputValue: '',
      users: [],
    })
    const { userAddressInput } = this
    if (userAddressInput != null) {
      userAddressInput.focus()
    }
  }
}

interface IProps {
  user: IUser
  sessionsStore: SessionsStore
  tryCreateNewConversation: (receiverAddress: string, skipCheck?: boolean) => void
}

interface IState {
  inputValue: string
  searchText?: string
  users: IProcessedUserInfo[]
  isTyping: boolean
}

export default NewConversationDialog
