/**
 * SRCC Portal - Maintenance Mode Configuration
 * 
 * Set `enabled: true` to lock the website in Maintenance Mode for all visitors.
 * Only administrators with the admin password will be able to unlock and view the site.
 * 
 * Set `enabled: false` when you are ready to make the website live for everyone!
 */
window.SRCC_MAINTENANCE_CONFIG = {
  // Master toggle: true = Under Maintenance, false = Live for public
  enabled: true,

  // Announcement details shown to visitors
  title: "Website Under Maintenance",
  badge: "🛠️ Scheduled System Maintenance",
  subtitle: "Shri Ram College of Commerce · Digital Timetable Portal",
  message: "We are currently conducting scheduled system upgrades, database optimization, and timetable maintenance to bring you an improved experience. Access to student features and timetable tools is temporarily paused.",
  estimatedTime: "Updates currently in progress · Please check back shortly",
  contactEmail: "srcc@srcc.du.ac.in",
  lastUpdated: "October 2026",

  // Enable administrator bypass via password
  allowAdminBypass: true
};
