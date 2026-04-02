# 🗄️ MongoDB Atlas Setup for Vercel Production

## ✅ Prerequisites
- MongoDB Atlas account (free tier available)
- Vercel project configured
- Backend URL: https://mentorship-backend-silk.vercel.app

---

## 🔧 Step 1: Enable Network Access in MongoDB Atlas

### **CRITICAL ISSUE**: Vercel IPs need to be whitelisted!

1. Go to: https://cloud.mongodb.com/
2. Click your **Cluster** → **Network Access** (in left sidebar)
3. Click **ADD IP ADDRESS**
4. Choose **ALLOW ACCESS FROM ANYWHERE**
   - This allows any IP to connect (Vercel's IPs change dynamically)
   - Connection is still secured by username/password
5. Click **Confirm**

**⚠️ Important**: Even though this allows any IP, your connection is still protected by:
- Database username & password (in connection string)
- Custom database read/write rules (if configured)
- HTTPS encryption

---

## 🔑 Step 2: Verify MongoDB Connection String

Your current `MONGODB_URI`:
```
mongodb+srv://Debajyoti:debajyoti2003@cluster0.355rd63.mongodb.net/mentorship-platform?retryWrites=true&w=majority
```

**Verify each part:**

1. **Username**: `Debajyoti` ✅
2. **Password**: `debajyoti2003` ✅
3. **Cluster**: `cluster0.355rd63.mongodb.net` ✅
4. **Database**: `mentorship-platform` ✅
5. **Options**: `retryWrites=true&w=majority` ✅

---

## 📋 Step 3: Set MongoDB URI on Vercel

1. Go to: https://vercel.com/debajyoti-samantas-projects/mentorship-backend
2. Click **Settings** → **Environment Variables**
3. Add variable:
   - **Name**: `MONGODB_URI`
   - **Value**: `mongodb+srv://Debajyoti:debajyoti2003@cluster0.355rd63.mongodb.net/mentorship-platform?retryWrites=true&w=majority`
4. Click **Save**
5. Go to **Deployments** → Click **Redeploy**

---

## 🧪 Step 4: Test MongoDB Connection

### Test 1: Backend Health (gives basic info)
```
https://mentorship-backend-silk.vercel.app/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-04-02T...","uptime":...}
```

### Test 2: Check Vercel Logs (shows detailed errors)
1. Go to Vercel Backend project
2. Click **Deployments**
3. Click latest deployment
4. Scroll down to **Function Logs**
5. Look for connection information

**Expected in logs:**
```
✅ MongoDB Connected Successfully: cluster0.355rd63.mongodb.net
   Database: mentorship-platform
```

**If you see errors:**
```
❌ MongoDB Connection Error (Attempt 1): getaddrinfo ENOTFOUND
❌ MongoDB Connection Error (Attempt 2): ...
```

---

## ❌ Common MongoDB Connection Issues

### **Issue 1: "ECONNREFUSED" - Connection Refused**
**Cause**: MongoDB is not reachable
**Solution**:
1. Check MongoDB Atlas Cluster is running (not paused)
2. Enable "Network Access" to allow all IPs
3. Verify cluster URL in connection string

### **Issue 2: "ETIMEDOUT" - Connection Timeout**
**Cause**: Firewall or network blocking
**Solution**:
1. Check your network connection
2. Use VPN if on restricted network
3. Verify Vercel can reach MongoDB Asia servers

### **Issue 3: "MongoServerSelectionError"**
**Cause**: Cannot reach any MongoDB servers
**Solution**:
1. Verify `MONGODB_URI` is correct
2. Check database username/password
3. Ensure cluster URL matches (cluster0.355rd63...)

### **Issue 4: "authentication failed"**
**Cause**: Wrong credentials in connection string
**Solution**:
1. Verify username: `Debajyoti`
2. Verify password: `debajyoti2003`
3. Check for URL encoding (@ should be %40 if not using `mongodb+srv://`)

---

## 🔍 Debugging Steps

### **Local Test** (if running locally)
```bash
cd backend
node -e "
const mongoose = require('mongoose');
const uri = 'mongodb+srv://Debajyoti:debajyoti2003@cluster0.355rd63.mongodb.net/mentorship-platform?retryWrites=true&w=majority';
mongoose.connect(uri).then(() => {
  console.log('✅ MongoDB connection successful');
  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
"
```

### **Vercel Logs** (real-time monitoring)
1. Deploy latest code
2. Go to Vercel Deployments
3. Click latest deployment
4. Watch Function Logs in real-time
5. Look for MongoDB connection messages

### **MongoDB Atlas Dashboard**
1. Go to https://cloud.mongodb.com/
2. Click your Cluster
3. Go to **Monitoring** tab
4. Check:
   - Active connections
   - Operation rates
   - Error logs

---

## ✅ Checklist for Production

- [ ] Network Access enabled in MongoDB Atlas (allow any IP)
- [ ] `MONGODB_URI` is set on Vercel
- [ ] Connection string username/password verified
- [ ] Database `mentorship-platform` exists
- [ ] Collections created (check in MongoDB Atlas)
- [ ] Backend redeployed on Vercel
- [ ] Backend health endpoint works
- [ ] Sign up/login works without database errors
- [ ] Check Vercel logs show successful connection

---

## 🚀 Expected Workflow

```
User tries to sign in
         ↓
Frontend sends request to Vercel backend
         ↓
Backend checks database connection
  ├─ ✅ Connected → Query MongoDB for user
  └─ ❌ Not connected → Return error 503
         ↓
MongoDB returns user data
         ↓
Backend creates JWT token
         ↓
Token returned to frontend
         ↓
User logged in successfully ✅
```

---

## 📞 Emergency Troubleshooting

If sign in still fails after all steps:

1. **Check Vercel Logs**:
   - Deployment page → Function Logs
   - Search for "MongoDB"
   - Copy exact error message

2. **Check MongoDB Atlas**:
   - Go to cluster → Network Access
   - Verify "ALLOW ACCESS FROM ANYWHERE" is enabled
   - Go to Database Users → Verify `Debajyoti` user exists

3. **Test Connection String**:
   - Verify format: `mongodb+srv://username:password@cluster/database`
   - Check for special characters in password
   - Ensure no typos

4. **Check Firewall**:
   - If using VPN, temporarily disable
   - Try from different network if possible
   - Ask IT if behind corporate firewall

5. **Restart Everything**:
   - Redeploy backend on Vercel
   - Clear browser cache
   - Try incognito/private mode
   - Try from different device

---

## 📚 Useful Links

- **MongoDB Atlas**: https://cloud.mongodb.com/
- **Vercel Deployments**: https://vercel.com/debajyoti-samantas-projects/mentorship-backend/deployments
- **MongoDB Documentation**: https://docs.mongodb.com/

---

**Your MongoDB Connection String is configured correctly. Just ensure Vercel environment variables are set!** ✅
