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

const Activity = require('../database/schema/acivity');


const logActivity = async (userId, userModel, role, activityType, description, req, metadata = {}) => {
  try {
    const activity = new Activity({
      userId,
      userModel,
      role,
      activityType,
      description,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata
    });
    
    await activity.save();
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};



const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@baayoperations.com',
    pass: 'w20KQTTcpWk1'
  }
});


  // Function to send an email
  const sendEmail = async (to, subject, htmlContent) => { // Changed parameter name
    try {
      await transporter.sendMail({
        from: '"Baay Realty" <noreply@baayoperations.com>',
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
      // Find user by username
      const user = await Client.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Compare passwords
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {

        return res.status(401).json({ message: 'Invalid password' });
      }
  
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, role: 'client' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Log successful login
      await logActivity(
        user._id,
        'client',
        'client',
        'login',
        'Successful login',
        req,
        {
          loginMethod: 'username_password',

        }
      );
  
      // Return token and user data (excluding password)
      const userData = { ...user._doc };
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
    console.log("Error sending OTP:", error);
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
    console.log("Error verifying OTP:", error);
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
      referrer
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

    const [month, day] = dob.split('/');
    const placeholderYear = 2000; // Using 2000 as placeholder year
    const isoDateString = `${placeholderYear}-${month}-${day}`;

    // Create Date object
    const formattedDob = new Date(isoDateString);


    // Validate date
    if (isNaN(formattedDob.getTime())) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format. Please use MM/DD (e.g. 06/15)' 
      });
    }

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

    console.log('New Realtor Data:', newRealtor);

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
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `🎉 Welcome to Baay Realty - Your Realtor Portal Access`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          
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
            <li><strong>Name:</strong> ${newRealtor.upline?.name || 'N/A'}</li>
            <li><strong>Phone:</strong> ${newRealtor.upline?.phone || 'N/A'}</li>
            <li><strong>Email:</strong> ${newRealtor.upline?.email || 'N/A'}</li>
          </ul>
        </div>

        <!-- Important Links -->
        <div style="text-align: center; margin: 25px 0;">
          <a href="https://associates.baayrealty.com" 
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
        <p>📞 <strong>+2348071260398</strong></p>
        <p>📧 <a href="clientrelations@baayprojects.com" style="color: #002657;">clientrelations@baayprojects.com</a></p>
      </div>

      <!-- Footer Section -->
      <div style="background-color: #002657; color: white; text-align: center; padding: 15px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Baay Realty. All Rights Reserved.</p>
      </div>
    
    </div>
  ` 
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

    await Activity.create({
      userId: newRealtor._id,
      userModel: 'Realtor',
      role: "realtor",
      activityType: 'Signup',
      description: 'Successful Signup',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

  
    const notification = {
      type: 'registration',
      title: 'New Realtor Registration',
      message: `${newRealtor.firstName} ${newRealtor.lastName} just registered as a Realtor`,
      timestamp: new Date().toISOString()
    };
    
    // Get the io instance and emit notification
    const io = req.app.locals.io;
    // Example: Send to all admins
    io.to('admin_room').emit('admin_notification', notification);

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
    console.log('Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  } finally {
    session.endSession();
  }
});


// Realtor Login with Activity Tracking
router.post('/realtor/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await Realtor.findOne({ username });
    if (!user) {
      
      return res.status(401).json({ message: 'No user with this username exists' });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful login
    await Activity.create({
      userId: user._id,
      userModel: 'Realtor',
      role: "realtor",
      activityType: 'login',
      description: 'Successful login',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        loginMethod: 'username_password',
      }
    });

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // Return user data (excluding password)
    const userData = user.toObject();
    delete userData.password;

    // Log successful login
    await logActivity(
      user._id,
      'Realtor',
      'realtor',
      'login',
      'Successful login',
      req,
      {
        loginMethod: 'username_password',
      }
    );


    res.status(200).json({
      message: 'Login successful',
      token,
      user: userData
    });

    

  } catch (error) {
    console.error('Login error:', error);
    
   
    
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
      await logActivity(
        null,
        'Admin',
        'admin',
        'login',
        'Failed login attempt - admin not found',
        req,
        {
          usernameAttempt: username,
          status: 'failed',
          reason: 'admin_not_found',
          adminType
        }
      );
      return res.status(401).json({ message: `Invalid ${adminType} credentials` });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await logActivity(
        admin._id,
        'Admin',
        'admin',
        'login',
        'Failed login attempt - incorrect password',
        req,
        {
          usernameAttempt: username,
          status: 'failed',
          reason: 'incorrect_password',
          adminType
        }
      );
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT with adminType included
    const token = jwt.sign(
      { id: admin._id, username: admin.email, role: 'admin', adminType: admin.adminType }, 
      process.env.JWT_SECRET, 
      { expiresIn: "24h" }
    );

    // Log successful login
    await logActivity(
      admin._id,
      'Admin',
      'admin',
      'login',
      'Successful admin login',
      req,
      {
        loginMethod: 'username_password',
        adminType: admin.adminType
      }
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
    await logActivity(
      null,
      'Admin',
      'admin',
      'login',
      'Admin login error occurred',
      req,
      {
        error: error.message,
        status: 'error',
        adminType: req.body.adminType
      }
    );
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;