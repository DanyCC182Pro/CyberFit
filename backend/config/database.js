// database.js
// Este archivo se encarga de conectar nuestro backend con MongoDB Atlas.

const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas correctamente');
  } catch (error) {
    console.error('Error al conectar con MongoDB Atlas:', error.message);
    process.exit(1); // Detiene la aplicación si no hay base de datos: sin BD no tiene sentido seguir
  }
}

module.exports = connectDB;
