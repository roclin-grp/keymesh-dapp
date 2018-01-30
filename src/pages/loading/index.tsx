import * as React from 'react'

// component
import {
  Icon
} from 'antd'
import CommonHeaderPage from '../../containers/CommonHeaderPage'

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
    <CommonHeaderPage prefixClass={blockName} className={getBEMClassNames()}>
      <Icon type="loading" className={getBEMClassNames('icon-loading')} />
      <p>Loading...</p>
    </CommonHeaderPage>
  )
}
