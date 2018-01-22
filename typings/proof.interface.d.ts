import {
  SOCIAL_MEDIA_PLATFORMS,
  BINDING_SOCIAL_STATUS,
} from '../src/constants'

interface IboundSocial {
  username: string
  proofURL: string
}

interface IboundSocials {
  twitter?: IboundSocial
  github?: IboundSocial
  facebook?: IboundSocial
}

interface IsignedBoundSocials {
  socialMedias: IboundSocials
  signature: string
}

interface IgithubClaim {
  userAddress: string
  service: {
    name: string
    username: string
  },
  ctime: number
  publicKey: string
}

interface IsignedGithubClaim {
  githubClaim: IgithubClaim
  signature: string
}

interface ItwitterClaim {
  userAddress: string
  publicKey: string
}

interface IsignedTwitterClaim {
  claim: ItwitterClaim
  signature: string
}

interface IfacebookClaim {
  userAddress: string
  publicKey: string
}

interface IsignedFacebookClaim {
  claim: IfacebookClaim
  signature: string
}

interface IbindingSocial extends IboundSocial {
  signedClaim: IsignedGithubClaim|IsignedTwitterClaim|IsignedFacebookClaim
  status: BINDING_SOCIAL_STATUS
}

interface IbindingSocials {
  twitter?: IbindingSocial
  github?: IbindingSocial
  facebook?: IbindingSocial
} 
