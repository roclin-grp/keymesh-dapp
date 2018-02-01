import * as React from 'react'

import { Avatar } from 'antd'

import { IextendableClassNamesProps } from '../../utils/classNames'

const Identicon = require('identicon.js')

interface Iprops extends IextendableClassNamesProps {
  hash: string
  size?: 'large' | 'small' | 'default'
  shape?: 'circle' | 'square'
}

const SIZE_PX = Object.freeze({
  large: 40,
  small: 24,
  default: 32
})

function HashAvatar({size = 'default', hash, shape = 'square', className}: Iprops) {
  const hasNotHash = hash === ''
  const sizePx = SIZE_PX[size]
  const avatar = hasNotHash ? undefined : `data:image/svg+xml;base64,${(new Identicon(
    hash,
    { size: sizePx, format: 'svg', margin: 0.1 }
  ).toString())}`
  return (
    <Avatar
      className={className}
      shape={shape}
      size={size}
      src={avatar}
      icon={hasNotHash ? 'user' : undefined}
    />
  )
}

export default HashAvatar
