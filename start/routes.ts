/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import swagger from 'adonis-autoswagger'
import config from '#config/swagger'

const Game = () => import('#controllers/games_controller')

router.get('/', () => ({
  message: 'Fight your favorite meme in our arena',
}))

router.get('/docs', () => swagger.default.ui('/swagger', config))
router.get('/swagger', async () => {
  const fs = await import('node:fs')

  return fs.readFileSync('openapi.yaml')
})

router.get('/v1/game/fighting', [Game, 'fighting'])
router.get('/v1/game/:id', [Game, 'show'])
router.post('/v1/game/start', [Game, 'startWithCustomContract'])
// router.post('/v1/game/start-random', [Game, 'startWithRandomChoice'])
router.post('/v1/game/buy', [Game, 'buy'])
router.post('/v1/game/sell', [Game, 'sell'])
router.post('/v1/game/redeem', [Game, 'redeem'])
