const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Realtor = require('../database/schema/realtor');
const router = express.Router();
const { hashPassword, comparePassword } = require("../helper/bcrypt");
const mongoose = require('mongoose');
const Client = require("../database/schema/client")
const nodemailer = require('nodemailer');

const Admin = require('../database/schema/admin');






const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: 'sanieldan@zohomail.com',
    pass: 'p8CtA0MtwP6E'
  }
});


  // Function to send an email
  const sendEmail = async (to, subject, htmlContent) => { // Changed parameter name
    try {
      await transporter.sendMail({
        from: '"Baay Realty" <sanieldan@zohomail.com>',
        to,
        subject,
        html: htmlContent // Changed from 'text' to 'html'
      });
      console.log(`Email sent to ${to}`);
      return true;
    } catch (error) {
      console.error("Email sending error:", error);
      return false;
    }
  };



router.post('/client/login', async (req, res) => {
  const { username, password } = req.body;


  try {
    // Check if client exists
    const client = await Client.findOne({ username });
    if (!client) {
      console.log('Client not found:', username);
      return res.status(404).json({ message: 'Username not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate token
    const token = jwt.sign({ userId: client._id }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    // Remove password from user data
    const userData = client.toObject();
    delete userData.password;

    res.status(200).json({ token, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
  



// In-memory OTP storage (in production, use Redis or database)
const otpStorage = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


// Check if email or username already exists
router.post('/realtor/check-availability', async (req, res) => {
  try {
    const { email, username } = req.body;
    
    const existingEmail = await Realtor.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already in use" });
    }
    
    const existingUsername = await Realtor.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }
    
    return res.status(200).json({ message: "Email and username are available" });
  } catch (error) {
    console.log("Error checking availability:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Send OTP
router.post('/realtor/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Generate a 6-digit OTP
    const otp = generateOTP();
    
    // Store OTP with expiry time (15 minutes)
    otpStorage.set(email, {
      otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    });
    
    // Send OTP via email
    const emailSubject = "Baay Realty - Email Verification";
    const emailText = `Your verification code is: ${otp}\n\nThis code will expire in 15 minutes.`;
    
    const emailSent = await sendEmail(email, emailSubject, emailText);
    
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send verification email" });
    }
    
    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
router.post('/realtor/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }
    
    const storedData = otpStorage.get(email);
    
    if (!storedData) {
      return res.status(400).json({ message: "No OTP found for this email. Please request a new code." });
    }
    
    if (new Date() > storedData.expiresAt) {
      otpStorage.delete(email);
      return res.status(400).json({ message: "OTP has expired. Please request a new code." });
    }
    
    if (storedData.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }
    
    // OTP verified successfully, remove it from storage
    otpStorage.delete(email);
    
    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


// Register user
router.post('/realtor/register', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      username, firstName, lastName, email, phone,
      password, dob, gender, referrer
    } = req.body;

    // Validate existing user
    const existingUser = await Realtor.findOne({
      $or: [{ email }, { phone }, { username }]
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      let message = existingUser.email === email ? 'Email already exists' :
                   existingUser.phone === phone ? 'Phone number already exists' :
                   'Username already exists';
      return res.status(400).json({ success: false, message });
    }

    // Find referring Realtor - USE findOne instead of find
    const referringRealtor = await Realtor.findOne({ referrerIdNumber: referrer }).session(session);

    if (!referringRealtor) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid referral code' 
      });
    }

    // Generate referral ID
    const generateReferralId = () => {
      return Math.floor(10000 + Math.random() * 90000).toString();
    };

    // Create new Realtor
    const hashedPassword = await hashPassword(password);
    const referrerIdNumber = generateReferralId();

    const newRealtor = new Realtor({
      referrerIdNumber,
      username,
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      dob: new Date(dob),
      gender,
      upline: {
        name: `${referringRealtor.firstName} ${referringRealtor.lastName}`,
        phone: referringRealtor.phone,
        email: referringRealtor.email
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newRealtor._id, role: 'realtor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email
    const loginLink = `${process.env.CLIENT_URL}/login`;
    const referralLink = `${process.env.CLIENT_URL}/register/${referrerIdNumber}`;

    const mailOptions = {
      to: newRealtor.email,
      from: '"Baay Realty" <sanieldan@zohomail.com>',
      subject: `🎉 Welcome to Baay Realty - Your Realtor Portal Access`,
      html: `...` // your email template
    };

    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) reject(error);
        else resolve(info);
      });
    });

    // FIXED: Properly update referring realtor's referrals
    if (!referringRealtor.Realtorreferrals) {
      referringRealtor.Realtorreferrals = [];
    }

    referringRealtor.Realtorreferrals.push({
      username: newRealtor.username,
      phone: newRealtor.phone,
      email: newRealtor.email,
      date: new Date()
    });

    await referringRealtor.save({ session });
    await newRealtor.save({ session });
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      newRealtor
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  } finally {
    session.endSession();
  }
});


// Realtor Login
router.post('/realtor/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log(req.body)

    // Find user
    const user = await Realtor.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'No user with this username exit' });
    }

    console.log(user.password)

    // Verify password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      console.log('Invalid password')
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id},
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data (excluding password)
    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
});




router.post("/admin/login", async (req, res) => {
  try {
    const { username, password, captcha, adminType } = req.body;
    
    // Validate required fields
    if (!username || !password || !captcha) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find the admin by username (email) and adminType
    const admin = await Admin.findOne({ 
      email: username,
      adminType: adminType 
    });

    if (!admin) {
      return res.status(401).json({ message: `Invalid ${adminType} credentials` });
    }

    // Compare password (assuming passwords are hashed with bcrypt)
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT with adminType included
    const token = jwt.sign(
      { id: admin._id, username: admin.email, adminType: admin.adminType }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    res.json({ 
      message: "Login successful", 
      token, 
      username: admin.email,
      adminType: admin.adminType,
      firstName: admin.firstName,
      lastName: admin.lastName
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post('/client/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    const user = await Realtor.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Return token and user data (excluding password)
    const userData = { ...user._doc };
    delete userData.password;

    res.status(200).json({ token, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;