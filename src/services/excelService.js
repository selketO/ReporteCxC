const ExcelJS = require('exceljs');

const createExcel = async (records) => {
  let workbook = new ExcelJS.Workbook();
  return workbook;
};

module.exports = { createExcel };
