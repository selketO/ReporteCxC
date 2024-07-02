const xmlrpc = require('xmlrpc');
const { odooConfig } = require('../config/config');
const fs = require('fs');
const path = require('path');

const createClient = (path) => {
  const url = odooConfig.url.replace(/^https?:\/\//, '');
  return xmlrpc.createSecureClient({
    host: url,
    port: 443,
    path: path,
  });
};

const authenticateOdoo = async () => {
  return new Promise((resolve, reject) => {
    const commonClient = createClient('/xmlrpc/2/common');  
    commonClient.methodCall('authenticate', [odooConfig.db, odooConfig.username, odooConfig.password, {}], (error, uid) => {
      if (error) {
        reject(error);
      } else {
        resolve(uid);
      }
    });
  });
};

const fetchData = async (model, domain, fields) => {
  const uid = await authenticateOdoo();
  return new Promise((resolve, reject) => {
    const modelsClient = createClient('/xmlrpc/2/object');
    modelsClient.methodCall('execute_kw', [odooConfig.db, uid, odooConfig.password, model, 'search_read', [domain], { fields: fields }], (error, records) => {
      if (error) {
        reject(error);
      } else {
        resolve(records);
      }
    });
  });
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getOdooRecords = async () => {
  const domain = ["&","&",["state", "=", "posted"],["payment_state", "in", ["not_paid", "partial"]],"|",["name", "like", "I0%"],["name", "like", "E5792-%"]];
  const fields = ['invoice_user_id', 'invoice_date', 'invoice_date_due', 'amount_untaxed_signed','amount_residual_signed', 'invoice_partner_display_name', 'name', 'amount_total_signed', 'ref', 'x_fecha_recepcion'];

  try {
    const records = await fetchData('account.move', domain, fields);
    console.log(`Processing ${records.length} records`);
    
    const clientes = JSON.parse(fs.readFileSync('./Lista de clientes BCL.json', 'utf8'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updatedRecords = records.map(record => {
      if (record.invoice_partner_display_name) {
        record.invoice_partner_display_name = record.invoice_partner_display_name.split(',')[0].trim();
      }

      // Establecer x_fecha_recepcion inicialmente a invoice_date más 8 días
      record.x_fecha_recepcion = addDays(new Date(record.invoice_date), 6).toISOString().slice(0, 10);

      const cliente = clientes.find(c => c.Cliente.toUpperCase() === record.invoice_partner_display_name.toUpperCase());
      if (cliente && cliente['Dias de credito']) {
        record.x_fecha_recepcion = addDays(new Date(record.x_fecha_recepcion), parseInt(cliente['Dias de credito'])).toISOString().slice(0, 10);
      }

      const receptionDate = new Date(record.x_fecha_recepcion);
      record.estado = receptionDate < today ? 'vencido' : 'a tiempo';

      return record;
    });

    return updatedRecords;
  } catch (error) {
    console.error('Error fetching Odoo records:', error);
    throw error;
  }
};
const calculateRotacionCartera = (records) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // console.log(`Calculando hasta: ${lastMonthYear}-${lastMonth + 1}`);

  // Filtrar registros hasta el último día del mes anterior
  const filteredRecords = records.filter(record => {
    const date = new Date(record.invoice_date);
    return date.getFullYear() === lastMonthYear && date.getMonth() <= lastMonth;
  });

  // Agrupar registros por mes
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const month = new Date(record.invoice_date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(record);
    return acc;
  }, {});

  // Calcular amount_residual de enero y del último mes
  const januaryResidual = (groupedRecords[0] || []).reduce((sum, record) => sum + record.amount_residual_signed, 0);
  const lastMonthResidual = (groupedRecords[lastMonth] || []).reduce((sum, record) => sum + record.amount_residual_signed, 0);
  const averageResidual = (januaryResidual + lastMonthResidual) / 2;

  // console.log(`Residual de enero: ${januaryResidual}`);
  // console.log(`Residual del último mes: ${lastMonthResidual}`);
  // console.log(`Promedio residual: ${averageResidual}`);

  // Calcular suma total de amount_total hasta el último mes
  let totalAmount = 0;
  for (let month = 0; month <= lastMonth; month++) {
    totalAmount += (groupedRecords[month] || []).reduce((sum, record) => sum + record.amount_total_signed, 0);
  }

  // console.log(`Total amount: ${totalAmount}`);

  // Evitar división por cero
  if (averageResidual === 0) {
    return 0;
  }

  // Calcular la rotación de cartera
  const rotacionIntermediate = totalAmount / averageResidual;
  const rotacionCartera = 360 / rotacionIntermediate;

  // console.log(`Rotación intermedia: ${rotacionIntermediate}`);
  // console.log(`Rotación de cartera: ${rotacionCartera}`);

  return Math.round(rotacionCartera);
};
const getOdooRecordsAndSums = async () => {
  const records = await getOdooRecords();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthlyData = {};

  records.forEach(record => {
    const invoiceDate = new Date(record.invoice_date);
    const month = invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    if (!monthlyData[month]) {
      monthlyData[month] = {
        totalCartera: 0,
        totalATiempo: 0,
        totalVencido: 0
      };
    }

    const amount = parseFloat(record.amount_residual_signed);

    monthlyData[month].totalCartera += amount;

    if (record.estado === 'vencido') {
      monthlyData[month].totalVencido += amount;
    } else if (record.estado === 'a tiempo') {
      monthlyData[month].totalATiempo += amount}
  });
  const sumsByRange = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61+': 0
  };

  let totalVencido = 0;
  let totalATiempo = 0;

  records.forEach(record => {
    const dueDate = new Date(record.x_fecha_recepcion);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 3600 * 24));
    const amount = parseFloat(record.amount_residual_signed);

    if (record.estado === 'vencido') {
      totalVencido += amount;
    } else if (record.estado === 'a tiempo') {
      totalATiempo += amount;
    }

    if (daysPastDue >= 0) {
      if (daysPastDue <= 15) {
        sumsByRange['0-15'] += amount;
      } else if (daysPastDue <= 30) {
        sumsByRange['16-30'] += amount;
      } else if (daysPastDue <= 45) {
        sumsByRange['31-45'] += amount;
      } else if (daysPastDue <= 60) {
        sumsByRange['46-60'] += amount;
      } else {
        sumsByRange['61+'] += amount;
      }
    }
  });
  if (!Array.isArray(records)) {
    throw new Error('Records is not an array');
  }
  const rotacionCartera = calculateRotacionCartera(records);
  const totalCartera = totalVencido + totalATiempo;

  const percentagesByRange = Object.fromEntries(
    Object.entries(sumsByRange).map(([range, sum]) => [range, (sum / totalCartera * 100).toFixed(2)])
  );

  return { totalVencido, totalATiempo, totalCartera, sumsByRange, percentagesByRange, monthlyData, rotacionCartera };
};
const getOdooRecordsAndSumas = async (filters = {}) => {
  let records = await getOdooRecords();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aplicar filtros
  if (filters.kam) {
    records = records.filter(record => record.invoice_user_id[1] === filters.kam);
  }
  if (filters.client) {
    records = records.filter(record => record.invoice_partner_display_name === filters.client);
  }
  if (filters.date) {
    const filterDate = new Date(filters.date);
    records = records.filter(record => new Date(record.invoice_date) <= filterDate);
  }
  if (filters.channels && filters.channels.length > 0) {
    const channelData = JSON.parse(fs.readFileSync('./Canales.json', 'utf8'));
    let clientsInSelectedChannels = new Set();
    let includeSpecialized = filters.channels.includes('Especializados');
    let nonSpecializedClients = new Set();

    Object.entries(channelData.Canales).forEach(([channel, clients]) => {
      if (channel !== 'Canales Especializados') {
        clients.forEach(clientEntry => nonSpecializedClients.add(clientEntry.Cliente));
      }
      if (filters.channels.includes(channel) || (includeSpecialized && channel === 'Canales Especializados')) {
        clients.forEach(clientEntry => clientsInSelectedChannels.add(clientEntry.Cliente));
      }
    });

    records = records.filter(record => {
      if (includeSpecialized) {
        return clientsInSelectedChannels.has(record.invoice_partner_display_name) ||
               !nonSpecializedClients.has(record.invoice_partner_display_name);
      } else {
        return clientsInSelectedChannels.has(record.invoice_partner_display_name);
      }
    });
  }
let groupedRecords = {};

  records.forEach(record => {
    let clientId = record.invoice_partner_display_name;
    if (!groupedRecords[clientId]) {
      groupedRecords[clientId] = {
        cliente: clientId,
        vencido_por_cobrar: 0,
        en_fecha: 0,
        dias_1_30: 0,
        dias_31_60: 0,
        dias_61_90: 0,
        dias_91_120: 0,
        mas_antiguos: 0,
        total: 0,
        facturas: []
      };
    }

    const dueDate = new Date(record.x_fecha_recepcion);
    const daysPastDue = Math.round((today - dueDate) / (1000 * 60 * 60 * 24));
    const amount = parseFloat(record.amount_residual_signed);
    const totalAmount = parseFloat(record.amount_total_signed);

    let rango = "mas_antiguos";
    if (daysPastDue < 0) {
      groupedRecords[clientId].en_fecha += amount;
      rango = "en_fecha";
    } else if (daysPastDue <= 30) {
      groupedRecords[clientId].dias_1_30 += amount;
      rango = "dias_1_30";
    } else if (daysPastDue <= 60) {
      groupedRecords[clientId].dias_31_60 += amount;
      rango = "dias_31_60";
    } else if (daysPastDue <= 90) {
      groupedRecords[clientId].dias_61_90 += amount;
      rango = "dias_61_90";
    } else if (daysPastDue <= 120) {
      groupedRecords[clientId].dias_91_120 += amount;
      rango = "dias_91_120";
    } else {
      groupedRecords[clientId].mas_antiguos += amount;
    }

    groupedRecords[clientId].total += amount;
    groupedRecords[clientId].facturas.push({
      factura: record.name,
      fecha_factura: record.invoice_date,
      fecha_vencimiento: record.invoice_date_due,
      importe: amount,
      importe_total: totalAmount,
      rango: rango
    });
  });

  return Object.values(groupedRecords);
};
const calculateSums = (records) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthlyData = {};
 
  let totalVencido = 0;
  let totalATiempo = 0;
 
  const sumsByRange = {
    '0-15': 0,
    '16-30': 0,
    '31-45': 0,
    '46-60': 0,
    '61+': 0
  };
 
  records.forEach(record => {
    const invoiceDate = new Date(record.invoice_date);
    const month = invoiceDate.toLocaleString('default', { month: 'long' });
    const year = invoiceDate.getFullYear();
 
    const monthYear = `${month} ${year}`;
 
    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = {
        totalCartera: 0,
        totalATiempo: 0,
        totalVencido: 0
      };
    }
 
    const amount = parseFloat(record.amount_residual_signed);
 
    monthlyData[monthYear].totalCartera += amount;
 
    if (record.estado === 'vencido') {
      totalVencido += amount;
      monthlyData[monthYear].totalVencido += amount;
    } else if (record.estado === 'a tiempo') {
      totalATiempo += amount;
      monthlyData[monthYear].totalATiempo += amount;
    }
 
    const dueDate = new Date(record.x_fecha_recepcion);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 3600 * 24));
 
    if (daysPastDue >= 0) {
      if (daysPastDue <= 15) {
        sumsByRange['0-15'] += amount;
      } else if (daysPastDue <= 30) {
        sumsByRange['16-30'] += amount;
      } else if (daysPastDue <= 45) {
        sumsByRange['31-45'] += amount;
      } else if (daysPastDue <= 60) {
        sumsByRange['46-60'] += amount;
      } else {
        sumsByRange['61+'] += amount;
      }
    }
  });
 
  // Filtrar monthlyData para incluir solo meses de 2024 en adelante
  const filteredMonthlyData = Object.fromEntries(
    Object.entries(monthlyData).filter(([monthYear, _]) => {
      const year = parseInt(monthYear.split(' ')[1]);
      return year >= 2024;
    })
  );
 
  const totalCartera = totalVencido + totalATiempo;
 
  const percentagesByRange = Object.fromEntries(
    Object.entries(sumsByRange).map(([range, sum]) => [range, (sum / totalCartera * 100).toFixed(2)])
  );
 
  return { totalVencido, totalATiempo, totalCartera, sumsByRange, percentagesByRange, monthlyData: filteredMonthlyData };
};
const calculateRotacionCarteras = (groupedRecords) => {
  if (!groupedRecords || groupedRecords.length === 0) {
    return 0;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let firstMonthWithData = 11; // Inicializa con diciembre
  let firstMonthTotal = 0;
  let previousMonthTotal = 0;
  let totalHistorico = 0;
  let totalAdeuadoHistorico = 0;

  // Encuentra el primer mes con datos
  groupedRecords.forEach(client => {
    if (client.facturas && Array.isArray(client.facturas)) {
      client.facturas.forEach(factura => {
        const date = new Date(factura.fecha_factura);
        if (date.getFullYear() === currentYear) {
          firstMonthWithData = Math.min(firstMonthWithData, date.getMonth());
        }
      });
    }
  });

  let previousMonth = currentMonth - 1;
  if (previousMonth < 0) previousMonth = 11;

  groupedRecords.forEach(client => {
    if (client.facturas && Array.isArray(client.facturas)) {
      client.facturas.forEach(factura => {
        const date = new Date(factura.fecha_factura);
        const facturaYear = date.getFullYear();
        const facturaMonth = date.getMonth();

        if (facturaYear === currentYear) {
          if (facturaMonth === firstMonthWithData) {
            firstMonthTotal += factura.importe;
          }
          if (facturaMonth === previousMonth) {
            previousMonthTotal += factura.importe;
          }
        }

        if (facturaYear === currentYear && facturaMonth <= previousMonth) {
          totalHistorico += factura.importe;
          totalAdeuadoHistorico += factura.importe_total;
        }
      });
    }
  });

  if (previousMonthTotal === 0) {
    return 0;
  }

  const SumaMeses = firstMonthTotal + previousMonthTotal;
  const factorRotacion = SumaMeses / 2;
  const rotacionIntermediate = totalAdeuadoHistorico / factorRotacion;
  const rotacionCartera = 360 / rotacionIntermediate;

  // console.log(`Primer mes con datos: ${firstMonthWithData + 1}`);
  // console.log(`Total del primer mes con datos: ${firstMonthTotal}`);
  // console.log(`Total del mes anterior: ${previousMonthTotal}`);
  // console.log(`Total histórico: ${totalHistorico}`);
  // console.log(`Rotación de cartera: ${rotacionCartera}`);
  // console.log(`Suma de los meses: ${SumaMeses}`);

  return Math.round(rotacionCartera);
};


module.exports = {
  getOdooRecordsAndSums,
  getOdooRecordsAndSumas,
  fetchData,
  getOdooRecords,
  calculateRotacionCartera,
  calculateRotacionCarteras,
  calculateSums
};
