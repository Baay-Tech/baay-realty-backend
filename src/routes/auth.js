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
    const client = await Client.findOne({ username });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const isMatch = await bcrypt.compare(password, client.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: client._id }, process.env.JWT_SECRET, { 
      expiresIn: '24h' 
    });

    const userData = client.toObject();
    delete userData.password;

    res.status(200).json({ token, user: userData });
  } catch (error) {
    console.log('Login error:', error);
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
      password, dob, gender, 
      // address, country, state,
      // accountName, accountNumber, bank, 
      referrerCode
    } = req.body;

    // Validate existing user
    const existingUser = await Realtor.findOne({
      $or: [{ email }, { phone }, { username }]
    }).session(session);

    if (existingUser) {
      let message = '';
      if (existingUser.email === email) message = 'Email already exists';
      else if (existingUser.phone === phone) message = 'Phone number already exists';
      else message = 'Username already exists';
      
      await session.abortTransaction();
      return res.status(400).json({ success: false, message });
    }

    // Find referring Realtor
    const referringRealtor = await Realtor.findOne({ 
      referrerId: referrerCode 
    }).session(session);

    if (!referringRealtor) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid referral code' 
      });
    }

    // Function to generate a random 5-digit referral ID number
    const generateReferralId = () => {
      return Math.floor(10000 + Math.random() * 90000).toString(); // Ensures a 5-digit number
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
      // address,
      // country,
      // state,
      // accountName,
      // accountNumber,
      // bank,
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
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          
          <!-- Header Section -->
          <div style="background-color: #002657; color: white; text-align: center; padding: 20px;">
            <h1 style="margin: 0;">Welcome to Baay Realty</h1>
            <p style="margin: 5px 0;">Your journey as a realtor starts now! 🚀</p>
          </div>
    
          <!-- Body Content -->
          <div style="padding: 20px;">
            <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
            <p>We are thrilled to welcome you as a realtor at Baay Realty. Below are your account details:</p>
    
            <!-- Realtor Details -->
            <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <h3 style="color: #002657;">🔹 Your Realtor Details</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Realtor ID:</strong> ${referrerIdNumber}</li>
                <li><strong>Username:</strong> ${username}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Phone:</strong> ${phone}</li>
              </ul>
            </div>
    
            <!-- Upline Information -->
            <div style="background: #f9f9f9; padding: 15px; border-radius: 6px;">
              <h3 style="color: #002657;">📢 Your Upline ConsuRealtorltant</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Name:</strong> ${referringRealtor.firstName} ${referringRealtor.lastName}</li>
                <li><strong>Phone:</strong> ${referringRealtor.phone}</li>
                <li><strong>Email:</strong> ${referringRealtor.email}</li>
              </ul>
            </div>
    
            <!-- Important Links -->
            <div style="text-align: center; margin: 25px 0;">
              <a href="${loginLink}" 
                style="background: #E5B305; color: white; padding: 12px 20px; 
                       text-decoration: none; border-radius: 5px; font-weight: bold;">
                🎯 Access Your Realtor Portal
              </a>
            </div>
    
            <p>Your referral link to invite others:</p>
            <p style="background: #002657; color: white; padding: 10px; text-align: center; border-radius: 5px;">
              <a href="${referralLink}" style="color: #E5B305; text-decoration: none;">
                ${referralLink}
              </a>
            </p>
    
            <p>If you have any questions, feel free to reach out to us:</p>
            <p>📞 <strong>+234 800 555 REAL (7325)</strong></p>
            <p>📧 <a href="mailto:support@baayrealty.com" style="color: #002657;">support@baayrealty.com</a></p>
          </div>
    
          <!-- Footer Section -->
          <div style="background-color: #002657; color: white; text-align: center; padding: 15px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Baay Realty. All Rights Reserved.</p>
          </div>
        
        </div>
      `
    };
    

    // Send email first
    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Email send error:', error);
          reject(error);
        } else {
          console.log('Email sent:', info.response);
          resolve(info);
        }
      });
    });

    // Update referring Realtor's referrals
    referringRealtor.Realtorreferrals.push({
      username: newRealtor.username,
      phone: newRealtor.phone,
      email: newRealtor.email
    });

    await referringRealtor.save({ session });

    // Save new Realtor
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