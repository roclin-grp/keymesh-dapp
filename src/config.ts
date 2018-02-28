const OAUTH_API_PREFIX =
  'https://cors-anywhere.herokuapp.com/https://lhql95dprb.execute-api.ap-northeast-1.amazonaws.com/'

export default process.env.NODE_ENV === 'production' ? {
  REQUIRED_CONFIRMATION_NUMBER: 3,
  ESTIMATE_AVERAGE_BLOCK_TIME: 15000,
  TRANSACTION_TIME_OUT_BLOCK_NUMBER: 50,
  KVASS_ENDPOINT: 'https://hlskkkzio4.execute-api.ap-northeast-1.amazonaws.com/kvass/',
  TWITTER_CONSUMER_KEY: '8rBG1xrUBpFgE2T5bDOskGFpv',
  TWITTER_SECRET_KEY: 'WOL2SCR8RJr38LTBlPEqZz4r6fyU9qqCELBeCE7hmbOcuchnDi',
  TWITTER_OAUTH_API: '/Prod/oauth/twitter/authorize_url',
  TWITTER_OAUTH_CALLBACK: '/Prod/oauth/twitter/callback',
  FACEBOOK_APP_ID: '162817767674605',
  DEPLOYED_ADDRESS: 'https://test.keymail.io',
} : {
  REQUIRED_CONFIRMATION_NUMBER: 1,
  ESTIMATE_AVERAGE_BLOCK_TIME: 5000,
  TRANSACTION_TIME_OUT_BLOCK_NUMBER: 3,
  KVASS_ENDPOINT: 'https://hlskkkzio4.execute-api.ap-northeast-1.amazonaws.com/kvass/',
  TWITTER_CONSUMER_KEY: '8rBG1xrUBpFgE2T5bDOskGFpv',
  TWITTER_SECRET_KEY: 'WOL2SCR8RJr38LTBlPEqZz4r6fyU9qqCELBeCE7hmbOcuchnDi',
  TWITTER_OAUTH_API: OAUTH_API_PREFIX + '/Stage/oauth/twitter/authorize_url',
  TWITTER_OAUTH_CALLBACK: OAUTH_API_PREFIX + '/Stage/oauth/twitter/callback',
  /*
  TWITTER_OAUTH_API: 'http://localhost:1235/oauth/twitter/authorize_url',
  TWITTER_OAUTH_CALLBACK: 'http://localhost:1235/oauth/twitter/callback',
  */
  FACEBOOK_APP_ID: '402106420236062',
  DEPLOYED_ADDRESS: 'http://localhost:1234',
}
