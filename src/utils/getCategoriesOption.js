const getCategoriesOptions = (categories) => {
  if (categories) {
    if (typeof(categories) === Array) {
      return categories.map((item) => (item === 'null' ? null : item))
    } else {
      return categories
    }
  } else {
    return
  }
}
module.exports = getCategoriesOptions
