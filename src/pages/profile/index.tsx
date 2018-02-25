import * as React from 'react'

import {
  RouteComponentProps,
  Redirect,
} from 'react-router-dom'

import ProfileContent from './Content'

import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { UserProofsStatesStore } from '../../stores/UserProofsStatesStore'

import { isAddress, base58ToChecksumAddress } from '../../utils/cryptos'

@inject(mapStoreToProps)
@observer
class Profile extends React.Component<IProps & RouteComponentProps<IParams>> {
  public render() {
    if (!this.props.isValidAddress) {
      return <p>Not Found</p>
    }
    if (this.props.shouldRedirect) {
      return <Redirect to={`/profile/${this.props.userAddress}`} />
    }

    const {
      userProofsStatesStore,
      userAddress,
      isSelf,
    } = this.props

    return (
      <ProfileContent
        proofsStateStore={userProofsStatesStore.getUserProofsStateStore(userAddress)}
        userAddress={userAddress}
        isSelf={isSelf}
      />
    )
  }
}

function mapStoreToProps(stores: IStores, ownProps: IProps & RouteComponentProps<IParams>): IProps {
  const {
    usersStore,
    metaMaskStore,
  } = stores
  const possibleBase58EncodedUserAddress = ownProps.match.params.userAddress

  const hasAddress = possibleBase58EncodedUserAddress != null
  const userAddress = (
    hasAddress
    ? getDecodedUserAddress(possibleBase58EncodedUserAddress!)
    : usersStore.currentUserStore!.user.userAddress
  )

  const isValidAddress = isAddress(userAddress)
  const shouldRedirect = hasAddress && userAddress !== possibleBase58EncodedUserAddress
  const isSelf = isValidAddress && usersStore.isCurrentUser(
    metaMaskStore.currentEthereumNetwork!,
    userAddress,
  )

  return {
    userProofsStatesStore: usersStore.userProofsStatesStore,
    userAddress,
    shouldRedirect,
    isValidAddress,
    isSelf,
  }
}

function getDecodedUserAddress(possibleBase58EncodedUserAddress: string): string {
  if (isAddress(possibleBase58EncodedUserAddress)) {
    return possibleBase58EncodedUserAddress
  }

  try {
    return base58ToChecksumAddress(possibleBase58EncodedUserAddress)
  } catch (_) {
    // decode fail
    return possibleBase58EncodedUserAddress
  }
}

interface IParams {
  userAddress?: string
}

interface IProps {
  userProofsStatesStore: UserProofsStatesStore
  userAddress: string
  shouldRedirect: boolean
  isValidAddress: boolean
  isSelf: boolean
}

export default Profile
