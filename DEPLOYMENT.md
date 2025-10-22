# 🚀 Vercel Deployment Guide

## Prerequisites
- Vercel account (free tier available)
- MongoDB Atlas account (free tier available)
- GitHub repository

## Step 1: Prepare Your Project

### 1.1 Update Environment Variables
Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

### 1.2 Set Up MongoDB Atlas
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster
3. Get your connection string
4. Update `MONGODB_URI` in your environment variables

### 1.3 Get API Keys
- **OpenAI API Key**: For sentiment analysis
- **Google Custom Search API**: For search results
- **JWT Secret**: Generate a secure random string

## Step 2: Deploy to Vercel

### 2.1 Install Vercel CLI
```bash
npm i -g vercel
```

### 2.2 Login to Vercel
```bash
vercel login
```

### 2.3 Deploy
```bash
# From your project root
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (your account)
# - Link to existing project? N
# - Project name? acetrack-orm
# - Directory? ./
# - Override settings? N
```

### 2.4 Set Environment Variables in Vercel
Go to your Vercel dashboard → Project Settings → Environment Variables:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/orm-management
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=your-openai-api-key
GOOGLE_SEARCH_API_KEY=your-google-search-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id
CORS_ORIGIN=https://your-domain.vercel.app
```

## Step 3: Configure Build Settings

### 3.1 Build Command
```bash
cd client && npm run build
```

### 3.2 Output Directory
```
client/build
```

### 3.3 Install Command
```bash
npm run install-all
```

## Step 4: Database Setup

### 4.1 Create Initial Data
After deployment, you'll need to create:
- Admin user account
- Test clients
- Sample scan data

### 4.2 Access Your Deployed App
Your app will be available at:
```
https://your-project-name.vercel.app
```

## Step 5: Production Checklist

### ✅ Environment Variables Set
- [ ] MongoDB Atlas connection string
- [ ] JWT secret key
- [ ] OpenAI API key
- [ ] Google Search API credentials
- [ ] CORS origin set to your domain

### ✅ Database Ready
- [ ] MongoDB Atlas cluster created
- [ ] Database connection working
- [ ] Initial admin user created

### ✅ API Endpoints Working
- [ ] Health check: `/api/health`
- [ ] Authentication: `/api/auth/login`
- [ ] Scans: `/api/scans`
- [ ] Reports: `/api/reports`

## Troubleshooting

### Common Issues

1. **Build Fails**
   - Check that all dependencies are in `package.json`
   - Ensure build command is correct
   - Check for TypeScript errors

2. **Database Connection Issues**
   - Verify MongoDB Atlas connection string
   - Check IP whitelist in MongoDB Atlas
   - Ensure database name is correct

3. **API Routes Not Working**
   - Check Vercel function logs
   - Verify route configuration in `vercel.json`
   - Test API endpoints individually

4. **CORS Issues**
   - Update `CORS_ORIGIN` environment variable
   - Check frontend API base URL

### Getting Help
- Check Vercel function logs in dashboard
- Use `vercel logs` command
- Test API endpoints with Postman/curl

## Cost Breakdown (Free Tier)

### Vercel Free Tier
- ✅ 100GB bandwidth/month
- ✅ 100 serverless function executions
- ✅ Unlimited static deployments
- ✅ Custom domains

### MongoDB Atlas Free Tier
- ✅ 512MB storage
- ✅ Shared clusters
- ✅ Basic monitoring

### Total Cost: $0/month 🎉

## Next Steps After Deployment

1. **Create Admin Account**
   - Use the signup endpoint to create your admin user
   - Set up your first client

2. **Test All Features**
   - Create a scan
   - Test ranking position tracking
   - Generate reports

3. **Monitor Performance**
   - Check Vercel analytics
   - Monitor MongoDB Atlas usage
   - Set up error tracking

4. **Scale Up (if needed)**
   - Upgrade to Vercel Pro for more bandwidth
   - Upgrade MongoDB Atlas for more storage
   - Add custom domain
