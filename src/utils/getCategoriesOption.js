const getCategoriesOptions = (categories) => {
  if (categories) {
    if (Array.isArray(categories)) {
      return categories.map((item) => (item === 'null' ? null : item))
    } else {
      return categories
    }
  } else {
    return
  }
}
module.exports = getCategoriesOptions
