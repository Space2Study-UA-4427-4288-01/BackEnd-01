const { countrystatecityAccess: {COUNRTYSTATECITY_API_KEY}} = require('../configs/config')

const locationService = {
  getCountries: async () => {
    const response = await fetch('https://api.countrystatecity.in/v1/countries', {
      method: 'GET',
      headers: {
        'X-CSCAPI-KEY': COUNRTYSTATECITY_API_KEY
      }
    })
    return response.json()
  }
}

module.exports = locationService