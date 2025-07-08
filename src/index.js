require('dotenv').config();
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('¡Hola, mundo desde Express!');
});

app.listen(3000, () => {
  console.log('Servidor escuchando en puerto 3000');
});
