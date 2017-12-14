import * as React from 'react'

const Identicon = require('identicon.js')

interface Iprops {
  hash: string
  size?: number
}

function Avatar(props: Iprops) {
    let size = props.size
    if (size ==0) {
        size = 80
    }
    let avatar = "data:image/svg+xml;base64," + (new Identicon(props.hash, {size: size, format: 'svg', margin: 0.1}).toString())
    return <img src={avatar}/>
}

export default Avatar