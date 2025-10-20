const tokenService = require('~/services/token')
const emailService = require('~/services/email')
const { getUserByEmail, createUser, privateUpdateUser, getUserById } = require('~/services/user')
const User = require('~/models/user')
const { createError } = require('~/utils/errorsHelper')
const {
  EMAIL_NOT_CONFIRMED,
  INCORRECT_CREDENTIALS,
  BAD_RESET_TOKEN,
  BAD_REFRESH_TOKEN,
  USER_NOT_FOUND,
  INVALID_TOKEN_ISSUER,
  EMAIL_NOT_VERIFIED,
  MISSING_SUB_CLAIM,
  EMAIL_ALREADY_CONFIRMED,
  BAD_CONFIRM_TOKEN
} = require('~/consts/errors')
const emailSubject = require('~/consts/emailSubject')
const {
  tokenNames: { REFRESH_TOKEN, RESET_TOKEN, CONFIRM_TOKEN },
  SALT_ROUNDS
} = require('~/consts/auth')
const { OAuth2Client } = require('google-auth-library')
const {
  config: { GMAIL_CLIENT_ID }
} = require('~/configs/config')
const client = new OAuth2Client(GMAIL_CLIENT_ID)
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const authService = {
  signup: async (role, firstName, lastName, email, password, language) => {
    const user = await createUser(role, firstName, lastName, email, password, language)

    const confirmToken = tokenService.generateConfirmToken({ id: user._id, role })
    await tokenService.saveToken(user._id, confirmToken, CONFIRM_TOKEN)
    await emailService.sendEmail(email, emailSubject.EMAIL_CONFIRMATION, language, { confirmToken, email, firstName })

    return {
      userId: user._id,
      userEmail: user.email
    }
  },

  login: async (email, password, isFromGoogle) => {
    const user = await getUserByEmail(email)

    if (!user) {
      await bcrypt.compare(password || '', '$2b$10$invalidsaltinvalidsaltinv')
      throw createError(401, INCORRECT_CREDENTIALS)
    }

    const checkedPassword = isFromGoogle ? true : await bcrypt.compare(password, user.password)

    if (!checkedPassword) {
      throw createError(401, INCORRECT_CREDENTIALS)
    }

    const { _id, lastLoginAs, isFirstLogin, isEmailConfirmed } = user

    if (!isEmailConfirmed) {
      throw createError(401, EMAIL_NOT_CONFIRMED)
    }

    const tokens = tokenService.generateTokens({ id: _id, role: lastLoginAs, isFirstLogin })
    await tokenService.saveToken(_id, tokens.refreshToken, REFRESH_TOKEN)

    if (isFirstLogin) {
      await privateUpdateUser(_id, { isFirstLogin: false })
    }

    await privateUpdateUser(_id, { lastLogin: new Date() })

    return tokens
  },

  logout: async (refreshToken) => {
    await tokenService.removeRefreshToken(refreshToken)
  },

  refreshAccessToken: async (refreshToken) => {
    const tokenData = tokenService.validateRefreshToken(refreshToken)
    const tokenFromDB = await tokenService.findToken(refreshToken, REFRESH_TOKEN)

    if (!tokenData || !tokenFromDB) {
      throw createError(400, BAD_REFRESH_TOKEN)
    }

    const user = await getUserById(tokenData.id)

    if (!user) {
      throw createError(400, BAD_REFRESH_TOKEN)
    }

    const { _id, lastLoginAs, isFirstLogin } = user

    const tokens = tokenService.generateTokens({ id: _id, role: lastLoginAs, isFirstLogin })
    await tokenService.saveToken(_id, tokens.refreshToken, REFRESH_TOKEN)

    return tokens
  },

  sendResetPasswordEmail: async (email, language) => {
    const user = await getUserByEmail(email)

    if (!user) {
      throw createError(404, USER_NOT_FOUND)
    }

    const { _id, firstName } = user

    const resetToken = tokenService.generateResetToken({ id: _id, firstName, email })
    await tokenService.saveToken(_id, resetToken, RESET_TOKEN)

    await emailService.sendEmail(email, emailSubject.RESET_PASSWORD, language, { resetToken, email, firstName })
  },

  confirmEmail: async (confirmToken, _language) => {
    const tokenData = tokenService.validateConfirmToken(confirmToken)

    if (!tokenData) {
      throw createError(400, BAD_CONFIRM_TOKEN)
    }

    const { id: userId } = tokenData
    const tokenFromDB = await tokenService.findToken(confirmToken, CONFIRM_TOKEN)

    if (!tokenFromDB) {
      throw createError(400, BAD_CONFIRM_TOKEN)
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        isEmailConfirmed: false
      },
      {
        $set: { isEmailConfirmed: true }
      },
      {
        new: true
      }
    ).exec()

    if (!updatedUser) {
      const user = await getUserById(userId)

      if (!user) {
        throw createError(404, USER_NOT_FOUND)
      }

      throw createError(400, EMAIL_ALREADY_CONFIRMED)
    }
    await tokenService.removeConfirmToken(confirmToken)
  },

  updatePassword: async (resetToken, password, language) => {
    const tokenData = tokenService.validateResetToken(resetToken)
    const tokenFromDB = await tokenService.findToken(resetToken, RESET_TOKEN)

    if (!tokenData || !tokenFromDB) {
      throw createError(400, BAD_RESET_TOKEN)
    }

    const { id: userId, firstName, email } = tokenData

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    await privateUpdateUser(userId, { password: passwordHash })

    await tokenService.removeResetToken(userId)

    await emailService.sendEmail(email, emailSubject.SUCCESSFUL_PASSWORD_RESET, language, {
      firstName
    })
  },

  googleAuth: async (idToken) => {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: GMAIL_CLIENT_ID
    })

    const payload = ticket.getPayload()

    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      throw createError(422, INVALID_TOKEN_ISSUER)
    }

    if (!payload.email_verified) {
      throw createError(422, EMAIL_NOT_VERIFIED)
    }

    if (!payload.sub) {
      throw createError(422, MISSING_SUB_CLAIM)
    }

    const { email, given_name: firstName, family_name: lastName } = payload

    let user = await getUserByEmail(email)

    if (!user) {
      const safeLastName = lastName || firstName || 'User'
      const safePassword = crypto.randomBytes(32).toString('hex')

      user = await createUser('student', firstName || 'Google', safeLastName, email, safePassword, 'en')
      await privateUpdateUser(user._id, { isEmailConfirmed: true })
    }

    return authService.login(email, '', true)
  }
}

module.exports = authService
