const router = require('express').Router()

const asyncWrapper = require('~/middlewares/asyncWrapper')
const validationMiddleware = require('~/middlewares/validation')
const langMiddleware = require('~/middlewares/appLanguage')

const authController = require('~/controllers/auth')
const signupValidationSchema = require('~/validation/schemas/signup')
const { loginValidationSchema } = require('~/validation/schemas/login')
const resetPasswordValidationSchema = require('~/validation/schemas/resetPassword')
const forgotPasswordValidationSchema = require('~/validation/schemas/forgotPassword')

const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')

const isTest = process.env.NODE_ENV === 'test'

const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many Google auth attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req)}:${(req.body?.email || '').toLowerCase()}`,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many login attempts. Try again later.' },
  skip: () => isTest
})

router.post(
  '/signup',
  validationMiddleware(signupValidationSchema),
  langMiddleware,
  asyncWrapper(authController.signup)
)

router.post('/login', loginLimiter, validationMiddleware(loginValidationSchema), asyncWrapper(authController.login))

router.post('/logout', asyncWrapper(authController.logout))

router.get('/refresh', asyncWrapper(authController.refreshAccessToken))

router.post(
  '/forgot-password',
  validationMiddleware(forgotPasswordValidationSchema),
  langMiddleware,
  asyncWrapper(authController.sendResetPasswordEmail)
)

router.patch(
  '/reset-password/:token',
  validationMiddleware(resetPasswordValidationSchema),
  langMiddleware,
  asyncWrapper(authController.updatePassword)
)

router.post('/google-auth', googleAuthLimiter, asyncWrapper(authController.googleAuth))

module.exports = router
