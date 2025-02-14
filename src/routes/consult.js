const express = require('express');
const router = express.Router();
const ConsultUser = require('../database/schema/consult'); // Ensure this is correctly pointing to your Mongoose model
const bcrypt = require("bcrypt");
const Fund = require("../database/schema/fundupload")
const ConsultwithdrawalrequestSchema = require("../database/schema/consultwithdrawalrequest")
const ConsultMessage = require("../database/schema/consultmessage")

const Property = require("../database/schema/properties")

const nodemailer = require('nodemailer');

const FAQ = require("../database/schema/faq")

const Message = require("../database/schema/birthdaymessage")

const Client = require("../database/schema/client")

const Purchase = require("../database/schema/purchase")

const Commission = require("../database/schema/commission")

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
    user: 'sanieldan@zohomail.com',
    pass: 'p8CtA0MtwP6E'
  }
});

router.get('/dashboard/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Find user based on username
    const user = await ConsultUser.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch upline details
    const upline = user.upline || { name: "N/A", phone: "N/A", email: "N/A" };

    // Fetch client referrals (downlines count)
    const downlines = user.Clientreferrals || [];
    const downlinesCount = downlines.length;

    // Fetch direct consult referrals count
    const consultReferrals = user.Consultreferrals || [];
    const consultReferralsCount = consultReferrals.length;

    // Calculate total direct commissions
    const totalDirectCommissions = user.directCommission.reduce((acc, curr) => acc + curr.amount, 0);

    // Calculate total indirect commissions
    const totalIndirectCommissions = user.indirectCommission.reduce((acc, curr) => acc + curr.amount, 0);

    // Fetch total properties sold directly (from Commission schema)
    const propertiesSold = await Commission.countDocuments({ consultantId: user._id });

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
      consultReferralsCount, // Total consult referrals
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
      const user = await ConsultUser.findOne({ username: req.params.username });
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
    const { userId, firstName, lastName, phoneNumber, email, accountName, accountNumber, bankName, address, country, state,   } = req.body;
     
    try {
      const user = await ConsultUser.findById(userId);
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
      user.bankName = bankName || user.bankName;

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
    const user = await ConsultUser.findById(userId);
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
      const user = await ConsultUser.findById(userId);
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
      const fund = new Fund({
        user: req.body.userid,
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        amount: req.body.amount,
        paymentDate: req.body.paymentDate,
        proofImage: req.body.proofImage,
        email: req.body.email,
        phone: req.body.phone
      });
  
      // Admin email template
      const adminMailOptions = {
        to: ['Favoursunday600@gmail.com', 'clientrelations.baayprojects@gmail.com'],
        from: '"Baay Realty" <sanieldan@zohomail.com>',
        subject: `📩 New Payment Uploaded by ${req.body.firstName} ${req.body.lastName}`,
        html: `
          <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
            <img src="https://img.icons8.com/ios-filled/50/E5B305/money.png" alt="Payment Icon" style="width: 50px;"/>
            <h2 style="color: #E5B305;">New Payment Uploaded</h2>
            <p style="font-size: 16px;">A user has uploaded a payment proof. Please verify it in the admin portal.</p>
            <table style="width: 100%; text-align: left; margin-top: 20px;">
              <tr><td><strong>User:</strong></td><td>${req.body.firstName} ${req.body.lastName}</td></tr>
              <tr><td><strong>Email:</strong></td><td>${req.body.email}</td></tr>
              <tr><td><strong>Phone:</strong></td><td>${req.body.phone}</td></tr>
              <tr><td><strong>Amount:</strong></td><td>${req.body.amount}</td></tr>
            </table>
            <p style="margin-top: 20px;"><a href="https://yourwebsite.com/admin" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Verify Payment</a></p>
            <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Admin Team</p>
          </div>
        `
      };
  
      await transporter.sendMail(adminMailOptions);
  
      // User email template
      const userMailOptions = {
        to: req.body.email,
        from: '"Baay Realty" <sanieldan@zohomail.com>',
        subject: `✅ Payment Proof Uploaded Successfully`,
        html: `
          <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
            <img src="https://img.icons8.com/ios-filled/50/E5B305/upload.png" alt="Upload Icon" style="width: 50px;"/>
            <h2 style="color: #E5B305;">Payment Proof Uploaded</h2>
            <p style="font-size: 16px;">Dear <strong>${req.body.firstName} ${req.body.lastName}</strong>,</p>
            <p>Your payment proof has been successfully uploaded. We will review it and notify you once it is confirmed. 🕒</p>
            <p>Thank you for your patience.</p>
            <p style="margin-top: 20px;"><a href="https://yourwebsite.com/dashboard" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Go to Dashboard</a></p>
            <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Customer Support</p>
          </div>
        `
      };
  
      await transporter.sendMail(userMailOptions);
  
      await fund.save();
  
      res.status(201).json(fund);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  });
  


// Fetch funding history for a user
router.get("/funding-history/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Fetch funding records by userId
      const fundingRecords = await Fund.find({ user: userId });
  
      res.status(200).json(fundingRecords);
    } catch (error) {
      console.error("Error fetching funding history:", error);
      res.status(500).json({ message: "Server error" });
    }
  });



router.get('/team/:userId', async (req, res) => {
try {
    const user = await ConsultUser.findById(req.params.userId);
    if (!user) {
    return res.status(404).json({ message: 'User not found' });
    }

    const teamMembers = [];
    
    // Process Consultreferrals
    if (user.Consultreferrals?.length > 0) {
    for (const referral of user.Consultreferrals) {
        const referredUser = await ConsultUser.findOne({
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
        message: 'No referral consult found',
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
    const user = await ConsultUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (amount > user.balance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create withdrawal request
    const withdrawal = new ConsultwithdrawalrequestSchema({
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
      from: '"Baay Realty" <sanieldan@zohomail.com>',
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
          <p style="margin-top: 20px;"><a href="https://yourwebsite.com/admin" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Process Withdrawal</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Admin Team</p>
        </div>
      `,
    };
    await transporter.sendMail(adminMailOptions);

    // User email template
    const userMailOptions = {
      to: email,
      from: '"Baay Realty" <sanieldan@zohomail.com>',
      subject: `✅ Withdrawal Request Received`,
      html: `
        <div style="background-color: #002657; color: white; padding: 20px; text-align: center; border-radius: 10px; max-width: 600px; margin: auto;">
          <img src="https://img.icons8.com/ios-filled/50/E5B305/bank.png" alt="Bank Icon" style="width: 50px;"/>
          <h2 style="color: #E5B305;">Withdrawal Request Received</h2>
          <p style="font-size: 16px;">Dear <strong>${firstName} ${lastName}</strong>,</p>
          <p>Your withdrawal request of <strong>${amount}</strong> has been received. 🕒 Please wait while we process your request.</p>
          <p>We will notify you once the transaction is completed.</p>
          <p style="margin-top: 20px;"><a href="https://yourwebsite.com/dashboard" style="background-color: #E5B305; color: #002657; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px;">Go to Dashboard</a></p>
          <p style="margin-top: 20px; font-size: 14px;">Baay Realty | Customer Support</p>
        </div>
      `,
    };
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
  
      const requests = await ConsultwithdrawalrequestSchema.find(filter)
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



// Create new ticket
router.post('/support', async (req, res) => {
    try {
        console.log(req.body)
      const ticket = new ConsultMessage({
        user: req.body.user,
        subject: req.body.subject,
        messages: [{
          sender: 'user',
          content: req.body.message
        }]
      });
  
      await ticket.save();
      res.status(201).json(ticket);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Get user's tickets
  router.get('/support/my-tickets/:userid', async (req, res) => {
    try {
      const tickets = await ConsultMessage.find({ user: req.params.userid })
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
      const tickets = await ConsultMessage.find().populate('user', 'name email');
      res.json(tickets);
    } catch (error) {
      console.log('Error fetching withdrawal requests:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add message to ticket
  router.post('/support/:ticketId/messages', async (req, res) => {
    try {
      const ticket = await ConsultMessage.findById(req.params.ticketId);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
      const sender = 'user'
      ticket.messages.push({
        sender,
        content: req.body.content
      });
      ticket.updatedAt = Date.now();
      await ticket.save();
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
      const ticket = await ConsultMessage.findByIdAndUpdate(
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
    const user = await ConsultUser.findById(userId);

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
    const { consultantId } = req.query;
    
    if (!consultantId) {
      return res.status(400).json({ message: 'Consultant ID is required' });
    }

    const commissions = await Commission.find({ consultantId })

    res.json(commissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
  

module.exports = router;
