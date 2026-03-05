import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import type { Config as SvgoConfig } from 'svgo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type PluginOptions = {
  svgoConfig?: SvgoConfig
  svgo?: boolean
  query?: RegExp
  mixedImport?: boolean
  exclude?: Rspack.RuleSetCondition
  debug?: boolean
  imports?: string
  replaceAttrValues?: Record<string, string>
  solidPresetOptions?: Record<string, unknown>
}

const SVG_REGEX = /\.svg$/

const getDefaultSvgoConfig = (): SvgoConfig =>
  ({
    plugins: [
      {
        name: 'preset-default',
        params: { overrides: {} },
      },
    ],
  }) as SvgoConfig

export const PLUGIN_NAME = 'avatune:svg-to-solid'

export const pluginSvgToSolid = (
  options: PluginOptions = {},
): RsbuildPlugin => ({
  name: PLUGIN_NAME,
  pre: ['rsbuild:svgr'],
  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID, environment }) => {
      const debug = !!options.debug
      const { config } = environment
      const { dataUriLimit } = config.output
      const maxSize =
        typeof dataUriLimit === 'number' ? dataUriLimit : dataUriLimit.svg

      let generatorOptions: Rspack.GeneratorOptionsByModuleType['asset/resource'] =
        {}
      try {
        if (chain.module.rules.has(CHAIN_ID.RULE.SVG)) {
          const existingRule = chain.module.rules.get(CHAIN_ID.RULE.SVG)
          if (existingRule?.oneOfs) {
            const svgUrlOneOfId = CHAIN_ID.ONE_OF?.SVG_URL
            if (svgUrlOneOfId && existingRule.oneOfs.has(svgUrlOneOfId)) {
              const urlOneOf = existingRule.oneOfs.get(svgUrlOneOfId)
              if (urlOneOf && typeof urlOneOf.get === 'function') {
                const gen = urlOneOf.get('generator')
                if (gen) generatorOptions = gen
              }
            } else {
              for (const [_, v] of Object.entries(existingRule.oneOfs)) {
                try {
                  const maybeGen = v.get?.('generator')
                  if (maybeGen) {
                    generatorOptions = maybeGen
                    break
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      } catch (e) {
        if (debug)
          console.warn(
            `[${PLUGIN_NAME}] failed to read existing svg generator options:`,
            e,
          )
        generatorOptions = {}
      }

      try {
        if (chain.module.rules.has(CHAIN_ID.RULE.SVG)) {
          const builtin = chain.module.rules.get(CHAIN_ID.RULE.SVG)
          if (builtin?.exclude && typeof builtin.exclude.add === 'function') {
            builtin.exclude.add(/\?solid$/)
            if (debug)
              console.log(
                `[${PLUGIN_NAME}] added exclude ?solid to builtin svg rule`,
              )
          }
        }
      } catch (e) {
        if (debug)
          console.warn(
            `[${PLUGIN_NAME}] could not add exclude to builtin svg rule:`,
            e,
          )
      }

      const rule = chain.module.rule(CHAIN_ID.RULE.SVG).test(SVG_REGEX)

      const merged = {
        svgo: options.svgo ?? true,
        svgoConfig: options.svgoConfig || getDefaultSvgoConfig(),
      }

      const solidQuery = /(^|\?)solid($|&)/

      const replaceAttrValues = options.replaceAttrValues
        ? Object.entries(options.replaceAttrValues).reduce(
            (acc, [key, value]) => {
              acc[key] = value
              acc[key.toLowerCase()] = value
              return acc
            },
            options.replaceAttrValues,
          )
        : undefined

      try {
        rule
          .oneOf('svg-solid')
          .before(CHAIN_ID.ONE_OF?.SVG_URL)
          .type('javascript/auto')
          .resourceQuery(solidQuery)
          .use('solid-svg-loader')
          .loader(path.resolve(__dirname, './loader.mjs'))
          .options({
            svgo: merged.svgo,
            svgoConfig: merged.svgoConfig,
            imports: options.imports,
            replaceAttrValues,
            solidPresetOptions: options.solidPresetOptions,
          })
          .end()
      } catch (e) {
        if (debug)
          console.warn(`[${PLUGIN_NAME}] failed to add svg-solid oneOf:`, e)
      }

      try {
        rule
          .oneOf('svg-url')
          .type('asset/resource')
          .resourceQuery(/(__inline=false|url)/)
          .set('generator', generatorOptions)
      } catch (e) {
        if (debug)
          console.warn(`[${PLUGIN_NAME}] failed to add svg-url oneOf:`, e)
      }

      try {
        rule
          .oneOf('svg-inline')
          .type('asset/inline')
          .resourceQuery(/inline/)
      } catch (e) {
        if (debug)
          console.warn(`[${PLUGIN_NAME}] failed to add svg-inline oneOf:`, e)
      }

      try {
        rule.oneOf('svg-raw').type('asset/source').resourceQuery(/raw/)
      } catch (e) {
        if (debug)
          console.warn(`[${PLUGIN_NAME}] failed to add svg-raw oneOf:`, e)
      }

      if (options.mixedImport) {
        try {
          const issuerInclude = [
            /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/,
            /\.mdx$/,
          ]
          const issuer = options.exclude
            ? { and: [issuerInclude, { not: options.exclude }] }
            : issuerInclude

          const svgRule = rule.oneOf('svg-default')

          if (
            options.exclude &&
            svgRule &&
            svgRule.exclude &&
            typeof svgRule.exclude.add === 'function'
          ) {
            svgRule.exclude.add(options.exclude)
          }

          svgRule
            .type('javascript/auto')
            .set('issuer', issuer)
            .use('solid-svg-loader')
            .loader(path.resolve(__dirname, './loader.mjs'))
            .options({
              svgo: merged.svgo,
              svgoConfig: merged.svgoConfig,
              imports: options.imports,
              replaceAttrValues,
            })
            .end()
        } catch (e) {
          if (debug)
            console.warn(
              `[${PLUGIN_NAME}] failed to add mixedImport svg rule:`,
              e,
            )
        }
      }

      try {
        rule
          .oneOf('svg-asset')
          .type('asset')
          .parser({
            dataUrlCondition: { maxSize },
          })
          .set('generator', generatorOptions)
      } catch (e) {
        if (debug)
          console.warn(`[${PLUGIN_NAME}] failed to add svg-asset oneOf:`, e)
      }

      if (debug) console.log(`[${PLUGIN_NAME}] svg rules configured`)
    })
  },
})
