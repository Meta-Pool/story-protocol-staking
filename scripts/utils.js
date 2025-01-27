const fs = require('fs')
const path = require('path')

const fetchAllFiles = dir => {
  const fullPath = path.join(__dirname, dir)
  const files = fs.readdirSync(fullPath)

  return files
    .filter(file => fs.statSync(path.join(fullPath, file)).isFile() && !file.startsWith('.'))
    .map(file => file.split('.')[0])
}

const getSupportedNetworks = () => fetchAllFiles('../constants/networks')

module.exports = {
  fetchAllFiles,
  getSupportedNetworks,
}
