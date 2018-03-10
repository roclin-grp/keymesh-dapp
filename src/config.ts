const DEV_OAUTH_API_PREFIX =
  'https://lhql95dprb.execute-api.ap-northeast-1.amazonaws.com'

const TEST_OAUTH_API_PREFIX =
  'https://qrjajk91o5.execute-api.ap-northeast-1.amazonaws.com'

export default process.env.NODE_ENV === 'production' ? {
  REQUIRED_CONFIRMATION_NUMBER: 3,
  ESTIMATE_AVERAGE_BLOCK_TIME: 15000,
  TRANSACTION_TIME_OUT_BLOCK_NUMBER: 50,
  KVASS_ENDPOINT: 'https://ngjvr0cmq8.execute-api.us-west-1.amazonaws.com/Prod/',
  TWITTER_CONSUMER_KEY: '8rBG1xrUBpFgE2T5bDOskGFpv',
  TWITTER_SECRET_KEY: 'WOL2SCR8RJr38LTBlPEqZz4r6fyU9qqCELBeCE7hmbOcuchnDi',
  TWITTER_OAUTH_API: TEST_OAUTH_API_PREFIX + '/Prod/oauth/twitter/authorize_url',
  TWITTER_OAUTH_CALLBACK: TEST_OAUTH_API_PREFIX + '/Prod/oauth/twitter/callback',
  FACEBOOK_APP_ID: '162817767674605',
  DEPLOYED_ADDRESS: 'https://test.keymesh.io',
} : {
  REQUIRED_CONFIRMATION_NUMBER: 0,
  ESTIMATE_AVERAGE_BLOCK_TIME: 5000,
  TRANSACTION_TIME_OUT_BLOCK_NUMBER: 3,
  KVASS_ENDPOINT: 'https://hlskkkzio4.execute-api.ap-northeast-1.amazonaws.com/kvass/',
  TWITTER_CONSUMER_KEY: '8rBG1xrUBpFgE2T5bDOskGFpv',
  TWITTER_SECRET_KEY: 'WOL2SCR8RJr38LTBlPEqZz4r6fyU9qqCELBeCE7hmbOcuchnDi',
  TWITTER_OAUTH_API: DEV_OAUTH_API_PREFIX + '/Stage/oauth/twitter/authorize_url',
  TWITTER_OAUTH_CALLBACK: DEV_OAUTH_API_PREFIX + '/Stage/oauth/twitter/callback',
  FACEBOOK_APP_ID: '402106420236062',
  DEPLOYED_ADDRESS: 'http://localhost:1234',
}
