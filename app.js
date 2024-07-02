const express = require('express');
const path = require('path');
require('dotenv').config();
const reportsController = require('./src/controllers/reportsController');
const favicon = require('serve-favicon');
const app = express();
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json()); // Asegúrate de agregar esto para poder analizar el cuerpo de las solicitudes POST
app.use(express.urlencoded({ extended: true })); // para parsear application/x-www-form-urlencoded
app.use('/static', express.static('public'));


app.get('/', reportsController.home);
app.get('/reporte', reportsController.report);
app.get('/api/dashboard-data', reportsController.getDashboardData);
app.get('/api/dashboard-datas', reportsController.getDashboardDatas);
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor ejecutándose en http://localhost:${port}`);
});
