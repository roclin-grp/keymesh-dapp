import * as React from 'react'

import { Link } from 'react-router-dom'

import { Icon } from 'antd'
import VerifiedItem from './VerifiedItem'
import HashAvatar from '../../components/HashAvatar'

import * as classes from './Content.css'
import * as commonClasses from './index.css'
import classnames from 'classnames'

import { observer } from 'mobx-react'
import { UserProofsStateStore } from '../../stores/UserProofsStateStore'
import { PLATFORMS, PLATFORM_LABELS } from '../../stores/BoundSocialsStore'

@observer
class ProfileContent extends React.Component<IProps> {
  public componentDidMount() {
    this.proofsStateStoreDidLoad(this.props.proofsStateStore)
  }

  public componentWillUnmount() {
    this.proofsStateStoreWillUnload(this.props.proofsStateStore)
  }

  public componentWillUpdate({proofsStateStore: nextProofsStateStore}: IProps) {
    const currentProofsStateStore = this.props.proofsStateStore
    if (nextProofsStateStore !== currentProofsStateStore) {
      this.proofsStateStoreWillUnload(currentProofsStateStore!)
    }
  }

  public componentDidUpdate({proofsStateStore: prevProofsStateStore}: IProps) {
    const currentProofsStateStore = this.props.proofsStateStore
    if (prevProofsStateStore !== currentProofsStateStore) {
      this.proofsStateStoreDidLoad(currentProofsStateStore!)
    }
  }

  public render() {
    return (
      <div className={classnames(classes.container, 'page-content')}>
        <HashAvatar
          className={classes.userAvatar}
          shape="circle"
          size="large"
          picSize={64}
          hash={this.props.proofsStateStore.avatarHash}
        />
        {this.renderVerifications()}
      </div>
    )
  }

  private renderVerifications() {
    const { isLoadingProofs } = this.props.proofsStateStore

    if (isLoadingProofs) {
      return <p className={classes.verifications}>Loading verifications...</p>
    }

    const verificationItems = this.renderVerificationItems()

    if (verificationItems.length === 0) {
      return <p className={classes.verifications}>No verification</p>
    }

    return (
      <ul className={classes.verifications}>
        {verificationItems}
      </ul>
    )
  }

  private renderVerificationItems() {
    const { isSelf } = this.props
    const { proofsStateStore } = this.props
    const {
      userBoundSocials,
      verifyStatuses,
      isVerifying,
    } = proofsStateStore

    const verificationItems: JSX.Element[] = []
    for (const platform of Object.values(PLATFORMS) as PLATFORMS[]) {
      const boundSocial = userBoundSocials[platform]
      if (boundSocial) {
        verificationItems.push((
          <VerifiedItem
            key={platform}
            platform={platform}
            isSelf={isSelf}
            isVerifying={isVerifying[platform]}
            boundSocial={boundSocial}
            verifyStatus={verifyStatuses[platform]}
            verify={() => proofsStateStore.verify(platform, boundSocial.proofURL)}
          />
        ))
      } else if (isSelf) {
        verificationItems.push((
          <li key={platform} className={commonClasses.verificationItem}>
            <Link className={classes.newVerifyItemLink} to={`/proving/${platform}`}>
              <Icon className={commonClasses.platformIcon} type={platform} />
              Prove your {PLATFORM_LABELS[platform]}
              <Icon className={commonClasses.checkVerificationIndicatorIcon} type="right" />
            </Link>
          </li>
        ))
      }
    }

    return verificationItems
  }

  private proofsStateStoreWillUnload(store: UserProofsStateStore) {
    store.stopFetchUserProofs()
    store.disposeStore()
  }

  private proofsStateStoreDidLoad(store: UserProofsStateStore) {
    const fetchInterval = 5000 // 5 seconds
    store.startFetchUserProofs(fetchInterval)
  }
}

interface IProps {
  proofsStateStore: UserProofsStateStore
  userAddress: string
  isSelf: boolean
}

export default ProfileContent
