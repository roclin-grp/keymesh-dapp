import * as React from 'react'

const Identicon = require('identicon.js')

interface Iprops {
  hash: string
  size?: number
}

function Avatar(props: Iprops) {
  const size = props.size || 80
  const avatar = `data:image/svg+xml;base64,${(new Identicon(
    props.hash,
    { size, format: 'svg', margin: 0.1 }
  ).toString())}`
  return <img src={avatar} />
}

export default Avatar
