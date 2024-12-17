const mongoose = require('mongoose')


mongoose
.connect('mongodb+srv://favoursunday:favoursu55@cluster0.6es08zq.mongodb.net/realtors')
.then(() => console.log('connected to DB'))
.catch((err) => console.log(err));