import * as React from 'react'

function ProvingTextarea({
  value,
  className,
}: IProps) {
  return (
    <textarea
      className={className}
      cols={80}
      rows={15}
      onFocus={handleFocus}
      value={value}
      readOnly={true}
    />
  )
}

function handleFocus(event: React.FocusEvent<HTMLTextAreaElement>) {
  event.currentTarget.select()
}

interface IProps {
  value: string
  className?: string
}

export default ProvingTextarea
