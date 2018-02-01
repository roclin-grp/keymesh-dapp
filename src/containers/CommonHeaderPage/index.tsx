import * as React from 'react'

// component
import Header from '../Header'

// style
import './index.css'

// helper
import {
  getBEMClassNamesMaker,
  IextendableClassNamesProps,
} from '../../utils/classNames'

export default function CommonHeaderPage({
  children,
  prefixClass,
  className,
}: IextendableClassNamesProps & { children?: React.ReactNode }) {
  const getBEMClassNames = getBEMClassNamesMaker('common-header-page', { className, prefixClass })
  return (
    <div className={getBEMClassNames()}>
      <Header prefixClass={prefixClass} />
      <div className={getBEMClassNames('content')}>
        {children}
      </div>
    </div>
  )
}
