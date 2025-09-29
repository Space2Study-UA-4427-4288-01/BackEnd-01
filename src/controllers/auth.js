const authService = require('~/services/auth')
const { oneDayInMs } = require('~/consts/auth')
const {
  config: { COOKIE_DOMAIN }
} = require('~/configs/config')
const {
  tokenNames: { REFRESH_TOKEN, ACCESS_TOKEN }
} = require('~/consts/auth')

const COOKIE_OPTIONS = {
  maxAge: oneDayInMs,
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  domain: COOKIE_DOMAIN
}

const signup = async (req, res) => {
  const { role, firstName, lastName, email, password } = req.body
  const lang = req.lang

  const userData = await authService.signup(role, firstName, lastName, email, password, lang)

  res.status(201).json(userData)
}

const login = async (req, res) => {
  const { email, password } = req.body

  const tokens = await authService.login(email, password)

  res.cookie(ACCESS_TOKEN, tokens.accessToken, COOKIE_OPTIONS)
  res.cookie(REFRESH_TOKEN, tokens.refreshToken, COOKIE_OPTIONS)

  delete tokens.refreshToken

  res.status(200).json(tokens)
}

const logout = async (req, res) => {
  const { refreshToken } = req.cookies

  await authService.logout(refreshToken)

  res.clearCookie(REFRESH_TOKEN)
  res.clearCookie(ACCESS_TOKEN)

  res.status(204).end()
}

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.cookies

  if (!refreshToken) {
    res.clearCookie(ACCESS_TOKEN)

    return res.status(401).end()
  }

  const tokens = await authService.refreshAccessToken(refreshToken)

  res.cookie(ACCESS_TOKEN, tokens.accessToken, COOKIE_OPTIONS)
  res.cookie(REFRESH_TOKEN, tokens.refreshToken, COOKIE_OPTIONS)

  delete tokens.refreshToken

  res.status(200).json(tokens)
}

const sendResetPasswordEmail = async (req, res) => {
  const { email } = req.body
  const lang = req.lang

  await authService.sendResetPasswordEmail(email, lang)

  res.status(204).end()
}

const updatePassword = async (req, res) => {
  const { password } = req.body
  const resetToken = req.params.token
  const lang = req.lang

  await authService.updatePassword(resetToken, password, lang)

  res.status(204).end()
}

const googleAuth = async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(422).json({
        error: 'MISSING_TOKEN',
        message: 'Google token is required'
      })
    }

    const tokens = await authService.googleAuth(token)

    res.cookie(ACCESS_TOKEN, tokens.accessToken, COOKIE_OPTIONS)
    res.cookie(REFRESH_TOKEN, tokens.refreshToken, COOKIE_OPTIONS)

    delete tokens.refreshToken

    res.status(200).json(tokens)
  } catch (error) {
    if (error.status === 422) {
      return res.status(422).json({
        error: error.code || 'INVALID_TOKEN',
        message: error.message
      })
    }

    if (error.message && (error.message.includes('Token used too early') || error.message.includes('Invalid token'))) {
      return res.status(422).json({
        error: 'TOKEN_NOT_VALID',
        message: 'Google token is not valid'
      })
    }

    return res.status(401).json({
      error: 'AUTHENTICATION_FAILED',
      message: 'Google authentication failed'
    })
  }
}

module.exports = {
  signup,
  login,
  logout,
  refreshAccessToken,
  sendResetPasswordEmail,
  updatePassword,
  googleAuth
}
