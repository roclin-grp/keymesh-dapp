import * as React from 'react'

import { inject, observer } from 'mobx-react'

import {
  Link,
  RouteComponentProps,
} from 'react-router-dom'

const sodium = require('libsodium-wrappers-sumo')
import CommonHeaderPage from '../../containers/CommonHeaderPage'
import HashAvatar from '../../components/HashAvatar'
import { Store } from '../../store'
import {
  getBEMClassNamesMaker,
  hexToUtf8,
  storeLogger,
  getGithubClaimByProofURL,
} from '../../utils'

import {
  publicKeyFromHexStr
} from '../../crypto.utils'

import {
  SOCIAL_MEDIAS,
  TRUSTBASE_CONNECT_STATUS,
  VERIFY_SOCIAL_STATUS,
} from '../../constants'

import {
  IboundSocials,
  IsignedBoundSocials,
  ItwitterClaim
} from '../../../typings/proof.interface'

import { sha3 } from 'trustbase'

import { Icon } from 'antd'

interface Iparams {
  userAddress?: string
}

interface Iprops extends RouteComponentProps<Iparams> {
  store: Store
}

interface Istate {
  isFetchingUserProofs: boolean
  isVerifyingUserProofs: boolean
  fetchUserProofTimeout?: number
  verifyProofTimeout?: number
  verifyStatus: {
    github?: VERIFY_SOCIAL_STATUS
    twitter?: VERIFY_SOCIAL_STATUS
    facebook?: VERIFY_SOCIAL_STATUS
    nacker_news?: VERIFY_SOCIAL_STATUS
  }
  userBoundSocials: IboundSocials
  userAddress: string
  userLastFetchBlock: number
  userBlockHash: string
}

@inject('store') @observer
class Profile extends React.Component<Iprops, Istate> {
  constructor(props: Iprops) {
    super(props)

    let userAddress = ''
    if (typeof props.match.params.userAddress !== 'undefined') {
      userAddress = props.match.params.userAddress
    }

    this.state = {
      isFetchingUserProofs: false,
      isVerifyingUserProofs: false,
      userLastFetchBlock: 0,
      verifyStatus: {},
      userAddress,
      userBoundSocials: {},
      userBlockHash: '0x0',
    }
  }

  private readonly getBEMClassNames = getBEMClassNamesMaker('profile', this.props)
  public stopVerifyingUserProofs = () => {
    if (typeof this.state.verifyProofTimeout !== 'undefined') {
      window.clearTimeout(this.state.verifyProofTimeout)
    }
    this.setState({
      isVerifyingUserProofs: false,
    })
  }
  public stopFetchingUserProofs = () => {
    if (typeof this.state.fetchUserProofTimeout !== 'undefined') {
      window.clearTimeout(this.state.fetchUserProofTimeout)
    }
    this.setState({
      isFetchingUserProofs: false,
    })
  }

  public verifyUserProofs = async () => {
    if (this.state.userAddress === '') {
     return
    }
    if (typeof this.state.userBoundSocials === 'undefined') {
      return
    }

    const { getUserPublicKey, } = this.props.store
    const currentUserPublicKey = await getUserPublicKey(this.state.userAddress)
    if (currentUserPublicKey === '') {
      return
    }

    const userPublicKey = publicKeyFromHexStr(currentUserPublicKey.slice(2))

    const socials = this.state.userBoundSocials
    const verifyGithub = async () => {
      if (typeof socials.github !== 'undefined') {
        const signedGithubClaim = await getGithubClaimByProofURL(socials.github.proofURL)
        if (signedGithubClaim === null) {
          this.setState({
            verifyStatus: Object.assign(this.state.verifyStatus, { github: VERIFY_SOCIAL_STATUS.INVALID })
          })
        } else {
          if (!userPublicKey.verify(
            sodium.from_hex(signedGithubClaim.signature.slice(2)),
            JSON.stringify(signedGithubClaim.githubClaim))) {
            this.setState({
              verifyStatus: Object.assign(this.state.verifyStatus, { github: VERIFY_SOCIAL_STATUS.INVALID })
            })
          } else {
            this.setState({
              verifyStatus: Object.assign(this.state.verifyStatus, { github: VERIFY_SOCIAL_STATUS.VALID })
            })
          }
        }
      }
    }
    verifyGithub()

    const verifyTwitter = async () => {
      if (typeof socials.twitter !== 'undefined') {
        const {
        twitterResource
      } = this.props.store
        if (typeof twitterResource === 'undefined') {
          // todo deal with could not get twitter resource
          return
        }
        const tweet = await twitterResource.getTweetByProofURL(socials.twitter.proofURL)
        if (tweet === null) {
          this.setState({
            verifyStatus: Object.assign(this.state.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
          })
        } else {
          const parts = /addr: (\w+)\s+public key: (\w+)\s+sig: (\w+)/.exec(tweet.full_text)
          if (parts === null) {
            this.setState({
              verifyStatus: Object.assign(this.state.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
            })
          } else {
            const twitterClaim: ItwitterClaim = {
              userAddress: parts[1],
              publicKey: parts[2],
            }
            if (!userPublicKey.verify(
              sodium.from_hex(parts[3].slice(2)),
              JSON.stringify(twitterClaim)
            )) {
              this.setState({
                verifyStatus: Object.assign(this.state.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
              })
            } else {
              this.setState({
                verifyStatus: Object.assign(this.state.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.VALID })
              })
            }
          }
        }
      }
    }
    verifyTwitter()
  }

  public fetchUserProofs = async () => {
    const {
      getBoundEvents,
      getUserPublicKey,
    } = this.props.store
    if (this.state.userAddress === '') {
      return
    }
    const currentUserPublicKey = await getUserPublicKey(this.state.userAddress)
    if (currentUserPublicKey === '') {
      return
    }

    const {
      lastBlock,
      bindEvents
    } = await getBoundEvents(this.state.userLastFetchBlock, this.state.userAddress)

    if (bindEvents.length === 0) {
      return
    }

    const bindEvent: any = bindEvents[bindEvents.length - 1]
    const _signedBoundSocial = JSON.parse(hexToUtf8(
      bindEvent.signedBoundSocials.slice(2))) as IsignedBoundSocials

    this.setState({
      userLastFetchBlock: lastBlock,
    })
    if (JSON.stringify(_signedBoundSocial.socialMedias) !== JSON.stringify(this.state.userBoundSocials)) {
      const userPublicKey = publicKeyFromHexStr(currentUserPublicKey.slice(2))
      if (!userPublicKey.verify(
        sodium.from_hex(_signedBoundSocial.signature.slice(2)),
        JSON.stringify(_signedBoundSocial.socialMedias)
      )) {
        storeLogger.error(new Error('invalid signature'))
        return
      }
      this.setState({
        userBoundSocials: _signedBoundSocial.socialMedias
      })
      this.verifyUserProofs()
    }
  }

  public startFetchingUserProofs = () => {
    const fetchLoop = async () => {
      try {
        await this.fetchUserProofs()
      } finally {
        this.setState({
          fetchUserProofTimeout: window.setTimeout(fetchLoop, 10000)
        })
      }
    }

    this.setState({
      isFetchingUserProofs: true,
      fetchUserProofTimeout: window.setTimeout(fetchLoop, 0)
    })
  }
  public startVerifyingUserProofs = () => {
    const loop = async () => {
      try {
        await this.verifyUserProofs()
      } finally {
        this.setState({
          verifyProofTimeout: window.setTimeout(loop, 15000)
        })
      }
    }

    this.setState({
      isVerifyingUserProofs: true,
      verifyProofTimeout: window.setTimeout(loop, 0)
    })
  }

  public componentDidMount(isFirstMount: boolean = true) {
    const {
      connectStatus,
      currentUser,
      isFetchingBoundEvents,
      startFetchBoundEvents,
      listenForConnectStatusChange,
      getIdentity,
      getBlockHash,
    } = this.props.store
    if (connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS) {
      if (currentUser) {
        if ('' === this.state.userAddress) {
          this.setState({
            userAddress: currentUser.userAddress,
          })
        }
        if (!isFetchingBoundEvents) {
          startFetchBoundEvents()
        }
      }

      getIdentity(this.state.userAddress).then(async ({blockNumber}) => {
        return await getBlockHash(blockNumber)
      }).then(blockHash => {
          this.setState({userBlockHash: blockHash})
      }).catch(err => {
        storeLogger.error(err)
      })

      if (!this.state.isFetchingUserProofs) {
        this.startFetchingUserProofs()
      }
      if (!this.state.isVerifyingUserProofs) {
        this.startVerifyingUserProofs()
      }
    }

    if (isFirstMount) {
      listenForConnectStatusChange(this.connectStatusListener)
    }
  }

  public componentWillUnmount() {
    const {
      stopFetchBoundEvents,
      removeConnectStatusListener
    } = this.props.store
    stopFetchBoundEvents()
    this.stopFetchingUserProofs()
    this.stopVerifyingUserProofs()
    removeConnectStatusListener(this.connectStatusListener)
  }

  public render() {
    const {
      connectStatus,
    } = this.props.store
    if (connectStatus === TRUSTBASE_CONNECT_STATUS.SUCCESS) {
      return <CommonHeaderPage>
        {this.userAvatar()}
        {this.socials()}
      </CommonHeaderPage>
    }
    return <CommonHeaderPage> Connecting... </CommonHeaderPage>

  }
  private socials() {
    const socialsElements = []
    for (let social of SOCIAL_MEDIAS) {
      const boundSocial = this.state.userBoundSocials[social.platform]
      let stateText = null

      if (typeof boundSocial !== 'undefined') {
        stateText = <a>{boundSocial.username}@{social.platform} {this.state.verifyStatus[social.platform]}</a>
      } else if (this.isSelf) {
        stateText = <Link to={`/proving/${social.platform}`}>Prove your {social.label}</Link>
      }

      if (stateText !== null) {
        socialsElements.push(
          <li key={social.platform}>
            <Icon type={social.platform} style={{ marginRight: '5px' }} />
            {stateText}
          </li>
        )
      }
    }
    return <ul>{socialsElements}</ul>
  }

  private userAvatar() {
    const { getBEMClassNames } = this
    const avatarShape = 'square'
    const avatarSize = 'large'
    const avatarClassName = getBEMClassNames('user-avatar')

    let hash = ''
    if (this.state.userBlockHash !== '0x0' && this.state.userAddress !== '') {
      hash = sha3(this.state.userAddress + this.state.userBlockHash)
    }

    return (
      <HashAvatar
        className={avatarClassName}
        shape={avatarShape}
        size={avatarSize}
        hash={hash}
      />
    )
  }

  private connectStatusListener = (prev: TRUSTBASE_CONNECT_STATUS, cur: TRUSTBASE_CONNECT_STATUS) => {
    const {
      stopFetchBoundEvents
    } = this.props.store
    if (prev !== TRUSTBASE_CONNECT_STATUS.SUCCESS) {
      this.componentDidMount(false)
    } else if (cur !== TRUSTBASE_CONNECT_STATUS.SUCCESS) {
      stopFetchBoundEvents()
      this.stopFetchingUserProofs()
      this.stopVerifyingUserProofs()
    }
  }
  private get isSelf() {
    const {
      currentUser,
    } = this.props.store
    if (!currentUser) {
      return false
    }

    return this.state.userAddress === currentUser.userAddress
  }
}

export default Profile
