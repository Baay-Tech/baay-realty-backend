const express = require('express');
const router = express.Router();
const RealtorUser = require('../database/schema/realtor');
const Realtorwithdrawalrequest = require("../database/schema/realtorwithdrawalrequest"); // Renamed for clarity
const commissionactivation = require("../database/schema/commissionactivation")
const Funduploads = require("../database/schema/fundupload")

const BirthdayMessage = require("../database/schema/birthdaymessage")
const Property = require("../database/schema/properties")

const Messages = require("../database/schema/realtormessage")

const FAQ = require("../database/schema/faq")


const Client = require("../database/schema/client")


const nodemailer = require('nodemailer');

const Purchase = require("../database/schema/purchase")

const Commission = require("../database/schema/commission")
const mongoose = require('mongoose');
const Reminder = require("../database/schema/reminder")
const Admin = require('../database/schema/admin');
const bcrypt = require("bcryptjs")
const PendingTestimonials = require("../database/schema/PendingTestimonialsSchema")
const Testimonial = require("../database/schema/Testimonial")

const Activity = require('../database/schema/acivity');



const logActivity = async (userId, userModel, role, activityType, description, metadata = {}, req) => {
  try {
    const activityData = {
      userModel,
      role,
      activityType,
      description,
      metadata
    };

    // Add user agent if request object is provided
    if (req && req.headers) {
      activityData.userAgent = req.headers['user-agent'];
    }

    // Only add userId if provided
    if (userId) {
      activityData.userId = userId;
    }

    await Activity.create(activityData);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};



// Email Transporter Configuration
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
  const sendEmail = async (to, subject, text) => {
    try {
      await transporter.sendMail({
        from: '"Baay Realty" <sanieldan@zohomail.com>',
        to,
        subject,
        text
      });
      console.log(`Email sent to ${to}`);
      return true;
    } catch (error) {
      console.error("Email sending error:", error);
      return false;
    }
  };
  

  router.get('/dashboard-stats', async (req, res) => {
    try {
      const [totalRealtor, totalWithdrawals, pendingWithdrawals, totalPropertiesBought, totalAmount] = await Promise.all([
        RealtorUser.countDocuments(),
        Realtorwithdrawalrequest.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Realtorwithdrawalrequest.aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Purchase.countDocuments(),
        Purchase.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
      ]);

      console.log(totalRealtor)
  
      res.json({
        totalRealtor,
        totalWithdrawn: totalWithdrawals[0]?.total || 0,
        pendingWithdrawals: pendingWithdrawals[0]?.total || 0,
        totalPropertiesBought: totalPropertiesBought,
        totalAmount: totalAmount[0]?.total || 0
      });
  
    } catch (error) {
      console.log('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });


  router.get('/admin-dashboard-stats', async (req, res) => {
    try {
      const [totalRealtors, totalWithdrawals, pendingWithdrawals] = await Promise.all([
        RealtorUser.countDocuments(),
        Realtorwithdrawalrequest.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]),
        Realtorwithdrawalrequest.aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
      ]);
  
      res.json({
        totalRealtors, // Ensure this matches the expected key in the frontend
        totalWithdrawn: totalWithdrawals[0]?.total || 0,
        pendingWithdrawals: pendingWithdrawals[0]?.total || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

router.get("/commissions", async (req, res) => {
    try {
      const commissions = await commissionactivation();
     
      console.log(commissions);
      res.status(200).json(commissions);
    } catch (error) {
      console.log("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });
  
  // POST /api/commissions - Save new commissions
router.post("/commissions", async(req, res) => {
  try {
    const { IndirectCommission, DirectCommission } = req.body;


    const newCommission = new commissionactivation({
      IndirectCommission,
      DirectCommission,
      timestamp: new Date(),
    });
    
    await newCommission.save();

    // Respond with success message
    res.status(201).json({ message: "Commissions updated successfully", data: newCommission });
  } catch (error) {
    console.log("Error saving commissions:", error);
    res.status(500).json({ message: "Failed to update commissions" });
  }
});


// Get all funds
router.get('/funds', async (req, res) => {
    try {
        // Fetch all funds and populate the 'RealtorSchema' field with 'username' and 'fullName' from realtorUser
        const funds = await Funduploads.find()
        res.json(funds);
    } catch (error) {
        console.log("Error fetching funds:", error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.put('/funds/:id', async (req, res) => {
  try {
    const { status, amount } = req.body;
    const { id } = req.params;
    const io = req.app.get('io');
    const connectedUsers = req.app.get('connectedUsers');

    console.log(req.body);

    const fund = await Funduploads.findById(new mongoose.Types.ObjectId(id));

    console.log("Fund Record:", fund);
    if (!fund) {
      console.log('Fund request not found in DB');
      return res.status(404).json({ message: 'Fund request not found' });
    }

    const { email, firstName, lastName, user } = fund;

   // Log admin activity (pass req as last parameter)
   await logActivity(
    null,
    'Admin',
    "admin",
    'fund_approval',
    'fund request',
    {
      fundId: id,
      amount: amount,
      status: status,
      userId: user,
      userEmail: email
    },
    req // Add this parameter
  );

  // Log user activity (pass req as last parameter)
  await logActivity(
    user,
    'Realtor',
    'realtor',
    'fund_status_update',
    `Your fund request was ${status} by admin`,
    {
      fundId: id,
      amount: amount,
      status: status,
      adminName: 'admin'
    },
    req // Add this parameter
  );

    if (!user) {
      console.log('User ID is missing in the fund document');
      return res.status(400).json({ message: 'User ID is missing in the fund document' });
    }

    let subject, htmlContent;

    if (status === "approved") {
      subject = "🎉 Funds Payment Approved!";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #002657; padding: 20px; text-align: center; color: white;">
            <h2>Funds Payment Approved</h2>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <p style="font-size: 16px; color: #333;">Dear <strong>${firstName} ${lastName}</strong>,</p>
            <p style="font-size: 16px; color: #333;">
              Great news! Your funds payment request has been <strong style="color: #E5B305;">approved</strong>. 
              Please check your dashboard for confirmation.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard" 
                style="background-color: #E5B305; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            <p style="font-size: 16px; color: #333;">
              If you have any questions, please contact our support team.
            </p>
          </div>
          <div style="background-color: #002657; padding: 10px; text-align: center; color: white;">
            <p>📞 +2348071260398 | 📧 clientrelations.baayprojects@gmail.com</p>
          </div>
        </div>
      `;

      try {

        // Send notification to realtor
      io.to(`realtor_${user}`).emit('notification', {
        title: 'Funds Approved',
        message: `Your fund request of ₦${amount} has been approved`,
        type: 'fund_approved',
        amount: amount,
        timestamp: new Date()
      });
        // Update the user's funding and balance
        const userDoc = await RealtorUser.findById(user);
        if (!userDoc) {
          console.log('User not found');
          return res.status(404).json({ message: 'User not found' });
        }

        // Parse amount and current balance as numbers
        const numericAmount = parseFloat(amount);
        let currentBalance = 0;

        // Initialize balance if it doesn't exist or convert from string
        if (userDoc.balance) {
          currentBalance = parseFloat(userDoc.balance);
        }

        // Initialize funding if it doesn't exist
        if (!userDoc.funding) {
          userDoc.funding = 0;
        }

        // Update funding and balance with numeric values
        userDoc.funding = parseFloat(userDoc.funding) + numericAmount;
        userDoc.balance = currentBalance + numericAmount;

        // Save the updated user document
        await userDoc.save();

      } catch (error) {
        console.log('Error updating user balance:', error);
        return res.status(500).json({ message: 'Error updating user balance' });
      }

    } else if (status === "rejected") {
      subject = "⚠️ Funds Payment Rejected!";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
          <div style="background-color: #002657; padding: 20px; text-align: center; color: white;">
            <h2>Funds Payment Rejected</h2>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <p style="font-size: 16px; color: #333;">Dear <strong>${firstName} ${lastName}</strong>,</p>
            <p style="font-size: 16px; color: #333;">
              Unfortunately, your funds payment request has been <strong style="color: red;">rejected</strong>. 
              We were unable to verify it. Please contact our support team so we can assist you.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="mailto:clientrelations.baayprojects@gmail.com" 
                style="background-color: #E5B305; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; font-size: 16px;">
                Contact Support
              </a>
            </div>
            <p style="font-size: 16px; color: #333;">
              We appreciate your understanding.
            </p>
          </div>
          <div style="background-color: #002657; padding: 10px; text-align: center; color: white;">
            <p>📞 +2348071260398 | 📧 clientrelations.baayprojects@gmail.com</p>
          </div>
        </div>
      `;
    } else {
      // Send rejection notification to realtor
      io.to(`realtor_${user}`).emit('notification', {
        title: 'Funds Rejected',
        message: `Your fund request of ₦${amount} was rejected`,
        type: 'fund_rejected',
        amount: amount,
        timestamp: new Date()
      });
      return res.status(400).json({ message: "Invalid status" });
    }

    // Send email
    const emailSent = await sendEmail(email, subject, htmlContent);
    if (!emailSent) {
      console.log('Failed to send email');
      return res.status(500).json({ message: "Failed to send email" });
    }

    // Update the fund status
    const updatedFund = await Funduploads.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.json(updatedFund);
  } catch (error) {
    console.log("Error updating fund status:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

  
  // Delete fund request
  router.delete('/funds/:id', async (req, res) => {
    try {
      const fund = await Funduploads.findByIdAndDelete(req.params.id);
      if (!fund) return res.status(404).json({ message: 'Fund request not found' });
      res.json({ message: 'Fund request deleted' });
    } catch (error) {
        console.log("Error saving commissions:", error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  router.get('/birthday-message', async (req, res) => {
    try {
      const message = await BirthdayMessage.findOne().sort({ createdAt: -1 });
      res.json(message);
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  });
  
  // Create/Update message
  router.post('/birthday-message', async (req, res) => {
    try {
      const { message } = req.body;
      
      // Find the most recent message
      let birthdayMessage = await BirthdayMessage.findOne().sort({ createdAt: -1 });
  
      if (birthdayMessage) {
        // Update existing message
        birthdayMessage.message = message;
        birthdayMessage.updatedAt = Date.now();
      } else {
        // Create new message
        birthdayMessage = new BirthdayMessage({ message });
      }
  
      await birthdayMessage.save();
      res.json(birthdayMessage);
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  });

// Route to fetch today's birthdays
router.get('/todays-birthdays', async (req, res) => {
  try {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // Months are 0-indexed in JavaScript

    // Fetch realtors with today's birthday
    const realtors = await RealtorUser.find({
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: '$dob' }, day] },
          { $eq: [{ $month: '$dob' }, month] },
        ],
      },
    });

    // Fetch clients with today's birthday
    const clients = await Client.find({
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: '$dateOfBirth' }, day] },
          { $eq: [{ $month: '$dateOfBirth' }, month] },
        ],
      },
    });

    // Combine results and add a 'type' field
    const birthdays = [
      ...realtors.map((realtor) => ({ ...realtor.toObject(), type: 'Realtor' })),
      ...clients.map((client) => ({ ...client.toObject(), type: 'Client' })),
    ];

    res.json(birthdays);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});


// Get withdrawals by status
router.get('/withdrawals/:status', async (req, res) => {
    try {
      const { status } = req.params;
      const requests = await Realtorwithdrawalrequest.find({ status })
        .sort({ timestamp: -1 })
        .lean();
      res.json(requests);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
// Update withdrawal status
router.put('/withdrawals/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const withdrawal = await Realtorwithdrawalrequest.findById(req.params.id);
        const io = req.app.get('io');

        if (!withdrawal) return res.status(404).json({ message: 'Withdrawal request not found' });

        const { email, firstName, lastName } = withdrawal;
        let subject, htmlContent;

        // Log admin activity
    await logActivity(
      null,
      'Admin',
       "admin", // 'admin' or 'superadmin'
      'withdrawal_approval',
      'withdrawal request',
      {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: status,
        userId: withdrawal.user,
        userEmail: email
      }
    );

    await logActivity(
      withdrawal.user,
      'Realtor',
      'realtor',
      'withdrawal_status_update',
      `Your withdrawal request was ${status} by admin`,
      {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: status,
      }
    );

        if (status === "approved") {
            subject = "✅ Withdrawal Request Approved!";
            htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                    <div style="background-color: #002657; padding: 20px; text-align: center; color: white;">
                        <h2>Withdrawal Request Approved</h2>
                    </div>
                    <div style="padding: 20px; background-color: #f9f9f9;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>${firstName} ${lastName}</strong>,</p>
                        <p style="font-size: 16px; color: #333;">
                            Your withdrawal request has been <strong style="color: #E5B305;">approved</strong> and will be processed soon. 
                            You will receive the funds in your designated account shortly.
                        </p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${process.env.CLIENT_URL}/dashboard" 
                               style="background-color: #E5B305; color: white; padding: 10px 20px; 
                                      text-decoration: none; border-radius: 5px; font-size: 16px;">
                                View Dashboard
                            </a>
                        </div>
                        <p style="font-size: 16px; color: #333;">
                            If you have any questions, feel free to contact our support team.
                        </p>
                    </div>
                    <div style="background-color: #002657; padding: 10px; text-align: center; color: white;">
                        <p>📞 +234 800 555 REAL (7325) | 📧 support@baayrealty.com</p>
                    </div>
                </div>
            `;

             // Send approval notification to realtor
      io.to(`realtor_${withdrawal.user}`).emit('notification', {
        title: 'Withdrawal Approved',
        message: `Your withdrawal request of ₦${withdrawal.amount} has been approved`,
        type: 'withdrawal_approved',
        amount: withdrawal.amount,
        timestamp: new Date()
      });
        } else if (status === "rejected") {
            subject = "⚠️ Withdrawal Request Rejected!";
            htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                    <div style="background-color: #002657; padding: 20px; text-align: center; color: white;">
                        <h2>Withdrawal Request Rejected</h2>
                    </div>
                    <div style="padding: 20px; background-color: #f9f9f9;">
                        <p style="font-size: 16px; color: #333;">Dear <strong>${firstName} ${lastName}</strong>,</p>
                        <p style="font-size: 16px; color: #333;">
                            Unfortunately, your withdrawal request has been <strong style="color: red;">rejected</strong>. 
                            This may be due to incomplete information or other verification issues. 
                            Please contact our support team for more details.
                        </p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="mailto:support@baayrealty.com" 
                               style="background-color: #E5B305; color: white; padding: 10px 20px; 
                                      text-decoration: none; border-radius: 5px; font-size: 16px;">
                                Contact Support
                            </a>
                        </div>
                        <p style="font-size: 16px; color: #333;">
                            We appreciate your understanding.
                        </p>
                    </div>
                    <div style="background-color: #002657; padding: 10px; text-align: center; color: white;">
                        <p>📞 +234 800 555 REAL (7325) | 📧 support@baayrealty.com</p>
                    </div>
                </div>
            `;
            // Send rejection notification to realtor
      io.to(`realtor_${withdrawal.user}`).emit('notification', {
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request of ₦${withdrawal.amount} was rejected`,
        type: 'withdrawal_rejected',
        amount: withdrawal.amount,
        timestamp: new Date()
      });
        } else {
            return res.status(400).json({ message: "Invalid status" });
        }

        // Send email
        const emailSent = await sendEmail(email, subject, htmlContent);
        if (!emailSent) return res.status(500).json({ message: "Failed to send email" });

        // Update the withdrawal status only if the email was sent successfully
        const updatedRequest = await Realtorwithdrawalrequest.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        res.json(updatedRequest);
    } catch (error) {
        console.error("Error updating withdrawal status:", error);
        res.status(500).json({ message: 'Server error' });
    }
});



const sendPropertyEmail = async (to, property) => {
  try {
    // Create HTML content for email with images and property details
    const htmlContent = `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #002657; color: #E5B30F; padding: 15px; text-align: center; }
          .property-details { padding: 20px; }
          .property-image { width: 100%; max-height: 300px; object-fit: cover; margin-bottom: 20px; }
          .gallery { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
          .gallery-image { width: 150px; height: 100px; object-fit: cover; }
          .detail-row { margin-bottom: 10px; }
          .detail-label { font-weight: bold; }
          .price { font-size: 24px; font-weight: bold; color: #002657; margin: 10px 0; }
          .description { margin: 15px 0; line-height: 1.8; }
          .button { display: inline-block; background-color: #E5B30F; color: #002657; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Property Listed!</h1>
          </div>
          <div class="property-details">
            <img src="${property.featuredImage}" alt="${property.propertyName}" class="property-image">
            
            <h2>${property.propertyName}</h2>
            <div class="price">₦${property.amount.toLocaleString()}</div>
            
            <div class="detail-row">
              <span class="detail-label">Location:</span> ${property.city}, ${property.state}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Property Type:</span> ${property.propertyType}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Status:</span> ${property.propertyStatus}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Bedrooms:</span> ${property.bedrooms}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Bathrooms:</span> ${property.bathrooms}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Land Size:</span> ${property.landSize}
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Commission:</span> ${property.commission}%
            </div>
            
            <div class="description">
              ${property.description}
            </div>
            
            <h3>Gallery Images</h3>
            <div class="gallery">
              ${property.galleryImages.map(img => 
                `<img src="${img}" alt="Property Image" class="gallery-image">`
              ).join('')}
            </div>
            
            <a href="https://baayrealty.com/properties/${property._id}" class="button">View Property</a>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Baay Realty. All rights reserved.</p>
              <p>This email was sent to you because you are registered with Baay Realty.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: '"Baay Realty" <sanieldan@zohomail.com>',
      to,
      subject: `New Property: ${property.propertyName}`,
      html: htmlContent
    });
    console.log(`Property email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

// Modified Router for property creation that also sends emails
router.post('/properties', async (req, res) => {
  try {
    const { 
      propertyName,
      amount,
      state,
      city,
      propertyType,
      propertyStatus,
      bedrooms,
      bathrooms,
      landSize,
      description,
      featuredImage,
      galleryImages,
      subscriptionForm,
      commission,
      indirectcommission
    } = req.body;

    const io = req.app.get('io');

    console.log("Creating new property:", req.body);

    const newProperty = new Property({
      propertyName,
      amount,
      state,
      city,
      propertyType,
      propertyStatus,
      bedrooms,
      bathrooms,
      landSize,
      description,
      featuredImage,
      galleryImages,
      subscriptionForm,
      commission,
      indirectcommission
    });

    // Save the property first
    const savedProperty = await newProperty.save();
    
    // After saving, fetch all realtors and clients to send them emails
    console.log("Property saved, fetching recipients for email notifications...");
    
    // Get all realtors' emails
    const realtors = await RealtorUser.find().select('email');
    const realtorEmails = realtors.map(realtor => realtor.email);
    
    // Get all clients' emails
    const clients = await Client.find().select('email');
    const clientEmails = clients.map(client => client.email);
    
    // Combine all recipient emails
    const allRecipients = [...realtorEmails, ...clientEmails];
    
    console.log(`Sending property notification to ${allRecipients.length} recipients...`);
    
    // Send emails in batches to avoid overwhelming the mail server
    const batchSize = 50;
    for (let i = 0; i < allRecipients.length; i += batchSize) {
      const batch = allRecipients.slice(i, i + batchSize);
      
      // Process each recipient in the batch
      await Promise.all(batch.map(async (email) => {
        try {
          await sendPropertyEmail(email, savedProperty);
        } catch (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError);
          // Continue with other emails even if one fails
        }
      }));
      
      // Add a small delay between batches to prevent rate limiting
      if (i + batchSize < allRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Send notification to each realtor
    realtors.forEach(realtor => {
      io.to(`realtor_${realtor._id}`).emit('notification', {
        title: 'New Property Available',
        message: `A new property "${savedProperty.propertyName}" has been added`,
        type: 'new_property',
        propertyId: savedProperty._id,
        timestamp: new Date()
      });
    });
    
    console.log("Property notification emails sent successfully");
    
    // Send successful response
    res.status(201).json({
      message: 'Property created and notification emails sent successfully',
      property: savedProperty
    });
  } catch (error) {
    console.error("Error in property creation:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all properties
router.get('/properties', async (req, res) => {
    try {
      const { category, search } = req.query;
      const query = {};
      if (category && category !== 'All') query.propertyType = category;
      if (search) query.propertyName = new RegExp(search, 'i');
      
      const properties = await Property.find(query);
      res.json(properties);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Get single property
  router.get('/properties/:id', async (req, res) => {
    try {
      const property = await Property.findById(req.params.id);
      if (!property) return res.status(404).json({ message: 'Property not found' });
      res.json(property);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Update property
router.put('/properties/:id', async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(property);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
  
// Delete property
router.delete('/properties/:id', async (req, res) => {
  try {
    await Property.findByIdAndDelete(req.params.id);
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Add FAQ
router.post("/faq", async (req, res) => {
    try {
      const { property, question, answer } = req.body;
      const newFAQ = new FAQ({ property, question, answer });
      await newFAQ.save();
      res.status(201).json({ message: "FAQ added successfully", data: newFAQ });
    } catch (err) {
      res.status(500).json({ message: "Failed to add FAQ", error: err.message });
    }
});
  
  // Fetch all properties for dropdown
  router.get("/faq/properties", async (req, res) => {
    try {
      const properties = await Property.find({}, "propertyName"); // Fetch only property names
      console.log(properties)
      res.json(properties);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch properties", error: err.message });
    }
  });

// Get all FAQs
router.get('/view/faq', async (req, res) => {
    try {
      const faqs = await FAQ.find().sort({ createdAt: -1 });
      res.json(faqs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Update FAQ
  router.put('/faq/:id', async (req, res) => {
    try {
      const updatedFAQ = await FAQ.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(updatedFAQ);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  
  // Delete FAQ
  router.delete('/faq/:id', async (req, res) => {
    try {
      await FAQ.findByIdAndDelete(req.params.id);
      res.json({ message: 'FAQ deleted successfully' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

// Get all support tickets with realtors user details
router.get("/ticket", async (req, res) => {
    try {
      // First get all tickets
      const tickets = await Messages.find().sort({ createdAt: -1 });
  
      // Extract all user IDs from tickets
      const userIds = tickets.map(ticket => ticket.user);
  
      // Get realtors users in one query
      const Realtoruser = await RealtorUser.find(
        { _id: { $in: userIds } },
        'username firstName lastName phone email'
      );
  
      // Create a map for quick lookup
      const userMap = {};
      Realtoruser.forEach(user => {
        userMap[user._id.toString()] = {
          username: user.username,
          name: `${user.firstName} ${user.lastName}`,
          phone: user.phone,
          email: user.email
        };
      });
  
      // Combine tickets with user data
      const ticketsWithUserData = tickets.map(ticket => ({
        ...ticket.toObject(),
        user: userMap[ticket.user.toString()] || { username: 'Unknown User' }
      }));
  
      res.json(ticketsWithUserData);
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ 
        message: "Failed to fetch tickets",
        error: err.message 
      });
    }
  });
  
  // Admin replies to a ticket
  router.post("/ticket/:id/reply", async (req, res) => {
    try {
      const { content } = req.body;
      const { io } = req.app.locals;
      const ticket = await Messages.findById(req.params.id);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
  
      // Add admin reply
      ticket.messages.push({ sender: "admin", content });
      ticket.status = "pending";
      ticket.updatedAt = Date.now();
      
      await ticket.save();
  
      // Determine user type (default to 'client' if not specified)
      const userType = ticket.userType || 'client';
      const roomName = `${userType}_${ticket.user}`;
      
      console.log(`Preparing to notify ${roomName} about ticket reply`);
  
      // Create notification payload
      const notification = {
        title: 'New Reply to Your Ticket',
        message: `Admin replied to your support ticket: ${ticket.subject}`,
        type: 'support_reply',
        ticketId: ticket._id,
        timestamp: new Date()
      };
  
      // Log activity
      await Activity.create({
        userId: ticket.user,
        userModel: userType === 'client' ? 'client' : 'Realtor',
        role: userType,
        activityType: 'support_message',
        description: 'You have a new reply to your support ticket',
        metadata: {
          ticketId: ticket._id,
          subject: ticket.subject,
          content: content
        }
      });
  
      // Send notification to specific room
      console.log(`Emitting to room: ${roomName}`);
      io.to(roomName).emit('notification', notification);
      console.log('Notification emitted:', notification);
  
      res.json({ message: "Reply sent successfully", ticket });
    } catch (err) {
      console.error("Error in ticket reply:", err);
      res.status(500).json({ message: "Failed to send reply", error: err.message });
    }
  });
  
// Get all realtors with sorting
router.get('/viewrealtors', async (req, res) => {
  try {
    const { search, sortOrder, startDate, endDate } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { username: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const realtor = await RealtorUser.find(filter)
      .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 });

    res.json(realtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/viewrealtors/:id', async (req, res) => {
  try {
      const realtor = await RealtorUser.findById(req.params.id).select('-password');
      if (!realtor) {
        return res.status(404).json({ message: 'Realtor not found' });
      }
      res.status(200).json(realtor);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching realtor' });
    }
});

  // Update realtors
  router.put('/editrealtors/:id', async (req, res) => {
    try {
        const allowedUpdates = [
          'firstName', 'lastName', 'phone', 'email', 'address',
          'country', 'state', 'accountName', 'accountNumber', 'bank'
        ];
        
        const updates = Object.keys(req.body)
          .filter(key => allowedUpdates.includes(key))
          .reduce((obj, key) => {
            obj[key] = req.body[key];
            return obj;
          }, {});
    
        const realtor = await RealtorUser.findByIdAndUpdate(
          req.params.id,
          updates,
          { new: true, runValidators: true }
        ).select('-password');
    
        if (!realtor) {
          return res.status(404).json({ message: 'Realtors not found' });
        }
        
        res.status(200).json(realtor);
      } catch (error) {
        res.status(500).json({ message: 'Error updating realtor' });
      }
});
  
  // Delete realtors
router.delete('/delete/:id', async (req, res) => {
  try {
      const realtor = await RealtorUser.findByIdAndDelete(req.params.id);
      if (!realtor) {
        return res.status(404).json({ message: 'realtor not found' });
      }
      res.status(200).json({ message: 'Realtor deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting realtor' });
    }
});


  router.post('/send-birthday-email', async (req, res) => {
    const { email, message } = req.body;
  
    try {
      await transporter.sendMail({
        from: '"Baay Realty" <sanieldan@zohomail.com>',
        to: email,
        subject: 'Happy Birthday!',
        html: `
          <div style="font-family: Arial, sans-serif; color: #002657; text-align: center;">
            <h1 style="color: #E5B30F;">🎉 Happy Birthday! 🎉</h1>
            <p style="font-size: 16px;">${message}</p>
            <p style="font-size: 14px; color: #666;">Wishing you a fantastic day filled with joy and laughter!</p>
          </div>
        `
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ success: false });
    }
  });


  // Get all clients with search and sort
router.get('/clients', async (req, res) => {
  try {
    const { search, sortBy, sortOrder } = req.query;
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by latest
    }

    const clients = await Client.find(query)
      .sort(sort)
      .select('-password -__v'); // Exclude password and version key

    res.json(clients);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single client
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select('-password -__v');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update client
router.put('/clients/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password -__v');
    
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete client
router.delete('/clients/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/purchases/pending', async (req, res) => {
  try {
    const purchases = await Purchase.find({ status: 'pending' })
  
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/purchases/approved', async (req, res) => {
  try {
    const purchases = await Purchase.find({ status: 'confirmed' })
  
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/purchases/rejected', async (req, res) => {
  try {
    const purchases = await Purchase.find({ status: 'rejected' })
  
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


const clientEmailTemplate = (firstName, propertyName) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; background: #fff; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
    .header { background: #002657; color: #fff; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; }
    .content { padding: 20px; line-height: 1.6; }
    .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Payment Proof Confirmed</div>
    <div class="content">
      <p>Dear <strong>${firstName}</strong>,</p>
      <p>Your payment proof for <strong>Property: ${propertyName}</strong> has been confirmed.</p>
      <p>Please check your dashboard for more details.</p>
      <p>Best regards,</p>
      <p><strong>Baay Realty Team</strong></p>
    </div>
    <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
  </div>
</body>
</html>
`;

const directCommissionEmailTemplate = (firstName, propertyName, propertyPrice, clientFullName, clientEmail, clientPhone, commissionAmount) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    /* ... (keep existing styles the same) ... */
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Direct Commission Received</div> <!-- Changed header -->
    <div class="content">
      <p>Dear <strong>${firstName}</strong>,</p>
      <p>You have received a <strong>DIRECT COMMISSION</strong> for <strong>Property: ${propertyName}</strong> 
      (Price: ${propertyPrice}) purchased by <strong>${clientFullName}</strong> 
      (Email: ${clientEmail}, Phone: ${clientPhone}).</p> <!-- Explicit direct mention -->
      <p>Your direct commission received is <strong>${commissionAmount}</strong>.</p>
      <p>Please check your dashboard for more details.</p>
      <p>Best regards,</p>
      <p><strong>Baay Realty Team</strong></p>
    </div>
    <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
  </div>
</body>
</html>
`;

const indirectCommissionEmailTemplate = (firstName, propertyName, propertyPrice, clientFullName, clientEmail, clientPhone, commissionAmount) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    /* ... (keep existing styles the same) ... */
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Indirect Commission Received</div> <!-- Changed header -->
    <div class="content">
      <p>Dear <strong>${firstName}</strong>,</p>
      <p>You have received an <strong>INDIRECT COMMISSION</strong> for <strong>Property: ${propertyName}</strong> 
      (Price: ${propertyPrice}) purchased by <strong>${clientFullName}</strong> 
      (Email: ${clientEmail}, Phone: ${clientPhone}).</p> <!-- Explicit indirect mention -->
      <p>Your indirect commission received is <strong>${commissionAmount}</strong>.</p>
      <p>This commission is earned through your downline's sale.</p> <!-- Additional context -->
      <p>Please check your dashboard for more details.</p>
      <p>Best regards,</p>
      <p><strong>Baay Realty Team</strong></p>
    </div>
    <div class="footer">Baay Realty &copy; 2024. All Rights Reserved.</div>
  </div>
</body>
</html>
`;


router.patch('/purchases/:id/status', async (req, res) => {
  const session = await mongoose.startSession(); // Start a MongoDB session
  session.startTransaction(); // Start a transaction

  try {
    const { id } = req.params;
    const { status } = req.body;
    const io = req.app.get('io'); // Get Socket.IO instance

    // Find purchase by ID
    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Purchase not found' });
    }

    await logActivity(
      null,
      'Admin',
      "admin",
      'purchase_confirmation',
      `confirmed purchase for property ${purchase.propertyName}`,
      {
        purchaseId: purchase._id,
        propertyId: purchase.property,
        clientId: purchase.client,
        amount: purchase.amount
      }
    );

    // Log client activity
    await logActivity(
      purchase.client,
      'client',
      'client',
      'purchase_confirmed',
      `Your purchase of ${purchase.propertyName} was confirmed`,
      {
        purchaseId: purchase._id,
        propertyId: purchase.property,
        amount: purchase.amount,
      }
    );

    // Only proceed if status is being updated to 'confirmed'
    if (status === 'confirmed') {
      const property = await Property.findById(purchase.property).session(session);
      if (!property) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Property not found' });
      }

      const realtor = await RealtorUser.findOne({ email: purchase.referralEmail }).session(session);
      if (!realtor) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Realtor not found' });
      }

     

      // Ensure `amount`, `commission`, and `indirectcommission` are numbers
      const purchaseAmount = Number(purchase.amount);
      const commissionRate = Number(property.commission);
      const indirectCommissionRate = Number(property.indirectcommission);

      if (isNaN(purchaseAmount) || isNaN(commissionRate)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Invalid purchase amount or commission rate' });
      }

      // Calculate direct commission
      const directCommissionAmount = (purchaseAmount * commissionRate) / 100;

      // Save direct commission to Realtor
      realtor.directCommission.push({
        amount: directCommissionAmount,
        purchaseId: purchase._id,
      });
      await realtor.save({ session });

      // Save direct commission transaction
      const directCommission = new Commission({
        type: 'direct',
        amount: directCommissionAmount,
        purchaseId: purchase._id,
        realtorantId: realtor._id,
        clientDetails: {
          clientId: purchase.client,
          firstName: purchase.ClientfirstName,
          lastName: purchase.ClientlastName,
          email: purchase.Clientemail,
          phone: purchase.Clientphone,
        },
        propertyDetails: {
          propertyId: purchase.property,
          propertyName: property.propertyName,
          amountPaid: purchase.amount,
        },
      });
      await directCommission.save({ session });

      if (realtor) {
        await logActivity(
          realtor._id,
          'Realtor',
          'realtor',
          'direct_commission',
          `You earned direct commission from ${purchase.ClientfirstName}'s purchase`,
          {
            purchaseId: purchase._id,
            propertyId: purchase.property,
            clientId: purchase.client,
            amount: directCommissionAmount
          }
        );
      }

      // Handle indirect commission (if Realtor has an upline)
      let indirectCommissionAmount = 0;
      let uplineRealtor = null;

      if (realtor.upline && realtor.upline.email) {
        uplineRealtor = await RealtorUser.findOne({ email: realtor.upline.email }).session(session);
        if (uplineRealtor) {
          if (isNaN(indirectCommissionRate)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid indirect commission rate' });
          }

          if (uplineRealtor) {
            await logActivity(
              uplineRealtor._id,
              'Realtor',
              'realtor',
              'indirect_commission',
              `You earned indirect commission from ${purchase.ClientfirstName}'s purchase`,
              {
                purchaseId: purchase._id,
                propertyId: purchase.property,
                clientId: purchase.client,
                amount: indirectCommissionAmount
              }
            );
          }

          indirectCommissionAmount = (purchaseAmount * indirectCommissionRate) / 100;

          // Save indirect commission to upline Realtor
          uplineRealtor.indirectCommission.push({
            amount: indirectCommissionAmount,
            purchaseId: purchase._id,
          });
          await uplineRealtor.save({ session });

          // Save indirect commission transaction
          const indirectCommission = new Commission({
            type: 'indirect',
            amount: indirectCommissionAmount,
            purchaseId: purchase._id,
            realtorantId: uplineRealtor._id,
            clientDetails: {
              clientId: purchase.client,
              firstName: purchase.ClientfirstName,
              lastName: purchase.ClientlastName,
              email: purchase.Clientemail,
              phone: purchase.Clientphone,
            },
            propertyDetails: {
              propertyId: purchase.property,
              propertyName: property.propertyName,
              amountPaid: purchase.amount,
            },
          });
          await indirectCommission.save({ session });
        }
      }

      // Update the purchase status to 'confirmed'
      purchase.status = 'confirmed';
      await purchase.save({ session });

      // Commit the transaction if everything succeeds
      await session.commitTransaction();
      session.endSession();

      try {
        // Notification to Client
        io.to(`client_${purchase.client}`).emit('notification', {
          title: 'Purchase Confirmed',
          message: `Your purchase of ${property.propertyName} has been confirmed`,
          type: 'purchase_confirmed',
          purchaseId: purchase._id,
          timestamp: new Date()
        });

        // Notification to Direct Commission Realtor
        io.to(`realtor_${realtor._id}`).emit('notification', {
          title: 'Direct Commission Earned',
          message: `You earned ₦${directCommissionAmount} from ${purchase.ClientfirstName}'s purchase`,
          type: 'direct_commission',
          amount: directCommissionAmount,
          purchaseId: purchase._id,
          timestamp: new Date()
        });

        // Notification to Indirect Commission Realtor (if exists)
        if (uplineRealtor) {
          io.to(`realtor_${uplineRealtor._id}`).emit('notification', {
            title: 'Indirect Commission Earned',
            message: `You earned ₦${indirectCommissionAmount} from ${purchase.ClientfirstName}'s purchase`,
            type: 'indirect_commission',
            amount: indirectCommissionAmount,
            purchaseId: purchase._id,
            timestamp: new Date()
          });
        }
      } catch (socketError) {
        console.error('Failed to send notifications:', socketError);
        // Notifications failed but transaction was successful
      }

      // Send emails after the transaction is committed
      const clientEmailSent = await sendEmail(
        purchase.Clientemail,
        'Payment Proof Confirmed - Baay Realty',
        clientEmailTemplate(purchase.ClientfirstName, property.propertyName)
      );

      const directCommissionEmailSent = await sendEmail(
        realtor.email,
        'Direct Commission Received - Baay Realty',
        directCommissionEmailTemplate(
          realtor.firstName,
          property.propertyName,
          purchase.amount,
          `${purchase.ClientfirstName} ${purchase.ClientlastName}`,
          purchase.Clientemail,
          purchase.Clientphone,
          directCommissionAmount
        )
      );

      let indirectCommissionEmailSent = true;
      if (uplineRealtor) {
        indirectCommissionEmailSent = await sendEmail(
          uplineRealtor.email,
          'Indirect Commission Received - Baay Realty',
          indirectCommissionEmailTemplate(
            uplineRealtor.firstName,
            property.propertyName,
            purchase.amount,
            `${purchase.ClientfirstName} ${purchase.ClientlastName}`,
            purchase.Clientemail,
            purchase.Clientphone,
            indirectCommissionAmount
          )
        );
      }

      if (!clientEmailSent || !directCommissionEmailSent || !indirectCommissionEmailSent) {
        return res.status(500).json({ message: 'Failed to send one or more emails' });
      }

      res.json(purchase);
    } else {
      await session.abortTransaction();
      session.endSession();
      res.json(purchase);
    }
  } catch (error) {
    // Abort the transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating purchase status:', error);
    res.status(400).json({ message: error.message, stack: error.stack });
  }
});



router.delete('/purchases/:id', async (req, res) => {
  try {
    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get('/view-commissions', async (req, res) => {
  try {
    const commissions = await Commission.find().populate("realtorantId");

    const formattedCommissions = commissions.map(commission => ({
      ...commission.toObject(),
      realtoremail: commission.realtorId?.email || "",
      realtorfullname: `${commission.realtorId?.firstName || ""} ${commission.realtorId?.lastName || ""}`
    }));

    res.json(formattedCommissions);
  } catch (error) {
    console.error("Error fetching commissions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.put('/edit-commissions/:id', async (req, res) => {
  try {
    const { amount, type } = req.body;
    const updatedCommission = await Commission.findByIdAndUpdate(
      req.params.id,
      { amount, type },
      { new: true }
    );
    res.json(updatedCommission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Delete a commission
router.delete('/delete-commissions/:id', async (req, res) => {
  try {
    await Commission.findByIdAndDelete(req.params.id);
    res.json({ message: 'Commission deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get("/view-approved-purchase", async (req, res) => {
  try {
    const purchases = await Purchase.find({ status: "confirmed" });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a purchase
router.delete("/delete-approved-purchase/:id", async (req, res) => {
  try {
    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: "Purchase deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch purchases where amount is less than propertyActualPrice
router.get('/purchases/incomplete', async (req, res) => {
  try {
    const purchases = await Purchase.find({
      $expr: { $lt: ['$amount', { $toDouble: '$propertyActualPrice' }] },
    })


    res.status(200).json(purchases);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error fetching purchases', error });
  }
});

// Add a reminder
router.post('/reminders', async (req, res) => {
  try {
    const { purchaseId, propertyName, propertyActualPrice, amountRemaining, nextPaymentDate, Clientemail, scheduledDate, clientId



     } = req.body;

    console.log(req.body)

    let reminder = await Reminder.findOne({ purchase: purchaseId });

    if (!reminder) {
      reminder = new Reminder({
        purchase: purchaseId,
        propertyName,
        propertyActualPrice,
        reminders: [],
        Clientemail,
      });
    }

    // Log admin activity
    await logActivity(
      null,
      'Admin',
      "admin",
      'reminder_created',
      `Admin created a payment reminder for ${propertyName}`,
      {
        purchaseId,
        propertyName,
        clientEmail: Clientemail
      }
    );

    // Log client activity
    await logActivity(
      clientId,
      'Client',
      'client',
      'payment_reminder',
      `Payment reminder created for your purchase of ${propertyName}`,
      {
        purchaseId,
        propertyName,
      }
    );

    reminder.reminders.push({ amountRemaining, nextPaymentDate, scheduledDate });
    await reminder.save();

    res.status(201).json(reminder);
  } catch (error) {
    res.status(500).json({ message: 'Error adding reminder', error });
  }
});

// Fetch reminders for a purchase
router.get('/reminders/:purchaseId', async (req, res) => {
  try {
    const reminders = await Reminder.findOne({ purchase: req.params.purchaseId });
    res.status(200).json(reminders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reminders', error });
  }
});


// @route   GET /api/admin/get-all-admins
// @desc    Get all admins by type
router.get('/get-all-admins', async (req, res) => {
  try {

    const { type } = req.query;
    const query = type ? { adminType: type } : {};
    
    const admins = await Admin.find(query).select('-password');
    
    res.json({ admins });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/admin/create-admin
// @desc    Create a new admin
router.post('/create-admin', async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password, adminType } = req.body;

    // Check if admin already exists
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ message: 'Admin already exists with this email' });
    }

    admin = new Admin({
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      adminType
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    await admin.save();

    // Determine the login link based on adminType
    const loginLink = adminType === 'superadmin' 
      ? 'https://baay-frontemd.onrender.com/superadmin/login' 
      : 'https://baay-frontemd.onrender.com/admin/login';

    // HTML email template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #4CAF50;">Welcome to Baay, ${firstName}!</h2>
        <p>Your admin account has been successfully created.</p>
        <p>Here are your login details:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>Click the link below to log in to your account:</p>
        <a href="${loginLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to Baay</a>
        <p>If you have any questions, feel free to contact us.</p>
        <p>Best regards,<br/>The Baay Team</p>
      </div>
    `;

    // Email options
    const mailOptions = {
      from: '"Baay Realty" <sanieldan@zohomail.com>',
      to: email,
      subject: 'Your Baay Admin Account Has Been Created',
      html: htmlTemplate
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/admin/delete-admin/:id
router.delete('/delete-admin/:id', async (req, res) => {
  try {
    console.log(req.params.id);

    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Remove the admin
    await admin.deleteOne();

    res.json({ message: 'Admin removed successfully' });
  } catch (err) {
    console.log(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.status(500).send('Server Error');
  }
});


// Get all pending testimonials
router.get('/testimonial/pending', async (req, res) => {
  try {
    const pendingTestimonials = await PendingTestimonials.find().sort({ dateSubmitted: -1 });
    res.json(pendingTestimonials);
  } catch (error) {
    console.error('Error fetching pending testimonials:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all accepted testimonials
router.get('/testimonial/accepted', async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ dateAccepted: -1 });
    res.json(testimonials);
  } catch (error) {
    console.error('Error fetching accepted testimonials:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept a pending testimonial
router.post('/testimonial/accept', async (req, res) => {
  try {
    const { testimonialId } = req.body;
    const io = req.app.get('io');
    
    // Find the pending testimonial
    const pendingTestimonial = await PendingTestimonials.findById(testimonialId);

    console.log(pendingTestimonial)
    
    if (!pendingTestimonial) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    // Log admin activity
    await logActivity(
      null,
      'Admin',
      "admin",
      'testimonial_approval',
      `Admin approved testimonial from ${pendingTestimonial.realtorName}`,
      {
        testimonialId: pendingTestimonial._id,
        realtorId: pendingTestimonial.realtorId,
        realtorName: pendingTestimonial.realtorName
      }
    );
    
    // Create a new accepted testimonial
    const newTestimonial = new Testimonial({
      realtorId: pendingTestimonial.realtorId,
      realtorName: pendingTestimonial.realtorName,
      realtorEmail: pendingTestimonial.realtorEmail,
      propertypurchased: pendingTestimonial.propertypurchased,
      content: pendingTestimonial.content,
      dateSubmitted: pendingTestimonial.dateSubmitted
    });


    // Log realtor activity
    await logActivity(
      pendingTestimonial.realtorId,
      'Realtor',
      'realtor',
      'testimonial_approved',
      `Your testimonial was approved by admin`,
      {
        testimonialId: pendingTestimonial._id,
      }
    );
    
    // Save the new testimonial
    await newTestimonial.save();
    
    // Delete the pending testimonial
    await PendingTestimonials.findByIdAndDelete(testimonialId);

    io.to(`realtor_${pendingTestimonial.realtorId}`).emit('notification', {
      title: 'Testimonial Approved',
      message: 'Your testimonial has been approved and published',
      type: 'testimonial_approved',
      timestamp: new Date()
    });
    
    res.json({ message: 'Testimonial accepted successfully' });
  } catch (error) {
    console.error('Error accepting testimonial:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject a pending testimonial
router.delete('/testimonial/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await PendingTestimonials.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }
    
    res.json({ message: 'Testimonial rejected successfully' });
  } catch (error) {
    console.error('Error rejecting testimonial:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an accepted testimonial
router.delete('/testimonial/accepted/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await Testimonial.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }
    
    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get notifications for user
router.get('/notifications/:userRole', async (req, res) => {
  try {
    const user = req.user; // Assuming you have auth middleware
    const notifications = await Notification.find({
      userId: user._id,
      userRole: req.params.userRole
    }).sort({ createdAt: -1 }).limit(10);
    
    const unreadCount = await Notification.countDocuments({
      userId: user._id,
      userRole: req.params.userRole,
      read: false
    });
    
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark notification as read
router.post('/notifications/mark-read/:id', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

// Mark all notifications as read
router.post('/notifications/mark-all-read', async (req, res) => {
  try {
    const user = req.user;
    await Notification.updateMany(
      { userId: user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications as read' });
  }
});




  

module.exports = router;