// Production Database Setup Script
const mongoose = require('mongoose');
const User = require('./models/User');
const Client = require('./models/Client');
const bcrypt = require('bcryptjs');

async function setupProduction() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/orm-management');
    console.log('✅ Connected to MongoDB');

    // Create admin user if it doesn't exist
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log('👤 Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const admin = new User({
        email: 'admin@acetrack.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Admin user created: admin@acetrack.com / admin123');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Create sample client if none exist
    const clientExists = await Client.findOne();
    if (!clientExists) {
      console.log('🏢 Creating sample client...');
      const sampleClient = new Client({
        name: 'Sample Client',
        contact: JSON.stringify({
          email: 'client@example.com',
          phone: '+1234567890',
          company: 'Sample Company'
        }),
        industry: 'Technology',
        businessType: 'SaaS',
        targetAudience: 'Developers',
        region: 'US',
        website: 'https://example.com',
        description: 'A sample client for testing'
      });
      
      await sampleClient.save();
      console.log('✅ Sample client created');
    } else {
      console.log('✅ Clients already exist');
    }

    console.log('🎉 Production setup complete!');
    console.log('📝 Next steps:');
    console.log('   1. Change admin password');
    console.log('   2. Create your first scan');
    console.log('   3. Test all features');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup error:', error);
    process.exit(1);
  }
}

setupProduction();
