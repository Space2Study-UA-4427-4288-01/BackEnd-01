const router = require('express').Router()

const locationController = require('~/controllers/location')
const asyncWrapper = require('~/middlewares/asyncWrapper')
const { authMiddleware } = require('~/middlewares/auth')

router.use(authMiddleware)

router.get('/countries', asyncWrapper(locationController.getCountries))

module.exports = router