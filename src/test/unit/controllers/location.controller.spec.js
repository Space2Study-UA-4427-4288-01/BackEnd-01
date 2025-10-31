jest.mock('~/services/location', () => ({
  getCountries: jest.fn(),
  getCities: jest.fn()
}))

const locationService = require('~/services/location')
const controller = require('~/controllers/location')

const makeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  }
  return res
}

describe('locationController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCountries', () => {
    it('returns 200 with countries data', async () => {
      const data = [{ iso2: 'UA', name: 'Ukraine' }]
      locationService.getCountries.mockResolvedValue(data)

      const req = {}
      const res = makeRes()

      await controller.getCountries(req, res)

      expect(locationService.getCountries).toHaveBeenCalledTimes(1)
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(data)
    })

    it('propagates error when service fails', async () => {
      locationService.getCountries.mockRejectedValue(new Error('fail'))
      const req = {}
      const res = makeRes()

      await expect(controller.getCountries(req, res)).rejects.toThrow('fail')
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })

  describe('getCitiesByCountryId', () => {
    it('returns 200 with cities for given country id', async () => {
      const cities = [{ name: 'Kyiv' }, { name: 'Lviv' }]
      locationService.getCities.mockResolvedValue(cities)

      const req = { params: { id: 'UA' } }
      const res = makeRes()

      await controller.getCitiesByCountryId(req, res)

      expect(locationService.getCities).toHaveBeenCalledWith('UA')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(cities)
    })

    it('propagates error when service fails', async () => {
      locationService.getCities.mockRejectedValue(new Error('down'))

      const req = { params: { id: 'UA' } }
      const res = makeRes()

      await expect(controller.getCitiesByCountryId(req, res)).rejects.toThrow('down')
      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).not.toHaveBeenCalled()
    })
  })
})
