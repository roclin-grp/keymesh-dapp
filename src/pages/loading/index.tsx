import * as React from 'react'

// component
import {
  Icon
} from 'antd'

// style
import './index.css'

// helper
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

const blockName = 'loading-page'
const getBEMClassNames = getBEMClassNamesMaker(blockName)

export default function Loading() {
  return (
    <>
      <Icon type="loading" className={getBEMClassNames('icon-loading')} />
      <p>Loading...</p>
    </>
  )
}
