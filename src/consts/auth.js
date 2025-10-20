const roles = {
  STUDENT: 'student',
  TUTOR: 'tutor',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
}

const tokenNames = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  RESET_TOKEN: 'resetToken',
  CONFIRM_TOKEN: 'confirmToken'
}

const oneDayInMs = 86400000

const SALT_ROUNDS = 10

module.exports = {
  roles,
  oneDayInMs,
  tokenNames,
  SALT_ROUNDS
}
