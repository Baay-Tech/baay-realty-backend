const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Properties = require("../database/schema/properties")
const Client = require("../database/schema/client")
const Realtor = require("../database/schema/realtor")
const nodemailer = require('nodemailer');
const Purchase = require("../database/schema/purchase")
// Get purchase stats
const mongoose = require('mongoose');

const Reminder = require("../database/schema/reminder")
const crypto = require("crypto")
const MessageSupport = require("../database/schema/realtormessage")


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


  const userEmailTemplate = (firstName, propertyName, portalLink) => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
      .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
      .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
      .content { padding: 20px; line-height: 1.6; }
      .button { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #E5B305; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; }
      .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Payment Proof Received</div>
      <div class="content">
        <p>Dear <strong>${firstName}</strong>,</p>
        <p>We have received your payment proof for <strong>Property: ${propertyName}</strong>. Our team will review and verify your payment shortly.</p>
        <p>You can track your progress on our client portal:</p>
        <a href="${portalLink}" class="button">Access Your Portal</a>
        <p>For any inquiries, feel free to contact our support team.</p>
        <p>Best regards,</p>
        <p><strong>Baay Realty Team</strong></p>
      </div>
      <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
    </div>
  </body>
  </html>
  `;

  const adminEmailTemplate = (firstName, lastName, phone, email, propertyName, amount, portalLink) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
    .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
    .content { padding: 20px; line-height: 1.6; }
    .button { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #E5B305; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; }
    .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">New Client Registration</div>
    <div class="content">
      <p>A new client has registered and submitted a payment proof.</p>
      <p><strong>Client Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Property:</strong> ${propertyName}</p>
      <p><strong>Amount Paid:</strong> ${amount}</p>
      <p>Please verify the payment in the admin portal:</p>
      <a href="${portalLink}" class="button">Admin Portal</a>
      <p>Best regards,</p>
      <p><strong>Baay Realty Team</strong></p>
    </div>
    <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
  </div>
</body>
</html>
`;
// Store OTPs temporarily (in production, use Redis or another database)
const otpStore = {};

// Generate OTP email template
const otpEmailTemplate = (name, otp) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
    .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
    .content { padding: 20px; line-height: 1.6; }
    .otp-code { font-size: 32px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 5px; color: #002657; }
    .expiry { text-align: center; color: #FF0000; margin-bottom: 20px; }
    .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Verification Code</div>
    <div class="content">
      <p>Dear <strong>${name}</strong>,</p>
      <p>Please use the following verification code to complete your registration with Baay Realty:</p>
      <div class="otp-code">${otp}</div>
      <p class="expiry">This code will expire in 15 minutes</p>
      <p>If you did not request this code, please ignore this email.</p>
      <p>Best regards,</p>
      <p><strong>Baay Realty Team</strong></p>
    </div>
    <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
  </div>
</body>
</html>
`;

// Route to generate and send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Store OTP with expiry time (15 minutes)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    
    otpStore[email] = {
      otp,
      expiry: expiryTime
    };
    
    // Send OTP email
    await transporter.sendMail({
      from: '"Baay Realty" <sanieldan@zohomail.com>',
      to: email,
      subject: 'Verification Code for Baay Realty Registration',
      html: otpEmailTemplate(name, otp)
    });
    
    res.status(200).json({ message: 'Verification code sent to your email' });
  } catch (error) {
    console.log('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});

// Route to verify OTP
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }
    
    const storedOtpData = otpStore[email];
    
    if (!storedOtpData) {
      return res.status(400).json({ message: 'No OTP found for this email' });
    }
    
    const currentTime = new Date();
    
    if (currentTime > storedOtpData.expiry) {
      delete otpStore[email];
      return res.status(400).json({ message: 'OTP has expired' });
    }
    
    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    
    // OTP is valid, delete it to prevent reuse
    delete otpStore[email];
    
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});


router.post('/signup', async (req, res) => {
    try {
        // Destructure all fields from the request body
        const {
            firstName,
            lastName,
            username,
            email,
            phone,
            password,
            dateOfBirth,
            gender,
            passportPhoto,
            address,
            city,
            state,
            country,
            zipCode,
            nextOfKinName,
            nextOfKinRelationship,
            nextOfKinEmail,
            nextOfKinPhone,
            occupation,
            officeAddress,
            propertyId,
            paymentMethod,
            amount,
           
            referralCode,
            termsAccepted,
            propertyName,
            propertyActualPrice
        } = req.body;


        // Validate required fields
        if (!firstName || !lastName || !username || !email || !phone || !password || !dateOfBirth || !gender || !passportPhoto || !address || !city || !state || !country || !zipCode || !nextOfKinName || !nextOfKinRelationship || !nextOfKinEmail || !nextOfKinPhone || !occupation || !officeAddress || !propertyId || !paymentMethod || !amount || !termsAccepted) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if email, phone, or username already exists
        const existingEmail = await Client.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const existingPhone = await Client.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({ message: 'Phone number already exists' });
        }

        const existingUsername = await Client.findOne({ username });
        if (existingUsername) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Check if referral code exists in Realtor
        let referrer = null;
        if (referralCode) {
            referrer = await Realtor.findOne({ referrerIdNumber: referralCode });
            if (!referrer) {
                return res.status(400).json({ message: 'Invalid referral code' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new Client({
            firstName,
            lastName,
            username,
            email,
            phone,
            password: hashedPassword,
            dateOfBirth,
            gender,
            passportPhoto,
            address: {
                street: address,
                city,
                state,
                country,
                zipCode,
            },
            nextOfKin: {
                name: nextOfKinName,
                relationship: nextOfKinRelationship,
                email: nextOfKinEmail,
                phone: nextOfKinPhone,
            },
            work: {
                name: occupation,
                address: officeAddress,
            },
            upline: referrer ? {
                name: `${referrer.firstName} ${referrer.lastName}`,
                phone: referrer.phone,
                email: referrer.email,
            } : null,
            termsAccepted,
        });

        // Create purchase record
        const purchase = new Purchase({
            client: user._id,
            ClientfirstName: firstName,
            ClientlastName: lastName,
            Clientphone: phone,
            Clientemail: email,
            property: propertyId,
            amount,
            paymentMethod,
            referralName: `${referrer.firstName} ${referrer.lastName}`,
            referralPhone: referrer.phone,
            referralEmail: referrer.email,
            propertyActualPrice,
            propertyName

        });

        console.log(user, purchase)

        // Send confirmation email to the user
        const portalLink = "https://portal.baayrealty.com"; // Replace with actual portal link


        const userEmailSent = await sendEmail(
            email,
            "Payment Proof Received - Baay Realty",
            userEmailTemplate(firstName, propertyName, portalLink)
          );
          


        if (!userEmailSent) {
            return res.status(500).json({ message: "Failed to send confirmation email" });
        }

      
          // For admin email
          const adminEmailSent = await sendEmail(
            ["Favoursunday600@gmail.com", "clientrelations.baaypoorojects@gmail.com"],
            "New Client Registered - Payment Verification Required",
            adminEmailTemplate(firstName, lastName, phone, email, propertyName, amount, portalLink)
          );

        if (!adminEmailSent) {
            return res.status(500).json({ message: "Failed to notify the admin team" });
        }

        // Save user and purchase records
        await user.save();
        await purchase.save();


        // If referred, add the new user to the referrer's `Clientreferrals` list
        if (referrer) {
            referrer.Clientreferrals.push({
                name: `${firstName} ${lastName}`,
                phone: phone,
                email: email,
            });
            await referrer.save();
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return success response
        res.status(201).json({
            token,
            user,
            purchase,
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Server error' });
    }
});





// Get properties endpoint
router.get('/properties', async (req, res) => {
  try {
    const properties = await Properties.find();
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/validate-referral/:referralId', async (req, res) => {
    try {
      const referrer = await Realtor.findOne({ referrerIdNumber: req.params.referralId });
      if (!referrer) {
        console.log('Referral code not found' )

        return res.status(404).json({ message: 'Referral code not found' });
      }

      res.json({
        firstName: referrer.firstName,
        lastName: referrer.lastName
      });

    } catch (error) {
      console.log(error)
      res.status(500).json({ message: 'Server error' });
    }
  });



  router.get('/purchases/stats/:clientId', async (req, res) => {
    try {
      const [totalPurchases, totalProperties] = await Promise.all([
        Purchase.aggregate([
          { 
            $match: { 
              client: new mongoose.Types.ObjectId(req.params.clientId), // Use `new` keyword
              status: 'confirmed' 
            } 
          },
          { 
            $group: { 
              _id: null, 
              total: { $sum: "$amount" } // Add dollar sign for field reference
            } 
          }
        ]),
        Purchase.countDocuments({ 
          client: new mongoose.Types.ObjectId(req.params.clientId), // Use `new` keyword
          status: 'confirmed' 
        })
      ]);
  
      res.json({
        totalPurchases: totalPurchases[0]?.total || 0,
        totalProperties: totalProperties || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });


router.get('/purchases', async (req, res) => {
try {
    const { status, search, _id } = req.query;

    // Validate client ID
    if (!mongoose.isValidObjectId(_id)) {
    return res.status(400).json({ message: 'Invalid client ID' });
    }

    const query = { client: _id }; // Mongoose will handle the conversion

    // Add status filter if provided
    if (status && ['pending', 'confirmed', 'failed'].includes(status)) {
    query.status = status;
    }

    // Add search filter if provided
    if (search) {
    query.$or = [
        { propertyName: { $regex: search, $options: 'i' } },
        { amount: Number(search) || 0 }
    ];
    }

    const purchases = await Purchase.find(query)
    .populate('property', 'name price')
    .sort({ createdAt: -1 });

    res.json(purchases);
} catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ message: 'Server error' });
}
});

  router.get('/properties', async (req, res) => {
    try {
      const properties = await Property.find();
      res.status(200).json(properties);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching properties', error });
    }
  });

  
router.post('/purchases', async (req, res) => {
try {
    const newPurchase = new Purchase(req.body);
    await newPurchase.save();

    // Email templates
    const userEmailTemplate = (firstName, propertyName, portalLink) => `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
        .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
        .content { padding: 20px; line-height: 1.6; }
        .button { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #E5B305; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; }
        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
        <div class="header">Property Purchase Confirmation</div>
        <div class="content">
            <p>Dear <strong>${firstName}</strong>,</p>
            <p>Congratulations on your purchase of <strong>Property: ${propertyName}</strong>!</p>
            <p>You can track your progress on our client portal:</p>
            <a href="${portalLink}" class="button">Access Your Portal</a>
            <p>For any inquiries, feel free to contact our support team.</p>
            <p>Best regards,</p>
            <p><strong>Baay Realty Team</strong></p>
        </div>
        <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
        </div>
    </body>
    </html>
    `;

    const adminEmailTemplate = (firstName, lastName, phone, email, propertyName, amount, portalLink) => `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
        .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
        .content { padding: 20px; line-height: 1.6; }
        .button { display: block; width: 200px; margin: 20px auto; padding: 10px; background: #E5B305; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; }
        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
        <div class="header">New Property Purchase</div>
        <div class="content">
            <p>A new property has been purchased by a client.</p>
            <p><strong>Client Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Property:</strong> ${propertyName}</p>
            <p><strong>Amount Paid:</strong> ${amount}</p>
            <p>Please review the details in the admin portal:</p>
            <a href="${portalLink}" class="button">Admin Portal</a>
            <p>Best regards,</p>
            <p><strong>Baay Realty Team</strong></p>
        </div>
        <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
        </div>
    </body>
    </html>
    `;

    // Send email to the client
    const userEmailSent = await sendEmail(
    newPurchase.Clientemail,
    "Property Purchase Confirmation - Baay Realty",
    userEmailTemplate(newPurchase.ClientfirstName, newPurchase.propertyName, "https://your-portal-link.com") // Replace with actual portal link
    );

    if (!userEmailSent) {
    return res.status(500).json({ message: "Failed to send confirmation email to client" });
    }

    // Send email to admin
    const adminEmailSent = await sendEmail(
    ["Favoursunday600@gmail.com", "clientrelations.baaypoorojects@gmail.com"],
    "New Property Purchase - Baay Realty",
    adminEmailTemplate(
        newPurchase.ClientfirstName,
        newPurchase.ClientlastName,
        newPurchase.Clientphone,
        newPurchase.Clientemail,
        newPurchase.propertyName,
        newPurchase.amount,
        "https://your-admin-portal-link.com" // Replace with actual admin portal link
    )
    );

    if (!adminEmailSent) {
    return res.status(500).json({ message: "Failed to send notification email to admin" });
    }

    res.status(201).json(newPurchase);
} catch (error) {
    res.status(500).json({ message: 'Error creating purchase', error });
}
});
  


router.put('/profile/:id', async (req, res) => {
try {
    const updatedClient = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedClient);
} catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
}
});

router.put('/client/password/:id', async (req, res) => {
try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const isMatch = await bcrypt.compare(req.body.currentPassword, client.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(req.body.newPassword, 10);
    client.password = hashedPassword;
    await client.save();

    res.status(200).json({ message: 'Password updated successfully' });
} catch (error) {
    res.status(500).json({ message: 'Error updating password', error });
}
});


router.get('/reminders', async (req, res) => {
try {
    const { email } = req.query;

    console.log(email)
    const reminders = await Reminder.find({ Clientemail: email });
    res.json(reminders);
} catch (error) {
    res.status(500).json({ message: error.message });
}
});


router.post('/support', async (req, res) => {
  try {
      console.log(req.body)
    const ticket = new MessageSupport({
      user: req.body.user,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      username: req.body.username,
      phone: req.body.phone,
      email: req.body.email,
      subject: req.body.subject,
      messages: [{
        sender: 'client',
        content: req.body.message
      }]
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    console.log('Error creating support ticket:', error);
    res.status(400).json({ error: error.message });
  }
});
  
  


module.exports = router;