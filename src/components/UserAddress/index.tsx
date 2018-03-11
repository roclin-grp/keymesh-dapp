import * as React from 'react'

function UserAddress({
  userAddress,
  maxLength = Infinity,
  overflowPadding = '...',
  className,
}: IProps) {
  const isOverflow = userAddress.length > maxLength
  return (
    <span className={className} title={userAddress}>
      {`${userAddress.slice(0, maxLength)}${isOverflow ? overflowPadding : ''}`}
    </span>
  )
}

interface IProps {
  userAddress: string
  maxLength?: number
  className?: string
  overflowPadding?: string
}

export default UserAddress
