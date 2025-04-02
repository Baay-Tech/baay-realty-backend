const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'userModel',
        required: function() {
          return this.userModel !== 'Admin'; // Admin activities don't require userId
        }
      },
  userModel: {
    type: String,
    required: true,
    enum: ['Admin', 'SuperAdmin', 'Realtor', 'client']
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'superadmin', 'realtor', 'client']
  },
  activityType: {
    type: String,
    required: true,
    enum: [
      'registration', 
      'login', 
      'logout', 
      'profile_update',
      'property_view',
      'property_add',
      'transaction',
      'system',
      'fund_upload',
      'testimonial_submission',
      'Signup',
      "fund_status_update",
      "fund_approval",
      'withdrawal_request',
      'withdrawal_approval',
      'withdrawal_status_update',
      'testimonial_approval',
      'testimonial_approved',
      'client_registration', // Add this
     'client_signup',      // And/or this
     'purchase_confirmation',
     'purchase_confirmed',
     'direct_commission',
     'indirect_commission',
     'support_message'
    ]
  },
  description: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for better query performance
activitySchema.index({ userId: 1 });
activitySchema.index({ role: 1 });
activitySchema.index({ activityType: 1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);