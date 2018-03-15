import * as React from 'react'

import { RouteComponentProps } from 'react-router-dom'
import ProfileCard from './ProfileCard'
import NotFound from '../NotFound'
import LoadingPage from '../LoadingPage'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'

import ProfileData from './data'
import { IProcessedUserInfo } from '../../stores/UserCachesStore'
import { UserProofsStatesStore } from '../../stores/UserProofsStatesStore'
import { UsersStore } from '../../stores/UsersStore'
import { UserStore } from '../../stores/UserStore'

@inject(mapStoreToProps)
@observer
class Profile extends React.Component<IProps> {
  private readonly injectedProps = this.props as Readonly<IProps & IInjectedProps>

  public componentWillUnmount() {
    this.injectedProps.data.disposeData()
    this.injectedProps.userProofsStatesStore.clearCachedStores()
  }

  public render() {
    const { userAddress, twitterUsername } = this.injectedProps.match.params
    const { data, usersStore } = this.injectedProps
    const { currentUserStore } = usersStore
    const noParams = twitterUsername == null && userAddress == null
    const isSelf = noParams || currentUserStore != null && currentUserStore.user.userAddress === userAddress
    const { isLoading } = data
    if (isLoading) {
      return <LoadingPage message={isSelf ? 'Loading data...' : 'Finding user...'} />
    }

    const { userInfos } = data
    if (userInfos.length === 0) {
      return <NotFound message="User not found" />
    }

    return (
      <div className={'page-container'}>
        {this.renderUserCards(userInfos, isSelf, currentUserStore)}
      </div>
    )
  }

  private renderUserCards(userInfos: IProcessedUserInfo[], isSelf: boolean, currentUserStore?: UserStore) {
    const cards: JSX.Element[] = []

    const { userProofsStatesStore } = this.injectedProps
    let isFrist = true
    for (const userInfo of userInfos) {
      const proofsStateStore = userProofsStatesStore.getUserProofsStateStore(userInfo.userAddress)
      cards.push((
        <ProfileCard
          key={`${userInfo.userAddress}${userInfo.displayUsername}`}
          isFirstCard={isFrist}
          userInfo={userInfo}
          isSelf={isSelf}
          currentUserStore={currentUserStore}
          proofsStateStore={proofsStateStore}
        />
      ))

      if (isFrist) {
        isFrist = false
      }
    }

    return cards
  }
}

function mapStoreToProps(stores: IStores, ownProps: IProps & RouteComponentProps<IParams>): IInjectedProps {
  const {
    usersStore,
    metaMaskStore,
  } = stores
  const { userAddress, twitterUsername } = ownProps.match.params
  return {
    data: new ProfileData(usersStore, metaMaskStore, twitterUsername, userAddress),
    usersStore,
    userProofsStatesStore: usersStore.userProofsStatesStore,
  }
}

interface IParams {
  userAddress?: string
  twitterUsername?: string
}

interface IProps extends RouteComponentProps<IParams> {
}

interface IInjectedProps {
  data: ProfileData
  usersStore: UsersStore,
  userProofsStatesStore: UserProofsStatesStore
}

export default Profile
