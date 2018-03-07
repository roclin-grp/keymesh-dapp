import * as React from 'react'
import { observer } from 'mobx-react'

import { Button } from 'antd'
import ProvingTextarea from '../ProvingTextarea'
import StatusButton from '../../../components/StatusButton'

import * as commonClasses from '../index.css'

import { signedClaimToClaimText } from '../../../stores/SocialProofsStore'
import { PROVING_STEPS } from '../ProvingData'
import { TwitterProvingData } from './TwitterProvingData'

interface IProps {
  data: TwitterProvingData
}

@observer
class TwitterProving extends React.Component<IProps> {
  public render() {
    const { data } = this.props
    const {
      username,
      currentStep,
      buttonDisabled,
      proofStatusType,
      proofStatusContent,
    } = data

    if (currentStep === PROVING_STEPS.CONNECT) {
      return (
        <>
          <h3 className={commonClasses.subtitle}>
            You will be redirected to Twitter for authentication
          </h3>
          <StatusButton
            disabled={buttonDisabled}
            statusType={proofStatusType}
            statusContent={proofStatusContent}
            onClick={data.authorize.bind(data)}
          >
            Connect To Twitter
          </StatusButton>
        </>
      )
    }

    if (currentStep === PROVING_STEPS.POST) {
      const twitterClaimText = signedClaimToClaimText(data.claim!)
      const tweetClaimURL = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(twitterClaimText)
      return (
        <>
          <h3 className={commonClasses.subtitle}>
            You are now connected as
            <a href={`https://twitter.com/${username}`} target="_blank">
              {` @${username}`}
            </a>
          </h3>
          <p>
            Tweet the following text exactly as it appears to cryptographically prove your address
          </p>
          <ProvingTextarea value={signedClaimToClaimText(data.claim!)} />
          <Button size="large" className={commonClasses.postButton} type="primary">
            <a href={tweetClaimURL} target="_blank">Tweet Proof</a>
          </Button>
          <h3 className={commonClasses.subtitle}>
            Check the proof after you have tweeted
          </h3>
          <StatusButton
            disabled={buttonDisabled}
            statusType={proofStatusType}
            statusContent={proofStatusContent}
            onClick={data.checkProof.bind(data)}
          >
            Check Proof
          </StatusButton>
        </>
      )
    }

    const proof = data.proof!
    const { proofURL } = proof

    if (currentStep === PROVING_STEPS.RECORD) {
      return (
        <>
          <h3 className={commonClasses.subtitle}>
            You are now connected as
            <a href={`https://twitter.com/${username}`} target="_blank">
              {` @${username}`}
            </a>
            , and your proof is published
          </h3>
          <p>
            The proof URL is
            <a target="_blank" href={proofURL}>
             {` ${proofURL}`}
            </a>
          </p>
          <h3 className={commonClasses.subtitle}>
            Record the proof URL on the blockchain so every can find it
          </h3>
          <StatusButton
            disabled={buttonDisabled}
            statusType={proofStatusType}
            statusContent={proofStatusContent}
            onClick={data.uploadBindingProof.bind(data)}
          >
            Record Proof
          </StatusButton>
        </>
      )
    }

    return null
  }
}

export default TwitterProving
