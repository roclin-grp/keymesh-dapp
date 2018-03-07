import * as React from 'react'
import { observer } from 'mobx-react'

import FacebookLogin from 'react-facebook-login'
import { Button } from 'antd'
import ProvingTextarea from '../ProvingTextarea'
import { FacebookProvingData } from './FacebookProvingData'
import StatusButton from '../../../components/StatusButton'

import * as commonClasses from '../index.css'

import ENV from '../../../config'
import { signedClaimToClaimText } from '../../../stores/SocialProofsStore'
import { PROVING_STEPS } from '../ProvingData'

interface IProps {
  data: FacebookProvingData
}

@observer
class FacebookProving extends React.Component<IProps> {
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
      return <>
        <h3 className={commonClasses.subtitle}>
          You need to Login to Facebook and authorize.
        </h3>
        <StatusButton
          statusType={proofStatusType}
          statusContent={proofStatusContent}
          buttonClassName="ant-btn ant-btn-primary ant-btn-lg"
          renderButton={(props) => (
            <FacebookLogin
              cssClass={props.className}
              appId={ENV.FACEBOOK_APP_ID}
              isDisabled={buttonDisabled}
              autoLoad={false}
              fields="name"
              scope="user_posts"
              onClick={data.startLogin}
              callback={data.loginCallback}
            />
          )}
        />
      </>
    }

    if (currentStep === PROVING_STEPS.POST) {
      return (
        <>
          <h3 className={commonClasses.subtitle}>
            You are now connected as {username}
          </h3>
          <p>
            Post the following text exactly as it appears to cryptographically prove your address
          </p>
          <ProvingTextarea value={signedClaimToClaimText(data.claim!)} />
          <Button size="large" className={commonClasses.postButton} type="primary">
            <a href="https://www.facebook.com/" target="_blank">Post Proof</a>
          </Button>
          <h3 className={commonClasses.subtitle}>
            Check the proof after you have posted
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
            You are now connected as {username}, and your proof is published
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

export default FacebookProving
