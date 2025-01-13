// for AdonisJS v6
import path from 'node:path'
import url from 'node:url'
// ---

export default {
  // path: __dirname + "/../", for AdonisJS v5
  path: path.dirname(url.fileURLToPath(import.meta.url)) + '/../', // for AdonisJS v6
  title: 'Volume Bot',
  version: '0.0.1',
  description: 'Solana transaction bot',
  tagIndex: 2,
  info: {
    title: 'Volume Bot',
    version: '0.0.1',
    description: 'Solana transaction bot',
  },
  snakeCase: true,
  debug: true,
  ignore: ['/swagger', '/docs'],
  preferredPutPatch: 'PUT',
  common: {
    parameters: {},
    headers: {},
  },
  securitySchemes: {},
  authMiddlewares: ['auth', 'auth:api'],
  defaultSecurityScheme: 'BearerAuth',
  persistAuthorization: true,
  showFullPath: false,
}
