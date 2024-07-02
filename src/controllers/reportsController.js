const odooService = require('../services/odooService');
const fs = require('fs');
const path = require('path');


exports.home = async (req, res) => {
  try {
    const records = await odooService.getOdooRecords();
    const { totalVencido, totalATiempo, totalCartera, sumsByRange, percentagesByRange, monthlyData } = 
      odooService.calculateSums(records);
    
    const uniqueKams = [...new Set(records.map(record => record.invoice_user_id[1]))];
    const uniqueClients = [...new Set(records.map(record => record.invoice_partner_display_name))];
    
    res.render('index', {records, totalCartera, totalVencido, totalATiempo, sumsByRange, percentagesByRange, monthlyData, uniqueKams, uniqueClients});
  } catch (error) {
    console.error('Error en el dashboard:', error);
    res.status(500).send('Error al cargar el dashboard');
  }
};
exports.getDashboardData = async (req, res) => {
    try {
        const { kam, client, date, channels } = req.query;
        const selectedDate = date ? new Date(date) : new Date();
        const selectedChannels = channels ? channels.split(',') : [];
        
        let records = await odooService.getOdooRecords();
        
        // Aplicar filtros
        if (kam) {
        records = records.filter(record => record.invoice_user_id[1] === kam);
    }
      if (client) {
        records = records.filter(record => record.invoice_partner_display_name === client);
      }
      if (selectedDate) {
        records = records.filter(record => new Date(record.invoice_date) <= selectedDate);
      }
  
      if (selectedChannels.length > 0) {
        const channelData = JSON.parse(fs.readFileSync('./Canales.json', 'utf8'));
        let clientsInSelectedChannels = new Set();
        let includeSpecialized = selectedChannels.includes('Especializados');
        let nonSpecializedClients = new Set();
        
        Object.entries(channelData.Canales).forEach(([channel, clients]) => {
            if (channel !== 'Canales Especializados') {
                clients.forEach(clientEntry => nonSpecializedClients.add(clientEntry.Cliente));
            }
            if (selectedChannels.includes(channel)) {
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
    
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthlyData = {};
    
    let totalVencido = 0;
      let totalATiempo = 0;
      let totalCartera = 0;
  
      const sumsByRange = {
        '0-15': 0,
        '16-30': 0,
        '31-45': 0,
        '46-60': 0,
        '61+': 0
    };
    
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
        totalCartera += amount;
        
        if (record.estado === 'vencido') {
          totalVencido += amount;
          monthlyData[month].totalVencido += amount;
        } else if (record.estado === 'a tiempo') {
            totalATiempo += amount;
            monthlyData[month].totalATiempo += amount;
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
      
      const rotacionCartera = odooService.calculateRotacionCartera(records);
      
      const percentagesByRange = Object.fromEntries(
        Object.entries(sumsByRange).map(([range, sum]) => [range, (sum / totalCartera * 100).toFixed(2)])
      );
  
      const totalAmountSigned = records.reduce((acc, record) => acc + parseFloat(record.amount_total_signed), 0);
  
      const groupedRecords = await odooService.getOdooRecordsAndSumas(records);
      
      res.json({
        totalVencido,
        totalATiempo,
        totalCartera,
        sumsByRange,
        percentagesByRange,
        monthlyData,
        rotacionCartera,
        totalAmountSigned,
        groupedRecords
    });
    } catch (error) {
        console.error('Error al obtener datos del dashboard:', error);
      res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
};
exports.report = async (req, res) => {
    try {
        const records = await odooService.getOdooRecords();
        const { totalVencido, totalATiempo, totalCartera, rotacionCartera } = await odooService.getOdooRecordsAndSums();
        const groupedRecords = await odooService.getOdooRecordsAndSumas(records);
        
        // Calcular el total de amount_total_signed
        const totalAmountSigned = records.reduce((acc, record) => acc + parseFloat(record.amount_total_signed), 0);
        
        // Obtener KAMs y clientes únicos
        const uniqueKams = [...new Set(records.map(record => record.invoice_user_id[1]))];
        const uniqueClients = [...new Set(records.map(record => record.invoice_partner_display_name))];

        // Obtener canales únicos (asumiendo que tienes esta información)
        const channelData = JSON.parse(fs.readFileSync('./Canales.json', 'utf8'));
        const uniqueChannels = Object.keys(channelData.Canales);
        // console.log('Rotación Cartera (días):', rotacionCartera);
        res.render('reporte', { 
            records, 
            totalCartera, 
            totalVencido, 
            totalATiempo, 
            totalAmountSigned, 
            groupedRecords, 
            rotacionCartera, 
            uniqueKams, 
            uniqueClients,
            uniqueChannels
        });
    } catch (error) {
        console.error('Error en el dashboard:', error);
        res.status(500).send('Error al cargar el dashboard');
    }
};
exports.getDashboardDatas = async (req, res) => {
  try {
    const { kam, client, date, channels } = req.query;
    const filters = {
      kam,
      client,
      date,
      channels: channels ? channels.split(',') : []
    };

    const groupedRecords = await odooService.getOdooRecordsAndSumas(filters);
    const { totalVencido, totalATiempo, totalCartera, sumsByRange, percentagesByRange, monthlyData } = odooService.calculateSums(groupedRecords);
    const rotacionCartera = odooService.calculateRotacionCarteras(groupedRecords);
    
    // Calculate totalAmountSigned using amount_total_signed
    const totalAmountSigned = groupedRecords.reduce((acc, record) => {
      return acc + record.facturas.reduce((facAcc, factura) => facAcc + factura.importe_total, 0);
    }, 0);

    res.json({
      totalVencido,
      totalATiempo,
      totalCartera,
      sumsByRange,
      percentagesByRange,
      monthlyData,
      rotacionCartera,
      groupedRecords,
      totalAmountSigned
    });
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    res.status(500).json({ error: 'Error al obtener datos del dashboard' });
  }
};