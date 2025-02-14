require('dotenv').config(); // Load environment variables from .env file
const express = require("express");
const bodyParser = require('body-parser'); // Required if using express < 4.16.0


const mongoStore = require('connect-mongo');
const cors = require('cors');

require("./database/index")


//routes
const auth = require('./routes/auth')
const consult = require("./routes/consult")
const admin = require("./routes/admin")
const clients = require("./routes/client")


const app = express();
const PORT = 3005;

const allowedorigins = ['http://localhost:3001', 'http://localhost:3000', 'http://172.20.10.4:3000', 'http://localhost:5000', "https://baay-frontemd.onrender.com"];


// For parsing application/json
app.use(express.json()); // Built-in middleware since Express 4.16.0

// For parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: allowedorigins
}))



// Routes
app.use('/auth', auth);
app.use('/consult', consult);
app.use('/admin', admin);
app.use('/client', clients);




app.listen(PORT, () => console.log(`Running express server on ${PORT}`));
