import * as classnames from 'classnames'

/**
 * Make a BEM class-names generator
 *
 * Usage:
 * ```
 * // get the generator
 * const getBEMClassNames = getBEMClassNamesMaker(
 *  'foo', // Block name
 *  props // props including `className` and `prefixClass` for customization
 * )
 *
 * // block level className
 * const blockClassNames = getBEMClassNames()
 * // => 'foo'
 *
 * // element level className
 * const barClassNames = getBEMClassNames('bar')
 * // => 'foo__bar'
 *
 * // modifier
 * const barWithModifierClassNames = getBEMClassNames('bar', { baz: true, qux: false })
 * // => 'foo__bar--baz'
 * ```
 *
 * // have other classnames
 * const barWithOtherClassNames = getBEMClassNames('bar', {}, { qux: true, quux: false })
 * // => 'foo__bar qux'
 */
export function getBEMClassNamesMaker(
  blockName: string,
  { className = '', prefixClass = '' }: IextendableClassNamesProps
) {
  return function getBEMClassNames(
    elementName: string = '',
    predicates: { [modifier: string]: boolean } = {},
    otherClassNames: { [className: string]: boolean } = {}
  ) {
    return classnames(
      Object.assign(
        otherClassNames,
        {
          [className]: !elementName && className,
          [blockName]: !elementName,
          [`${blockName}__${elementName}`]: elementName,
          [`${prefixClass}__${blockName}`]: (
            prefixClass && !elementName
          ),
          [`${prefixClass}__${blockName}-${elementName}`]: (
            prefixClass && elementName
          )
        },
        Object.keys(predicates).reduce(
          (result, modifier) => {
            const hasModifier = predicates[modifier]
            const hasNotElementAndHasModifier = !elementName && hasModifier
            const hasElementAndHasModifier = elementName && hasModifier
            return Object.assign(
              {},
              result,
              {
                [`${blockName}--${modifier}`]: hasNotElementAndHasModifier,
                [`${blockName}__${elementName}--${modifier}`]: hasElementAndHasModifier,
                [`${prefixClass}__${blockName}--${modifier}`]: (
                  prefixClass && hasNotElementAndHasModifier
                ),
                [`${prefixClass}__${blockName}-${elementName}--${modifier}`]: (
                  prefixClass && hasElementAndHasModifier
                )
              })
            },
          {}
        )
      ) as ClassDictionary
    )
  }
}

interface ClassDictionary {
  [id: string]: boolean | undefined | null
}

export interface IextendableClassNamesProps {
  className?: string
  prefixClass?: string
}
