const express = require('express');
const router = express.Router();
const Activity = require('../database/schema/acivity');
const Admin = require('../database/schema/admin');
const SuperAdmin = require('../database/schema/admin');
const RealtorUser = require('../database/schema/realtor');
const Client = require('../database/schema/client');



// Unified activity tracking endpoint
router.post('/log-activity', async (req, res) => {
  try {
    const { userId, userModel, role, activityType, description, metadata } = req.body;
    console.log(req.body)

    // Basic validation
    if (!userId || !userModel || !role || !activityType || !description) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
      });
    }

    // Create activity
    const activity = new Activity({
      userId,
      userModel,
      role,
      activityType,
      description,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: metadata || {}
    });

    await activity.save();

    res.status(200).json({ 
      success: true,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    console.log('Error logging activity:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to log activity' 
    });
  }
});

// Get activities for any user type
router.get('/activities', async (req, res) => {
    try {
      const { page = 1, limit = 10, activityType, userId, role } = req.query;
      
      // For admins/superadmins - skip user validation and get all activities
      if (role === 'admin' || role === 'superadmin') {
        const query = {};
        
        if (activityType && activityType !== 'all') {
          query.activityType = activityType;
        }
        
        const activities = await Activity.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .lean();
        
        const total = await Activity.countDocuments(query);
        
        return res.json({
          activities,
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          totalActivities: total
        });
      }
      
      // For regular users (realtors/clients) - require userId and validate
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required for non-admin users' });
      }
  
      // Verify user exists in their respective collection
      let userExists;
      switch(role) {
        case 'realtor':
          userExists = await RealtorUser.findById(userId);
          break;
        case 'client':
          userExists = await Client.findById(userId);
          break;
        default:
          return res.status(400).json({ message: 'Invalid role specified' });
      }
  
      if (!userExists) {
        return res.status(404).json({ message: 'User not found in specified role collection' });
      }
  
      const query = { 
        $or: [
          { userId, role }, // User's own activities
          { role: 'system' } // Include system-wide activities if needed
        ]
      };
      
      if (activityType && activityType !== 'all') {
        query.activityType = activityType;
      }
      
      const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();
      
      const total = await Activity.countDocuments(query);
      
      res.json({
        activities,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalActivities: total
      });
      
    } catch (error) {
      console.log('Error fetching activities:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });


module.exports = router;