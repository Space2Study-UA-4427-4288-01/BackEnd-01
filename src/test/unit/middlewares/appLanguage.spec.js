const langMiddleware = require('~/middlewares/appLanguage')
const { INVALID_LANGUAGE } = require('~/consts/errors')
const { createError } = require('~/utils/errorsHelper')
const {
  enums: { APP_LANG_ENUM }
} = require('~/consts/validation')

describe('langMiddleware', () => {
  let req, res, next
  beforeEach(() => {
    req = {}
    res = {}
    next = jest.fn()
  })

  it.each(APP_LANG_ENUM)('should set req.lang and call next if language is valid (%s)', (lang) => {
    req.acceptsLanguages = jest.fn().mockReturnValue(lang)
    langMiddleware(req, res, next)

    expect(req.lang).toBe(lang)
    expect(next).toHaveBeenCalled()
  })

  it('should throw an error if language is invalid', () => {
    req.acceptsLanguages = jest.fn().mockReturnValue(false)
    const expectedError = createError(400, INVALID_LANGUAGE)

    expect(() => langMiddleware(req, res, next)).toThrowError(
      expect.objectContaining({
        message: expectedError.message,
        status: expectedError.status,
        code: expectedError.code
      })
    )

    expect(next).not.toHaveBeenCalled()
  })
})
