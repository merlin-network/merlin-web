import type { Csp } from '../../types'

export const csp: Csp = {
  'connect-src': [
    process.env.REACT_APP_KEEPKEY_VERSIONS_URL!,
    process.env.REACT_APP_KEEPKEY_DESKTOP_URL!,
  ],
}
