import {
  observable,
  runInAction,
  useStrict,
} from 'mobx'

import ProvingState from '../ProvingState'

import { GithubResource } from '../../../resources/github'
import {
  ISignedGithubClaim,
  SOCIAL_MEDIA_PLATFORMS,
  VERIFY_SOCIAL_STATUS,
  GITHUB_GIST_FILENAME,
  getGithubClaimByRawURL,
  IBindingSocial,
  BINDING_SOCIAL_STATUS,
  IGithubClaim,
} from '../../../stores/BoundSocialsStore'

useStrict(true)

export class GithubProvingState extends ProvingState {
  @observable public claim: ISignedGithubClaim

  public get platform() {
    return SOCIAL_MEDIA_PLATFORMS.GITHUB
  }

  protected init() {
    runInAction(() => {
      this.steps = [
        'Enter username',
        'Create a gist',
        'Upload infomations',
        'Done',
      ]
    })
  }

  protected async _checkProof(): Promise<VERIFY_SOCIAL_STATUS> {
    const gists = await GithubResource.getGists(this.username)

    let proofURL: string = ''
    let proofRawURL: string = ''
    for (const gist of gists) {
      if (Object.keys(gist.files).includes(GITHUB_GIST_FILENAME)) {
        proofURL = gist.html_url
        proofRawURL = gist.files[GITHUB_GIST_FILENAME].raw_url
        break
      }
    }
    if (proofURL === '') {
      return VERIFY_SOCIAL_STATUS.NOT_FOUND
    }

    const signedClaim: ISignedGithubClaim | null = await getGithubClaimByRawURL(proofRawURL)
    if (signedClaim === null) {
      return VERIFY_SOCIAL_STATUS.INVALID
    }

    if (JSON.stringify(this.claim) !== JSON.stringify(signedClaim)) {
      return VERIFY_SOCIAL_STATUS.INVALID
    }

    const bindingSocial: IBindingSocial = {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: signedClaim,
      proofURL: proofURL,
      username: signedClaim.claim.service.username,
    }
    this.usersStore.currentUserStore!.boundSocialsStore.addGithubBindingSocial(bindingSocial)

    return VERIFY_SOCIAL_STATUS.VALID
  }

  protected setClaim(username: string, userAddress: string, publicKey: string): void {
    runInAction(() => {
      this.isProving = true
      this.claim = this.generateSignedClaim(username, userAddress, publicKey)
    })
  }

  private generateSignedClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: IGithubClaim = {
      userAddress,
      service: {
        name: SOCIAL_MEDIA_PLATFORMS.GITHUB,
        username,
      },
      ctime: Math.floor(Date.now() / 1000),
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim,
      signature,
    } as ISignedGithubClaim
  }
}

export function getGithubClaim(signedClaim: ISignedGithubClaim) {
  const {
    claim: claim,
    signature,
  } = signedClaim
  const claimStr = JSON.stringify(claim, undefined, '  ')
  return `### Keymail proof

I hereby claim:

  * I am ${claim.service.username} on github
  * I am ${claim.userAddress} on Keymail
  * I have a public key ${claim.publicKey}

To Claim this, I am signing this object:

\`\`\`json
${claimStr}
\`\`\`

with the key ${claim.publicKey}, yielding the signature:

\`\`\`
${signature}
\`\`\`
`
}
