import {
  observable,
  computed,
  runInAction,
} from 'mobx'

import {
  IboundSocials, IsignedBoundSocials, ItwitterClaim,
} from '../../../typings/proof.interface'

const sodium = require('libsodium-wrappers-sumo')
import {
  VERIFY_SOCIAL_STATUS,
} from '../../constants'
import { sha3, } from 'trustbase'
import { getGithubClaimByProofURL, } from '../../utils'
import { FacebookResource } from '../../resources/facebook'
import { TwitterResource } from '../../resources/twitter'
import { UsersStore } from '../../stores/UsersStore'
import { ContractStore } from '../../stores/ContractStore'
import { hexToUtf8 } from '../../utils/hex'
import { BlockType } from '../../../../../trustbase/typings/web3'

export class ProfileState {
  public isFetchingUserProofs: boolean = false
  public isVerifyingUserProofs: boolean = false
  public fetchUserProofTimeout: number
  public verifyProofTimeout: number

  @observable public verifyStatus: {
    github: VERIFY_SOCIAL_STATUS
    twitter: VERIFY_SOCIAL_STATUS
    facebook: VERIFY_SOCIAL_STATUS
  } = {
      github: VERIFY_SOCIAL_STATUS.NOT_FOUND,
      twitter: VERIFY_SOCIAL_STATUS.NOT_FOUND,
      facebook: VERIFY_SOCIAL_STATUS.NOT_FOUND
    }

  @observable public userBoundSocials: IboundSocials = {}
  public userLastFetchBlock: number = 0
  @observable public userBlockHash: string = '0x0'

  constructor({
      usersStore,
      contractStore,
      getBlockHash,
    }: {
      usersStore: UsersStore
      contractStore: ContractStore
      getBlockHash: (blockNumber: number) => Promise<string>
    }
  ) {
    this.usersStore = usersStore
    this.contractStore = contractStore
    this.getBlockHash = getBlockHash
  }

  private getBlockHash: (blockNumber: number) => Promise<string>
  private usersStore: UsersStore
  private contractStore: ContractStore
  @observable private _userAddress: string = ''
  private readonly twitterResource = new TwitterResource(
    process.env.REACT_APP_TWITTER_CONSUMER_KEY!,
    process.env.REACT_APP_TWITTER_SECRET_KEY!
  )

  public get userAddress() {
    return this._userAddress
  }

  public set userAddress(userAddress: string) {
    this._userAddress = userAddress
    this.usersStore.getIdentity(this._userAddress)
      .then(({ blockNumber }) => {
        return this.getBlockHash(blockNumber)
      }).then(blockHash => {
        runInAction(() => {
          this.userBlockHash = blockHash
        })
      })
  }

  @computed
  public get isSelf() {
    return this.usersStore.hasUser && this._userAddress === this.usersStore.currentUserStore!.user.userAddress
  }

  @computed
  public get avatarHash() {
    if (this.userBlockHash !== '0x0' && this._userAddress !== '') {
      return sha3(this._userAddress + this.userBlockHash)
    }
    return ''
  }

  public stopVerifyingUserProofs = () => {
    if (typeof this.verifyProofTimeout !== 'undefined') {
      window.clearTimeout(this.verifyProofTimeout)
    }
    runInAction(() => {
      this.isVerifyingUserProofs = false
    })
  }

  public stopFetchingUserProofs = () => {
    if (typeof this.fetchUserProofTimeout !== 'undefined') {
      window.clearTimeout(this.fetchUserProofTimeout)
    }
    runInAction(() => {
      this.isFetchingUserProofs = false
    })
  }

  public fetchUserProofs = async () => {
    const publicKey = await this.usersStore.getUserPublicKey(this._userAddress)
    if (typeof publicKey === 'undefined') {
      return
    }

    const {
      lastBlock,
      bindEvents
    } = await this.getBindEvents(this.userLastFetchBlock, this._userAddress)

    runInAction(() => {
      this.userLastFetchBlock = lastBlock
    })
    for (let i = bindEvents.length - 1; i >= 0; i--) {
      const bindEvent: any = bindEvents[i]
      const _signedBoundSocial = JSON.parse(hexToUtf8(bindEvent.signedBoundSocials.slice(2))) as IsignedBoundSocials
      if (JSON.stringify(_signedBoundSocial.socialMedias) !== JSON.stringify(this.userBoundSocials)) {
        if (!publicKey.verify(
          sodium.from_hex(_signedBoundSocial.signature.slice(2)),
          JSON.stringify(_signedBoundSocial.socialMedias)
        )) {
          continue
        }

        runInAction(() => {
          this.userBoundSocials = _signedBoundSocial.socialMedias
        })
        break
      }
    }
  }

  public startFetchingUserProofs = () => {
    const loop = async () => {
      try {
        await this.fetchUserProofs()
      } finally {
        runInAction(() => {
          this.fetchUserProofTimeout = window.setTimeout(loop, 10000)
        })
      }
    }

    runInAction(() => {
      this.isFetchingUserProofs = true
      this.fetchUserProofTimeout = window.setTimeout(loop, 0)
    })
  }
  public startVerifyingUserProofs = () => {
    const loop = async () => {
      try {
        await this.verifyUserProofs()
      } finally {
        runInAction(() => {
          this.verifyProofTimeout = window.setTimeout(loop, 15000)
        })
      }
    }

    runInAction(() => {
      this.isVerifyingUserProofs = true
      this.verifyProofTimeout = window.setTimeout(loop, 0)
    })
  }

  public verifyUserProofs = async () => {
    if (this._userAddress === '') {
     return
    }

    const publicKey = await this.usersStore.getUserPublicKey(this._userAddress)
    if (typeof publicKey === 'undefined') {
      return
    }

    const socials = this.userBoundSocials
    const verifyFacebook = async () => {
      if (typeof socials.facebook !== 'undefined') {
        const unverifiedClaim = await FacebookResource.getClaimByPostURL(socials.facebook.proofURL)
        if (unverifiedClaim === null) {
          runInAction(() => {
            this.verifyStatus = Object.assign(this.verifyStatus, { facebook: VERIFY_SOCIAL_STATUS.INVALID })
          })
        } else {
          if (!publicKey.verify(
            sodium.from_hex(unverifiedClaim.signature.slice(2)),
            JSON.stringify(unverifiedClaim.claim))) {
            runInAction(() => {
              this.verifyStatus = Object.assign(this.verifyStatus, { facebook: VERIFY_SOCIAL_STATUS.INVALID })
            })
          } else {
            runInAction(() => {
              this.verifyStatus = Object.assign(this.verifyStatus, { facebook: VERIFY_SOCIAL_STATUS.VALID })
            })
          }
        }
      }
    }
    verifyFacebook()

    const verifyGithub = async () => {
      if (typeof socials.github !== 'undefined') {
        const signedGithubClaim = await getGithubClaimByProofURL(socials.github.proofURL)
        if (signedGithubClaim === null) {
          runInAction(() => {
            this.verifyStatus = Object.assign(this.verifyStatus, { github: VERIFY_SOCIAL_STATUS.INVALID })
          })
        } else {
          if (!publicKey.verify(
            sodium.from_hex(signedGithubClaim.signature.slice(2)),
            JSON.stringify(signedGithubClaim.claim))) {
            runInAction(() => {
              this.verifyStatus = Object.assign(this.verifyStatus, { github: VERIFY_SOCIAL_STATUS.INVALID })
            })
          } else {
            runInAction(() => {
              this.verifyStatus = Object.assign(this.verifyStatus, { github: VERIFY_SOCIAL_STATUS.VALID })
            })
          }
        }
      }
    }
    verifyGithub()

    const verifyTwitter = async () => {
      if (typeof socials.twitter !== 'undefined') {
        const tweet = await this.twitterResource.getTweetByProofURL(socials.twitter.proofURL)
        if (tweet === null) {
          runInAction(() => {
            this.verifyStatus = Object.assign(this.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
          })
        } else {
          const parts = /addr: (\w+)\s+public key: (\w+)\s+sig: (\w+)/.exec(tweet.full_text)
          if (parts === null) {
            runInAction(() => {
              this.verifyStatus = Object.assign(this.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
            })
          } else {
            const twitterClaim: ItwitterClaim = {
              userAddress: parts[1],
              publicKey: parts[2],
            }
            if (!publicKey.verify(
              sodium.from_hex(parts[3].slice(2)),
              JSON.stringify(twitterClaim)
            )) {
              runInAction(() => {
                this.verifyStatus = Object.assign(this.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.INVALID })
              })
            } else {
              runInAction(() => {
                this.verifyStatus = Object.assign(this.verifyStatus, { twitter: VERIFY_SOCIAL_STATUS.VALID })
              })
            }
          }
        }
      }
    }
    verifyTwitter()
  }

  private getBindEvents = (
    lastFetchBlock: BlockType,
    userAddress: string,
  ) => {
    return this.contractStore.boundSocialsContract.getBindEvents({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0,
      filter: {
        userAddress
      }
    })
  }
}
