# Email Marketing System - Admin Guide

## Overview
The Email Marketing system allows administrators to send professional marketing emails to users and sellers. It supports both bulk campaigns and individual emails with multiple templates.

## Features

### 📧 **Email Templates**
- **Marketing**: Promotional content with call-to-action buttons
- **Newsletter**: Regular updates and news with clean formatting
- **Announcement**: Important notifications with highlighted content
- **Promotion**: Special offers with urgent styling and prominent CTAs
- **Official**: Formal business communication with professional layout
- **Custom**: Basic template for custom content

### 👥 **Recipient Options**
- **All Users**: Send to all registered users
- **All Sellers**: Send to all sellers
- **Active Users**: Send to active users and sellers only
- **Suspended Users**: Send to suspended accounts
- **Specific Users**: Choose individual recipients

### 🚀 **Campaign Management**
- Create and save draft campaigns
- Schedule campaigns for future sending
- Preview emails before sending
- Track delivery statistics
- Monitor campaign performance

## How to Use

### 1. **Access Email Marketing**
- Login as admin
- Navigate to **Admin Panel > Emails**
- You'll see three main tabs: Campaigns, Send Individual, Statistics

### 2. **Create a Campaign**
1. Click **"New Campaign"** button
2. Fill in campaign details:
   - **Campaign Title**: Internal name for the campaign
   - **Email Subject**: What recipients will see in their inbox
   - **Template**: Choose appropriate template type
   - **Recipients**: Select target audience
   - **Content**: Write your email content
   - **Schedule** (optional): Set future send time
3. Click **"Preview"** to see how the email will look
4. Click **"Create Campaign"** to save as draft

### 3. **Send a Campaign**
1. Go to **Campaigns** tab
2. Find your campaign in the list
3. Click the **send icon** (paper airplane)
4. Confirm sending
5. Campaign status will change to "Sending" then "Sent"

### 4. **Send Individual Email**
1. Go to **Send Individual** tab
2. Enter recipient email and name
3. Choose template and write content
4. Click **"Preview"** to review
5. Click **"Send Email"**

### 5. **View Statistics**
- Go to **Statistics** tab to see:
  - Total campaigns created
  - Total emails sent
  - Overall delivery rate
  - Recent campaign performance

## Email Templates Guide

### Marketing Template
```
Subject: Special Offer Just for You!
Content: Announce your promotion with engaging copy and clear call-to-action
Best for: Product launches, sales, special offers
```

### Newsletter Template
```
Subject: Weekly Book Updates
Content: Share news, new arrivals, reading recommendations
Best for: Regular communication, community building
```

### Announcement Template
```
Subject: Important Update
Content: Share important information or policy changes
Best for: System updates, policy changes, important news
```

### Promotion Template
```
Subject: Limited Time Offer - 50% Off!
Content: Create urgency with time-sensitive offers
Best for: Flash sales, limited-time discounts
```

### Official Template
```
Subject: Account Information Update
Content: Formal communication for business matters
Best for: Legal notices, account updates, formal communications
```

## Best Practices

### ✅ **Do's**
- Write clear, compelling subject lines
- Keep content concise and focused
- Use appropriate templates for your message type
- Preview emails before sending
- Test with individual emails first
- Monitor delivery rates and engagement

### ❌ **Don'ts**
- Don't send too frequently (respect user preferences)
- Don't use misleading subject lines
- Don't send to suspended users unless necessary
- Don't forget to proofread content
- Don't send without previewing first

## Technical Details

### Backend Endpoints
- `GET /api/admin/email-campaigns` - List campaigns
- `POST /api/admin/email-campaigns` - Create campaign
- `POST /api/admin/email-campaigns/:id/send` - Send campaign
- `POST /api/admin/send-individual-email` - Send individual email
- `POST /api/admin/email-campaigns/preview` - Preview email
- `GET /api/admin/email-campaigns/stats/overview` - Get statistics

### Database Models
- **EmailCampaign**: Stores campaign information and statistics
- **User**: Contains recipient information and preferences

### Email Service
- Uses Nodemailer with Gmail SMTP
- Supports HTML templates with responsive design
- Batch processing for bulk emails (10 emails per batch)
- Error handling and retry logic

## Troubleshooting

### Common Issues

**Email not sending:**
- Check email service configuration in `.env`
- Verify Gmail app password is correct
- Check recipient email addresses are valid

**Template not displaying correctly:**
- Ensure HTML content is properly formatted
- Test preview before sending
- Check for special characters in content

**Low delivery rates:**
- Verify email service credentials
- Check spam folder recommendations
- Review email content for spam triggers

### Support
For technical issues or questions about the email marketing system, contact the development team or check the application logs for detailed error messages.

## Security Notes
- Only admin users can access email marketing features
- All email sending is logged for audit purposes
- Recipient data is handled according to privacy policies
- Email content should comply with anti-spam regulations