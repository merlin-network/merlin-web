import type { AssetId } from '@shapeshiftoss/caip'
import type { GetTradeQuoteInput } from '@shapeshiftoss/swapper'
import type { GetTradeQuoteInputArgs } from 'components/Trade/hooks/useSwapper/getTradeQuoteArgs'
import { getTradeQuoteArgs } from 'components/Trade/hooks/useSwapper/getTradeQuoteArgs'
import { isFulfilled } from 'lib/utils'
import { getBestSwapperApi } from 'state/apis/swapper/getBestSwapperApi'
import { getUsdRateApi } from 'state/apis/swapper/getUsdRateApi'
import { swapperApi } from 'state/apis/swapper/swapperApi'
import type { State } from 'state/apis/types'
import { apiErrorHandler } from 'state/apis/utils'

export type GetUsdRatesArgs = {
  feeAssetId: AssetId
} & (
  | { tradeQuoteInputArgs?: never; tradeQuoteArgs: GetTradeQuoteInput }
  | { tradeQuoteInputArgs: GetTradeQuoteInputArgs; tradeQuoteArgs?: never }
)

type GetUsdRatesReturn = {
  buyAssetUsdRate: string
  sellAssetUsdRate: string
  feeAssetUsdRate: string
}

const getBestSwapperType = getBestSwapperApi.endpoints.getBestSwapperType
const getUsdRate = getUsdRateApi.endpoints.getUsdRate

const getUsdRatesErrorHandler = apiErrorHandler('getUsdRates: error fetching USD rates')

export const getUsdRatesApi = swapperApi.injectEndpoints({
  endpoints: build => ({
    getUsdRates: build.query<GetUsdRatesReturn, GetUsdRatesArgs>({
      queryFn: async (args, { getState, dispatch }) => {
        const { feeAssetId } = args
        const buyAssetId = args.tradeQuoteInputArgs
          ? args.tradeQuoteInputArgs.buyAsset.assetId
          : args.tradeQuoteArgs.buyAsset.assetId
        const sellAssetId = args.tradeQuoteInputArgs
          ? args.tradeQuoteInputArgs.sellAsset.assetId
          : args.tradeQuoteArgs.sellAsset.assetId
        const state: State = getState() as unknown as State // ReduxState causes circular dependency
        const { assets } = state
        try {
          const tradeQuoteArgs = args.tradeQuoteInputArgs
            ? await getTradeQuoteArgs(args.tradeQuoteInputArgs)
            : args.tradeQuoteArgs

          if (!tradeQuoteArgs)
            return getUsdRatesErrorHandler({ message: 'getUsdRates: tradeQuoteArgs is undefined' })

          const feeAsset = assets.byId[feeAssetId]
          if (!feeAsset)
            return getUsdRatesErrorHandler({
              message: `getUsdRates: Asset not found for AssetId ${feeAssetId}`,
            })

          const swapperType = await dispatch(
            getBestSwapperType.initiate({
              ...tradeQuoteArgs,
              feeAsset,
            }),
          ).then(r => r.data)

          if (!swapperType)
            return getUsdRatesErrorHandler({ message: 'getUsdRates: Swapper type not found' })

          const assetIds = [feeAssetId, buyAssetId, sellAssetId]
          const usdRatePromises = await Promise.allSettled(
            assetIds.map(assetId => dispatch(getUsdRate.initiate({ assetId, swapperType }))),
          )
          const [feeAssetUsdRate, buyAssetUsdRate, sellAssetUsdRate] = usdRatePromises
            .filter(isFulfilled)
            .map(p => p.value?.data)

          if (!feeAssetUsdRate || !buyAssetUsdRate || !sellAssetUsdRate)
            return getUsdRatesErrorHandler({ message: 'getUsdRates: USD rates not found' })

          const data = { feeAssetUsdRate, buyAssetUsdRate, sellAssetUsdRate }
          return { data }
        } catch (error) {
          return getUsdRatesErrorHandler()
        }
      },
    }),
  }),
})

export const { useGetUsdRatesQuery } = getUsdRatesApi