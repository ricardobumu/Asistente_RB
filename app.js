// app.js
require("dotenv").config();
const express = require("express");
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.status(200).json({ mensaje: "¡Servidor funcionando correctamente!" });
});

// Puerto de escucha
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
