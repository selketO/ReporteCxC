const fs = require('fs');
const path = require('path');

const loadConditions = () => {
  const filePath = path.join(__dirname, '..', '..', 'condiciones_comerciales.json');
  const jsonData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(jsonData);
};

module.exports = { loadConditions };
