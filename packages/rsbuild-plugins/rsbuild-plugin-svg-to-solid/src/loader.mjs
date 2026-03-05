import { createRequire } from 'node:module'
import { normalize } from 'node:path'
import { callbackify } from 'node:util'
import * as babel from '@babel/core'
import { optimize as optimizeSvg } from 'svgo'

const require = createRequire(import.meta.url)
const solidPresetPath = require.resolve('babel-preset-solid')

const applyReplacements = (svg, replacements = {}) => {
  let result = svg

  const sortedKeys = Object.keys(replacements).sort(
    (a, b) => b.length - a.length,
  )

  for (const key of sortedKeys) {
    const value = replacements[key]
    result = result.replace(
      new RegExp(key.replace(/[()]/g, '\\$&'), 'g'),
      value,
    )
  }

  return result
}

const svgToJsx = (svg) => {
  return svg
    .replace(/class=/g, 'class=')
    .replace(/for=/g, 'for=')
    .replace(/clip-path=/g, 'clip-path=')
    .replace(/fill-rule=/g, 'fill-rule=')
    .replace(/clip-rule=/g, 'clip-rule=')
    .replace(/stroke-width=/g, 'stroke-width=')
    .replace(/stroke-linecap=/g, 'stroke-linecap=')
    .replace(/stroke-linejoin=/g, 'stroke-linejoin=')
    .replace(/stroke-dasharray=/g, 'stroke-dasharray=')
    .replace(/stroke-dashoffset=/g, 'stroke-dashoffset=')
    .replace(/stroke-miterlimit=/g, 'stroke-miterlimit=')
    .replace(/stroke-opacity=/g, 'stroke-opacity=')
    .replace(/fill-opacity=/g, 'fill-opacity=')
    .replace(/font-family=/g, 'font-family=')
    .replace(/font-size=/g, 'font-size=')
    .replace(/font-weight=/g, 'font-weight=')
    .replace(/text-anchor=/g, 'text-anchor=')
    .replace(/xmlns:xlink=/g, 'xmlnsXlink=')
    .replace(/xlink:href=/g, 'href=')
    .replace(/xml:space=/g, 'xmlSpace=')
}

const convertPropsToJsx = (svg, colorProp, uidProp) => {
  let result = svg

  result = result.replace(/\{color\}/g, `{${colorProp}}`)
  result = result.replace(/\{uid\}/g, `{${uidProp}}`)

  const dynamicAttrRegex = /(\w+(?:-\w+)*)="(\{[^}]+\})"/g
  result = result.replace(dynamicAttrRegex, (_match, attr, value) => {
    return `${attr}={${value.slice(1, -1)}}`
  })

  return result
}

export const transformSvgToSolidSource = (
  contents,
  options = {},
  resourcePath = '',
) => {
  let svg = String(contents)

  if (options.svgo !== false) {
    try {
      const svgoConfig = options.svgoConfig || {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {},
            },
          },
        ],
      }
      const res = optimizeSvg(svg, {
        ...svgoConfig,
        path: resourcePath,
      })
      if (res?.data) svg = res.data
    } catch (_e) {
      // preserve original svg on error
    }
  }

  if (options.replaceAttrValues) {
    svg = applyReplacements(svg, options.replaceAttrValues)
  }

  const cleanSvg = svg
    .replace(/^<\?xml.*?\?>/, '')
    .replace(/<!DOCTYPE[^>]*>/, '')
    .trim()

  const usesColord = cleanSvg.includes('colord(')
  const usesUid = cleanSvg.includes('{uid}') || cleanSvg.includes("uid + '-'")
  const usesColor = cleanSvg.includes('{color}') || cleanSvg.includes('(color)')

  const imports = options.imports || ''
  const conditionalImports = usesColord ? imports : ''

  let jsxSvg = svgToJsx(cleanSvg)
  jsxSvg = convertPropsToJsx(jsxSvg, 'props.color', 'props.uid')

  const defaultProps = []
  if (usesColor) defaultProps.push('color: "currentColor"')
  if (usesUid) defaultProps.push('uid: ""')

  const mergePropsLine =
    defaultProps.length > 0
      ? `const merged = { ${defaultProps.join(', ')}, ...props };`
      : 'const merged = props;'

  jsxSvg = jsxSvg.replace(/props\.color/g, 'merged.color')
  jsxSvg = jsxSvg.replace(/props\.uid/g, 'merged.uid')

  // Replace bare uid references in string concatenations (e.g., uid + '-abc')
  // But not in object literals or property names
  jsxSvg = jsxSvg.replace(/\buid\s*\+/g, 'merged.uid +')
  // Replace bare color references in function calls (e.g., colord(color))
  jsxSvg = jsxSvg.replace(/\(color\)/g, '(merged.color)')

  const jsxSource = `${conditionalImports}

const SvgComponent = (props) => {
  ${mergePropsLine}
  return (
    ${jsxSvg}
  );
};

export default SvgComponent;
`

  return { jsxSource, raw: svg }
}

const compileWithBabel = async (jsxSource, resourcePath, solidPresetOptions = {}) => {
  const result = await babel.transformAsync(jsxSource, {
    filename: resourcePath || 'component.jsx',
    presets: [[solidPresetPath, solidPresetOptions]],
    babelrc: false,
    configFile: false,
  })
  return result?.code || ''
}

const transformSvg = callbackify(async (contents, options = {}, state = {}) => {
  const resourcePath = state.filePath || state.filename || ''
  const { jsxSource, raw } = transformSvgToSolidSource(
    contents,
    options,
    resourcePath,
  )

  const compiledCode = await compileWithBabel(jsxSource, resourcePath, options.solidPresetOptions || {})

  const out = `${compiledCode}
export const raw = ${JSON.stringify(raw)};
`

  return out
})

export default function loader(contents) {
  if (this?.cacheable) this.cacheable()

  const callback = this.async()
  const options = this.getOptions ? this.getOptions() : {}

  const previousExport = (() => {
    if (String(contents).startsWith('export ')) return contents
    const exportMatches = String(contents).match(/^module\.exports\s*=\s*(.*)/)
    return exportMatches ? `export default ${exportMatches[1]}` : null
  })()

  const state = {
    caller: {
      name: '@avatune/plugin-svg-to-solid',
      previousExport,
    },
    filePath: normalize(
      this.resourcePath ||
        (typeof __filename !== 'undefined' && __filename) ||
        '',
    ),
  }

  if (!previousExport) {
    transformSvg(contents, options, state, callback)
    return
  }

  this.fs.readFile(this.resourcePath, (err, result) => {
    if (err) {
      callback(err)
      return
    }
    transformSvg(String(result), options, state, (err2, content) => {
      if (err2) {
        callback(err2)
        return
      }
      callback(null, content)
    })
  })
}
