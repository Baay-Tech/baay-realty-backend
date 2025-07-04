const express = require('express');
const router = express.Router();
const Realtor = require('../database/schema/realtor'); // Ensure this is correctly pointing to your Mongoose model
const bcrypt = require("bcrypt");
const Fund = require("../database/schema/fundupload")
const RealtorwithdrawalrequestSchema = require("../database/schema/realtorwithdrawalrequest")
const MessageSupport = require("../database/schema/realtormessage")

const Property = require("../database/schema/properties")

const nodemailer = require('nodemailer');

const FAQ = require("../database/schema/faq")

const Message = require("../database/schema/birthdaymessage")

const Client = require("../database/schema/client")

const Purchase = require("../database/schema/purchase")

const Commission = require("../database/schema/commission")

const PendingTestimonials = require('../database/schema/PendingTestimonialsSchema');

const Testimonial = require("../database/schema/Testimonial")

const Activity = require('../database/schema/acivity');


// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'smtp.zoho.com',
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  logger: true,
  debug: true,
  secureConnection: false,
  auth: {
    user: 'noreply@baayoperations.com',
    pass: 'w20KQTTcpWk1'
  }
});

router.get('/dashboard/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Find user based on username
    const user = await Realtor.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch upline details
    const upline = user.upline || { name: "N/A", phone: "N/A", email: "N/A" };

    // Fetch client referrals (downlines count)
    const downlines = user.Clientreferrals || [];
    const downlinesCount = downlines.length;

    // Fetch direct Realtor referrals count
    const realtorReferrals = user.Realtorreferrals || [];
    const realtorReferralsCount = realtorReferrals.length;

    // Calculate total direct commissions
    const totalDirectCommissions = user.directCommission.reduce((acc, curr) => acc + curr.amount, 0);

    // Calculate total indirect commissions
    const totalIndirectCommissions = user.indirectCommission.reduce((acc, curr) => acc + curr.amount, 0);

    // Fetch total properties sold directly (from Commission schema)
    const propertiesSold = await Commission.countDocuments({ realtorantId: user._id });

    // Construct response
    const dashboardData = {
      username: user.username,
      referralId: user.referrerIdNumber,
      uplineName: upline.name,
      uplinePhone: upline.phone,
      uplineemail: upline.email,
      downlines: downlinesCount,
      directCommissions: totalDirectCommissions,
      indirectCommissions: totalIndirectCommissions,
      earningAmount: user.balance, // Use balance field
      funding: user.funding, // Use funding field
      unitsSold: propertiesSold, // Properties sold directly
      realtorReferralsCount, // Total Realtor referrals
      clientReferralsCount: downlinesCount, // Total client referrals
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.log('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get profile data
router.get("/profile/:username", async (req, res) => {
    try {
      const user = await Realtor.findOne({ username: req.params.username });
      if (!user) return res.status(404).json({ message: "User not found" });
  
      res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        accountName: user.accountName,
        accountNumber: user.accountNumber,
        bank: user.bank,
        profileImage: user.profileImage,
        username: user.username,
      });
    } catch (error) {
        console.log(error)
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Edit Profile
router.put("/edit-profile", async (req, res) => {
    const { userId, firstName, lastName, phoneNumber, email, accountName, accountNumber, bank, address, country, state,   } = req.body;
    
    console.log(req.body)

    try {
      const user = await Realtor.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Update user details
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.phoneNumber = phoneNumber || user.phoneNumber;
      user.email = email || user.email;
      user.accountName = accountName || user.accountName;
      user.accountNumber = accountNumber || user.accountNumber;
      user.bank = bank || user.bank;

      user.address = address || user.address;
      user.country = country || user.country;
      user.state = state || user.state;
  
      await user.save();
      res.status(200).json({ message: "Profile updated successfully", user });
    } catch (error) {
      res.status(500).json({ message: "Error updating profile", error: error.message });
    }
  });


router.put("/update-profile-image", async (req, res) => {
  const { userId, image } = req.body;

  try {
    const user = await Realtor.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    // Save the secure URL to the user's profile
    user.profileimage = image;
    await user.save();

    console.log(user)

    res.status(200).json({ message: "Profile image updated successfully", user });
  } catch (error) {
      console.log(error)
    res.status(500).json({ message: "Error updating profile image", error: error.message });
  }
});


  // Change Password
router.put("/change-password", async (req, res) => {
    const { userId, newPassword } = req.body;
  
    try {
      const user = await Realtor.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
  
      await user.save();
      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error updating password", error: error.message });
    }
  });


router.post("/upload-fund", async (req, res) => { 
  try {
    // Validate required fields
    if (!req.body.realtorId || !req.body.clientId || !req.body.propertyId || 
        !req.body.amount || !req.body.currency || !req.body.proofImage) {
          console.log("Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Fetch realtor and client details
    const realtor = await Realtor.findById(req.body.realtorId);
    const client = await Client.findById(req.body.clientId);
    const property = await Property.findById(req.body.propertyId);
    
    if (!realtor || !client || !property) {
      console.log("Realtor, client or property not found");
      return res.status(404).json({ message: "Realtor, client or property not found" });
    }

    // Create new fund record
    const fund = new Fund({
      realtor: req.body.realtorId,
      client: req.body.clientId,
      property: req.body.propertyId,
      amount: req.body.amount,
      currency: req.body.currency,
      currencySymbol: req.body.currencySymbol,
      paymentDate: req.body.paymentDate || new Date(),
      proofImage: req.body.proofImage,
      status: 'pending'
    });

    // Create purchase record
    const purchase = new Purchase({
      client: client._id,
      ClientfirstName: client.firstName,
      ClientlastName: client.lastName,
      Clientphone: client.phone,
      Clientemail: client.email,
      realtor: realtor._id,
      referralName: realtor.firstName,
      referralPhone: realtor.phone,
      referralEmail: realtor.email,
      property: property._id,
      propertyName: property.propertyName,
      propertyActualPrice: property.amount,
      amount: req.body.amount,
      paymentMethod: 'Bank Transfer', // Default or from request
      status: 'pending'
    });

    // Admin email template
    const adminMailOptions = {
      to: ['favoursunday600@gmail.com', 'clientrelations.baayprojects@gmail.com'],
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `📩 New Client Payment by Realtor ${realtor.firstName} ${realtor.lastName}`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/money.png" alt="Payment Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">Realtor-Submitted Payment</h2>
          <p style="font-size: 16px;">A realtor has submitted a payment on behalf of a client.</p>
          <table style="width: 100%; text-align: left; margin-top: 20px;">
            <tr><td><strong>Realtor:</strong></td><td>${realtor.firstName} ${realtor.lastName}</td></tr>
            <tr><td><strong>Client:</strong></td><td>${client.firstName} ${client.lastName}</td></tr>
            <tr><td><strong>Property:</strong></td><td>${property.propertyName}</td></tr>
            <tr><td><strong>Amount:</strong></td><td>${req.body.currencySymbol}${req.body.amount} (${req.body.currency})</td></tr>
            <tr><td><strong>Full Price:</strong></td><td>${property.amount}</td></tr>
          </table>
          <p style="margin-top: 20px;"><a href="https://superadmin.baayrealty.com" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify Payment</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Admin Team</p>
        </div>
      `
    };

    // Client email template
    const clientMailOptions = {
      to: client.email,
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `✅ Payment Submitted for ${property.propertyName}`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/checked.png" alt="Success Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">Payment Submitted</h2>
          <p style="font-size: 16px;">Dear ${client.firstName},</p>
          <p>Your realtor ${realtor.firstName} ${realtor.lastName} has submitted a payment of ${req.body.currencySymbol}${req.body.amount} for ${property.propertyName}.</p>
          <p>We will review and confirm this payment within 24-48 hours.</p>
          <p style="margin-top: 20px;"><a href="https://clients.baayrealty.com" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">View Your Account</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Customer Support</p>
        </div>
      `
    };

    // Realtor email template
    const realtorMailOptions = {
      to: realtor.email,
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `📌 Payment Submitted for ${client.firstName}'s Purchase`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/upload.png" alt="Upload Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">Payment Submitted</h2>
          <p style="font-size: 16px;">Dear ${realtor.firstName},</p>
          <p>You have successfully submitted a payment of ${req.body.currencySymbol}${req.body.amount} for:</p>
          <p><strong>Client:</strong> ${client.firstName} ${client.lastName}</p>
          <p><strong>Property:</strong> ${property.propertyName}</p>
          <p>We will notify you once the payment is verified.</p>
          <p style="margin-top: 20px;"><a href="https://associates.baayrealty.com" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">View Your Dashboard</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Realtor Support</p>
        </div>
      `
    };

    // Create notification
    const notification = {
      type: 'realtor_payment',
      title: 'Realtor-Submitted Payment',
      message: `${realtor.firstName} ${realtor.lastName} submitted ₦${req.body.amount} for ${client.firstName} ${client.lastName}`,
      timestamp: new Date().toISOString()
    };
    
    // Send all emails in parallel
    await Promise.all([
      fund.save(),
      purchase.save(),
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(clientMailOptions),
      transporter.sendMail(realtorMailOptions)
    ]);

    // Emit notification to admin room
    const io = req.app.locals.io;
    io.to('admin_room').emit('admin_notification', notification);

    // Log activity
    await Activity.create({
      userId: realtor._id,
      userModel: 'Realtor',
      role: 'realtor',
      activityType: 'client_payment',
      description: `Submitted payment for client ${client.firstName} ${client.lastName}`,
      metadata: {
        clientId: client._id,
        propertyId: property._id,
        amount: req.body.amount
      }
    });

    res.status(201).json({
      fund,
      purchase,
      message: "Payment submitted successfully. Notifications sent to all parties."
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});
  


// Updated route to fetch funding history with populated data
router.get("/funding-history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch funding records with populated client and property data
    const fundingRecords = await Fund.find({ realtor: userId })
      .populate({
        path: 'client',
        select: 'firstName lastName email phone'
      })
      .populate({
        path: 'property',
        select: 'propertyName propertyType city state amount'
      })
      .sort({ paymentDate: -1 }); // Sort by newest first

    res.status(200).json(fundingRecords);
  } catch (error) {
    console.error("Error fetching funding history:", error);
    res.status(500).json({ message: "Server error" });
  }
});



router.get('/team/:userId', async (req, res) => {
try {
    const user = await Realtor.findById(req.params.userId);
    if (!user) {
    return res.status(404).json({ message: 'User not found' });
    }

    const teamMembers = [];
    
    // Process Realtorreferrals
    if (user.Realtorreferrals?.length > 0) {
    for (const referral of user.Realtorreferrals) {
        const referredUser = await Realtor.findOne({
        $or: [
            { username: referral.username },
            { email: referral.email },
            { phone: referral.phone }
        ]
        });

        if (referredUser) {
        teamMembers.push({
            ...referredUser._doc,
            cid: referredUser.Clientreferrals?.length || 0,
            status: 'Active'
        });
        }
    }
    }

    res.json({
    teamMembers: teamMembers.length > 0 ? teamMembers : [{ 
        message: 'No referral Realtor found',
        cid: user.Clientreferrals?.length || 0 
    }]
    });
    
} catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
}
});

router.post('/withdrawal', async (req, res) => {
  try {
    const { userId, amount, username, firstName, lastName, email, phone } = req.body;

    console.log(req.body);

    // Check user balance
    const user = await Realtor.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (amount > user.balance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create withdrawal request
    const withdrawal = new RealtorwithdrawalrequestSchema({
      user: userId,
      amount,
      username,
      firstName,
      lastName,
      email,
      phone,
    });

    // Admin email template
    const adminMailOptions = {
      to: ['Favoursunday600@gmail.com', 'clientrelations.baayprojects@gmail.com'],
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `📩 New Withdrawal Request from ${firstName} ${lastName}`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/money.png" alt="Withdrawal Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">New Withdrawal Request</h2>
          <p style="font-size: 16px;">A user has requested a withdrawal. Please process it in the admin portal.</p>
          <table style="width: 100%; text-align: left; margin-top: 20px;">
            <tr><td><strong>User:</strong></td><td>${firstName} ${lastName}</td></tr>
            <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
            <tr><td><strong>Phone:</strong></td><td>${phone}</td></tr>
            <tr><td><strong>Amount:</strong></td><td>${amount}</td></tr>
          </table>
          <p style="margin-top: 20px;"><a href="https://superadmin.baayrealty.com" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Process Withdrawal</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Admin Team</p>
        </div>
      `,
    };
    await transporter.sendMail(adminMailOptions);

    // User email template
    const userMailOptions = {
      to: email,
      from: '"Baay Realty" <noreply@baayoperations.com>',
      subject: `✅ Withdrawal Request Received`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/bank.png" alt="Bank Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">Withdrawal Request Received</h2>
          <p style="font-size: 16px;">Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Your withdrawal request of <strong>${amount}</strong> has been received. 🕒 Please wait while we process your request.</p>
          <p>We will notify you once the transaction is completed.</p>
          <p style="margin-top: 20px;"><a href="https://associates.baayrealty.com" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Go to Dashboard</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Customer Support</p>
        </div>
      `,
    };

    // After creating withdrawal request, emit notification
    const notification = {
      type: 'withdrawal',
      title: 'New Withdrawal Request',
      message: `${req.body.firstName} ${req.body.lastName} requested a withdrawal of ${req.body.amount}`,
      timestamp: new Date().toISOString()
    };

    const io = req.app.locals.io;
    
    // Debug log before emitting
    console.log('Emitting notification to admin_room:', notification);
    console.log('Current admin connections:', req.app.locals.connectedUsers.admins);
    
    io.to('admin_room').emit('admin_notification', notification);


    await transporter.sendMail(userMailOptions);

    await withdrawal.save();
    res.status(201).json(withdrawal);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Get withdrawal requests by status
router.get('/withdrawal-requests', async (req, res) => {
    try {
      const { status } = req.query;
      const filter = {};
  
      // Validate and set status filter
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        filter.status = status;
      }
  
      const requests = await RealtorwithdrawalrequestSchema.find(filter)
        .sort({ timestamp: -1 }) // Sort by newest first
        .lean();
  
      // Format the response data
      const formattedRequests = requests.map(request => ({
        ...request,
        amount: formatCurrency(request.amount),
        date: new Date(request.timestamp).toLocaleDateString()
      }));

      console.log(formattedRequests)
  
      res.json(formattedRequests);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Helper function to format currency (NGN)
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };



// In your routes file (probably routes/realtor.js or similar)
router.post('/support', async (req, res) => {
  try {
    const io = req.app.locals.io;// Get io from app.locals
    const { user, firstName, lastName, username, phone, email, subject, message } = req.body;

    // Create ticket
    const ticket = new MessageSupport({
      user,
      firstName,
      lastName,
      username,
      phone,
      email,
      subject,
      messages: [{
        sender: 'realtor',
        content: message
      }]
    });

    await ticket.save();

    // Log activity for realtor
    await Activity.create({
      userId: user,
      userModel: 'Realtor',
      role: 'realtor',
      activityType: 'support_message',
      description: 'You sent a support message',
      metadata: {
        ticketId: ticket._id,
        subject,
        message
      }
    });

    // Log activity for admin
    await Activity.create({
      userModel: 'Admin',
      role: 'admin',
      activityType: 'support_message',
      description: `${username} sent a support message`,
      metadata: {
        ticketId: ticket._id,
        subject,
        sender: username,
        message
      }
    });

    // Create notification payload
    const notification = {
      type: 'Support',
      title: 'New Withdrawal Request',
      message: `New ticket from ${firstName} ${lastName}: ${subject}`,
      ticketId: ticket._id,
      sender: username,
      timestamp: new Date()
    };

    // Send notification only to admins
    io.to('admin_room').emit('admin_notification', notification);

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(400).json({ error: error.message });
  }
});
  
  // Get user's tickets
  router.get('/support/my-tickets/:userid', async (req, res) => {
    try {
      const tickets = await MessageSupport.find({ user: req.params.userid })
        .sort('-updatedAt');
      res.json(tickets);
    } catch (error) {
    console.log('Error fetching withdrawal requests:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all tickets (admin)
  router.get('/support', async (req, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
      const tickets = await MessageSupport.find().populate('user', 'name email');
      res.json(tickets);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add message to ticket
  router.post('/support/:ticketId/messages', async (req, res) => {
    try {
      const ticket = await MessageSupport.findById(req.params.ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      const io = req.app.locals.io;// Get io from app.locals

      console.log
  
      const sender = 'user'
      ticket.messages.push({
        sender,
        content: req.body.content
      });
      ticket.updatedAt = Date.now();
      await ticket.save();

      // Emit notification for new message
      const notification = {
        type: 'Support',
        title: 'New Withdrawal Request',
        message: `New ticket from ${ticket.firstName} ${ticket.lastName}: ${ticket.subject}`,
        ticketId: ticket._id,
        sender: ticket.username,
        timestamp: new Date()
      };
  
      // Send notification only to admins
      io.to('admin_room').emit('admin_notification', notification);
  

      res.json(ticket);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Update ticket status (admin)
  router.patch('/support/:id/status', async (req, res) => {
    try {
      if (!req.user.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
      const ticket = await MessageSupport.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      res.json(ticket);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(400).json({ error: error.message });
    }
  });


// GET all FAQs
router.get('/faqs', async (req, res) => {
  try {
    const faqs = await FAQ.find();
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get("/properties", async (req, res) => {
  try {
    const properties = await Property.find();
    res.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// 2. Fetch a single property by ID
router.get("/properties/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    res.json(property);
  } catch (error) {
    console.error("Error fetching property:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/birthday-message", async (req, res) => {
  try {
    const userId = req.query.userId; // Pass the user ID as a query parameter
    const user = await Realtor.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if today is the user's birthday
    const today = new Date();
    const userDob = new Date(user.dob);

    if (
      today.getMonth() === userDob.getMonth() &&
      today.getDate() === userDob.getDate()
    ) {
      // Fetch a random birthday message
      const messages = await Message.find();
      if (messages.length > 0) {
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        console.log(randomMessage);
        return res.json({ message: randomMessage.message });
      } else {
        return res.json({ message: "Happy Birthday! 🎉" }); // Default message
      }
    } else {
      return res.json({ message: null }); // No birthday today
    }
  } catch (error) {
    console.log("Error fetching birthday message:", error);
    res.status(500).json({ message: "Server error" });
  }
});


router.get('/clients', async (req, res) => {
  const { uplineEmail, searchTerm, startDate, endDate, sortField, sortOrder } = req.query;

  console.log(req.query)
  const query = { 'upline.email': uplineEmail };

  if (searchTerm) {
    query.$or = [
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  if (startDate && endDate) {
    query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const sortOptions = {};
  sortOptions[sortField] = sortOrder === 'asc' ? 1 : -1;

  try {
    const clients = await Client.find(query).sort(sortOptions);
    res.json(clients);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error fetching clients', error });
  }
});


router.get('/clients/purchases', async (req, res) => {
  const { clientId } = req.query;

  try {
    const purchases = await Purchase.find({ client: clientId });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching purchase details', error });
  }
});

router.get('/view-commission', async (req, res) => {
  try {
    const { realtorId } = req.query;
    
    if (!realtorId) {
      return res.status(400).json({ message: 'Realtor ID is required' });
    }

    const commissions = await Commission.find({ realtorantId: realtorId  })

    res.json(commissions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/referrals/:username', async (req, res) => {
  const { username } = req.params;

    try {
        // Find the realtor by username
        const realtor = await Realtor.findOne({ username });

        if (!realtor) {
            return res.status(404).json({ message: 'Realtor not found' });
        }

        // Format referral data for the chart
        const referralData = realtor.Realtorreferrals.map((referral, index) => ({
            date: new Date(realtor.createdAt).setDate(realtor.createdAt.getDate() + index), // Simulate dates
            realtorCount: index + 1, // Simulate realtor referral count
            clientCount: realtor.Clientreferrals.length, // Use client referral count
            balance: realtor.balance, // Include balance
            funding: realtor.funding, // Include funding
            directCommission: realtor.directCommission.reduce((acc, curr) => acc + curr.amount, 0), // Total direct commission
            indirectCommission: realtor.indirectCommission.reduce((acc, curr) => acc + curr.amount, 0), // Total indirect commission
        }));

        res.status(200).json(referralData);
    } catch (error) {
        console.error('Error fetching referral data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



router.post('/testimonials/submit', async (req, res) => {
  try {
    const { realtorId, realtorName, realtorEmail, propertypurchased, content } = req.body;
    const newTestimonial = new PendingTestimonials({
      realtorId,
      realtorName,
      realtorEmail,
      propertypurchased: propertypurchased,
      content,
    });

    console.log(req.body)

    // After testimonial submission, emit notification
    const notification = {
      type: 'testimonial',
      title: 'New Testimonial Submitted',
      message: `${req.body.realtorName} submitted a new testimonial`,
      timestamp: new Date().toISOString()
    };
    const io = req.app.locals.io;
    
    // Debug log before emitting
    console.log('Emitting notification to admin_room:', notification);
    console.log('Current admin connections:', req.app.locals.connectedUsers.admins);
    
    io.to('admin_room').emit('admin_notification', notification);

    await newTestimonial.save();
    res.status(201).json({ message: 'Testimonial submitted successfully' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error submitting testimonial', error });
  }
});


// Example backend route
router.get('/testimonials', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 3;

  try {
    const testimonials = await Testimonial.find()
      .skip((page - 1))
   

    res.status(200).json({ testimonials });
  } catch (error) {
    console.log("error", error)
    res.status(500).json({ message: 'Error fetching testimonials', error });
  }
});


// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check Email Endpoint
router.post('/auth/check-email', async (req, res) => {
  const { email } = req.body;

  try {
    const realtor = await Realtor.findOne({ email });
    if (!realtor) {
      return res.status(404).json({ message: 'Email not found' });
    }

    res.status(200).json({ message: 'Email found' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Server error', error });
  }
});

// Send OTP Endpoint
router.post('/auth/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const realtor = await Realtor.findOne({ email });
    if (!realtor) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    realtor.otp = otp;
    realtor.otpExpires = otpExpires;
    await realtor.save();

    // Send OTP via email
    const mailOptions = {
      from: '"Baay Realty" <noreply@baayoperations.com>',
      to: email,
      subject: 'Your OTP for Password Reset',
      text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send OTP', error });
  }
});

// Verify OTP Endpoint
router.post('/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const realtor = await Realtor.findOne({ email });
    if (!realtor) {
      return res.status(404).json({ message: 'Email not found' });
    }

    if (realtor.otp !== otp || realtor.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Clear OTP after successful verification
    realtor.otp = undefined;
    realtor.otpExpires = undefined;
    await realtor.save();

    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify OTP', error });
  }
});

// Change Password Endpoint
router.post('/auth/change-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const realtor = await Realtor.findOne({ email });
    if (!realtor) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    realtor.password = hashedPassword;
    await realtor.save();

    // Send confirmation email
    const mailOptions = {
      from: '"Baay Realty" <noreply@baayoperations.com>',
      to: email,
      subject: 'Password Changed Successfully',
      text: 'Your password has been changed successfully. If you did not initiate this change, please contact our support team.',
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password', error });
  }
});


// Get activities for current user
router.get('/my-activities', async (req, res) => {
  try {
    const activities = await Activity.find({
      userId: req.user.id,
      userModel: req.user.constructor.modelName
    })
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(activities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});



router.get("/:realtorId/resources", async(req, res) => {
  try {
    const realtorId = req.params.realtorId;

    // Verify realtor exists
    const realtor = await Realtor.findById(realtorId);
    if (!realtor) {
      return res.status(404).json({ message: 'Realtor not found' });
    }

    // Get all properties
    const properties = await Property.find({});

    // Get clients referred by this realtor
    const clients = await Client.find({
      'upline.name': { $in: [realtor.firstName + ' ' + realtor.lastName] }
    });

    res.status(200).json({
      properties,
      clients
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
})


  

module.exports = router;
