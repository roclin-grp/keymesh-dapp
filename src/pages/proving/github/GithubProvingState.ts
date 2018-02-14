import {
  observable,
  runInAction,
} from 'mobx'

import ProvingState from '../ProvingState'

import { GithubResource } from '../../../resources/github'
import {
  ISignedGithubClaim,
  SOCIALS,
  GITHUB_GIST_FILENAME,
  getGithubClaimByRawURL,
  BINDING_SOCIAL_STATUS,
  IGithubClaim,
} from '../../../stores/BoundSocialsStore'

export class GithubProvingState extends ProvingState {
  @observable public claim: ISignedGithubClaim
  protected checkingErrorContent =
    `Please paste the text into a public gist called ${GITHUB_GIST_FILENAME}, then check again!`

  public get platform() {
    return SOCIALS.GITHUB
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

  protected async getBindingSocial() {
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
      return
    }

    const signedClaim: ISignedGithubClaim | null = await getGithubClaimByRawURL(proofRawURL)
    if (signedClaim === null) {
      return
    }

    if (JSON.stringify(this.claim) !== JSON.stringify(signedClaim)) {
      return
    }

    return {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: signedClaim,
      proofURL: proofURL,
      username: signedClaim.claim.service.username,
      platform: this.platform,
    }
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
        name: SOCIALS.GITHUB,
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
  return `### Keymesh proof

I hereby claim:

  * I am ${claim.service.username} on github
  * I am ${claim.userAddress} on Keymesh
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
