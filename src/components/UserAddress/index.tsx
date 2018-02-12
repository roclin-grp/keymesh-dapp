import * as React from 'react'

function UserAddress({
  address,
  maxLength = Infinity,
  overflowPadding = '...',
  className,
}: IProps) {
  const isOverflow = address.length > maxLength
  return (
    <span className={className} title={address}>
      {`${address.slice(0, maxLength)}${isOverflow ? overflowPadding : ''}`}
    </span>
  )
}

interface IProps {
  address: string
  maxLength?: number
  className?: string
  overflowPadding?: string
}

export default UserAddress
