jest.mock('~/configs/config', () => ({
	countrystatecityAccess: { COUNRTYSTATECITY_API_KEY: 'test-key' }
}))

const locationService = require('~/services/location')

describe('locationService', () => {
	beforeEach(() => {
		global.fetch = jest.fn()
	})

	afterEach(() => {
		jest.resetAllMocks()
	})

	describe('getCountries', () => {
		it('calls fetch with correct URL and headers and returns JSON', async () => {
			const mockJson = [{ iso2: 'UA', name: 'Ukraine' }]
			global.fetch.mockResolvedValue({ json: jest.fn().mockResolvedValue(mockJson) })

			const result = await locationService.getCountries()

			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.countrystatecity.in/v1/countries',
				{
					method: 'GET',
					headers: { 'X-CSCAPI-KEY': 'test-key' }
				}
			)
			expect(result).toEqual(mockJson)
		})

		it('propagates fetch error', async () => {
			const err = new Error('network')
			global.fetch.mockRejectedValue(err)
			await expect(locationService.getCountries()).rejects.toThrow('network')
		})
	})

	describe('getCities', () => {
		it('calls fetch with country code and returns JSON', async () => {
			const mockJson = [{ name: 'Kyiv' }, { name: 'Lviv' }]
			global.fetch.mockResolvedValue({ json: jest.fn().mockResolvedValue(mockJson) })

			const result = await locationService.getCities('UA')

			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.countrystatecity.in/v1/countries/UA/cities',
				{
					method: 'GET',
					headers: { 'X-CSCAPI-KEY': 'test-key' }
				}
			)
			expect(result).toEqual(mockJson)
		})

		it('propagates fetch error', async () => {
			global.fetch.mockRejectedValue(new Error('down'))
			await expect(locationService.getCities('UA')).rejects.toThrow('down')
		})
	})
})

