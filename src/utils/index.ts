import { IsignedGithubClaim, IgithubClaim } from '../../typings/proof.interface'
import { GithubResource } from '../resources/github'
import {
  GITHUB_GIST_FILENAME,
} from '../constants'

export async function getGithubClaimByProofURL(url: string): Promise<IsignedGithubClaim | null> {
  const id = /[0-9a-f]+$/.exec(url)
  if (id === null) {
    return null
  }

  const _id = id[0]
  const gist = await GithubResource.getGist(_id)
  return await getGithubClaimByRawURL(gist.files[GITHUB_GIST_FILENAME].raw_url)
}

export async function getGithubClaimByRawURL(rawURL: string): Promise<IsignedGithubClaim|null> {
  return await GithubResource.getRawContent(rawURL)
    .then((resp) => resp.text())
    .then((text) => {
      const matches = /\`\`\`json([\s\S]*?)\`\`\`[\s\S]*?\`\`\`\s*(.*?)\s*\`\`\`/g.exec(text)
      if (matches === null || matches.length !== 3) {
        return null
      }
      const _claim: IgithubClaim = JSON.parse(matches[1])
      const _signature = matches[2]
      return {
        claim: _claim,
        signature: _signature,
      } as IsignedGithubClaim
    })
}

export const noop = () => { /* FOR LINT */ }
