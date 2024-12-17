const express = require('express');
const bcrypt = require('bcrypt');
const Consult = require('../database/schema/consult');
const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const {
      username, referrer, firstName, lastName, phone, email, dob,
      gender, address, country, state, accountName, accountNumber,
      bank, password
    } = req.body;

    console.log(req.body)

    // Check if user already exists
    const existingUser = await Consult.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      console.log('User already exists' )
      return res.status(400).json({ message: 'User already exists' });  
    }

    // Create a new user
    const newUser = new Consult({
      username, referrer, firstName, lastName, phone, email, dob,
      gender, address, country, state, accountName, accountNumber,
      bank, password
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
    console.log('User registered successfully')
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
