# QA Team Dashboard

A modern, comprehensive dashboard for Quality Engineering and Assurance teams to manage team members, track work hours, assign tasks, and monitor team performance.

## Features

### 🏠 **Overview Dashboard**
- Real-time team statistics (total members, availability, tasks)
- Recent activity feed
- Quick action buttons
- Performance metrics at a glance

### 👥 **Team Management**
- Add and manage team members
- Track member roles and contact information
- Update availability status (Available, Busy, On Leave)
- Visual team member cards with avatars

### 📋 **Task Management**
- Create and assign tasks to team members (role-based)
- Set task priorities (High, Medium, Low)
- Track task status (Pending, In Progress, Completed)
- Due date tracking and visual priority indicators
- Role-based task visibility and editing

### ⏰ **Work Hours Tracking**
- Log daily work hours (own hours or team hours based on role)
- Categorize activities (Testing, Automation, Review, etc.)
- Track time spent on different activities
- Historical work logs view with role-based filtering

### 📊 **Analytics & Reports**
- Role-based data filtering (personal/team/organization)
- Team performance metrics
- Task status distribution
- Work hours analytics
- Visual status indicators and breakdowns

### 🔐 **Role-Based Authorization System**
- **Regular Employee (QA Analyst/Engineer):**
  - Edit own availability and information
  - Log own work hours
  - View and update tasks assigned to them
  - View personal analytics only
  
- **Team Lead/Senior QA:**
  - All Regular Employee permissions
  - Manage team members (add, edit availability)
  - Assign tasks to team members
  - View team analytics and work logs
  - Edit team member task statuses
  
- **QA Manager/Admin:**
  - Full system access
  - Manage all users and teams
  - Assign tasks to anyone
  - View organization-wide analytics
  - Log work hours for any team member

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Database**: JSON files (simple file-based storage)
- **Styling**: Modern CSS with gradients and animations
- **Icons**: Font Awesome icons

## Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)

## Installation & Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

3. **Access the Dashboard**
   Open your web browser and go to:
   ```
   http://localhost:3000
   ```

## Project Structure

```
qa-team-dashboard/
├── data/                    # JSON data files (auto-created)
│   ├── team-members.json   # Team member data
│   ├── work-logs.json      # Work hour logs
│   └── tasks.json          # Task data
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # CSS styling
│   └── script.js          # JavaScript functionality
├── server.js              # Express.js backend server
├── package.json           # Node.js dependencies and scripts
└── README.md              # This file
```

## Usage Guide

### Getting Started

1. **First Time Setup**: When you first run the application, it will create sample users with different roles:
   - **QA Manager**: admin@qa-team.com / admin123 (Full access)
   - **Team Lead**: lead@qa-team.com / lead123 (Team management access)
   - **Regular Employee**: analyst@qa-team.com / analyst123 (Personal access only)
   - Sample tasks and team data pre-loaded

2. **Account Creation**: New users must select both:
   - Job Title (QA Analyst, QA Engineer, Senior QA Engineer, QA Lead, QA Manager)
   - Position Level (Regular Employee, Team Lead, QA Manager/Admin)

3. **Navigation**: Available tabs depend on your role:
   - **All Users**: Overview, Work Logs (personal data)
   - **Team Leads**: Team Members (team view), Tasks (team tasks)
   - **QA Managers**: Full access to all sections with organization-wide data

### Adding Team Members

1. Go to the "Team Members" tab
2. Click "Add Member" button
3. Fill in the required information:
   - Full Name
   - Email Address
   - Role (Senior QA Engineer, QA Engineer, QA Analyst, QA Lead)
   - Initial availability status
4. Click "Add Member" to save

### Creating Tasks

1. Navigate to the "Tasks" tab
2. Click "Add Task" button
3. Enter task details:
   - Task Title
   - Assign to team member
   - Priority level
   - Due date
   - Optional description
4. Click "Add Task" to create

### Logging Work Hours

1. Go to the "Work Logs" tab
2. Click "Log Hours" button
3. Fill in the work log:
   - Select team member
   - Hours worked (0.5 to 12 hours)
   - Activity description
   - Category (Testing, Automation, Review, etc.)
4. Click "Log Hours" to save

### Updating Status

- **Team Member Availability**: Click "Update Status" button on member cards
- **Task Status**: Click "Update Status" button on task cards
- Use the prompts to change status values

## API Endpoints

The application provides RESTful API endpoints:

### Team Members
- `GET /api/team-members` - Get all team members
- `POST /api/team-members` - Add new team member
- `PUT /api/team-members/:id` - Update team member

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task

### Work Logs
- `GET /api/work-logs` - Get all work logs
- `POST /api/work-logs` - Add new work log

### Analytics
- `GET /api/analytics` - Get dashboard analytics

## Data Storage

The application uses simple JSON files for data storage:

- **team-members.json**: Stores team member information
- **work-logs.json**: Stores work hour entries
- **tasks.json**: Stores task information

Data files are automatically created in the `data/` directory when the server starts.

## Customization

### Adding New Activity Categories
Edit the worklog category options in `public/index.html`:
```html
<select id="worklog-category">
    <option value="testing">Testing</option>
    <option value="automation">Automation</option>
    <!-- Add your custom categories here -->
</select>
```

### Modifying Team Roles
Update the role options in `public/index.html`:
```html
<select id="member-role" required>
    <option value="Senior QA Engineer">Senior QA Engineer</option>
    <!-- Add your custom roles here -->
</select>
```

### Styling Changes
Modify `public/styles.css` to customize colors, layout, and styling to match your organization's branding.

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Change the port in `server.js` or set environment variable:
   ```bash
   PORT=3001 npm start
   ```

2. **Data Not Persisting**
   - Ensure write permissions in the project directory
   - Check that the `data/` folder is created successfully

3. **Modules Not Found**
   - Run `npm install` to install dependencies
   - Ensure you're in the correct project directory

### Browser Compatibility

This dashboard works best with modern browsers that support:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Fetch API

Recommended browsers:
- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Future Enhancements

Potential improvements for future versions:
- Database integration (PostgreSQL, MongoDB)
- User authentication and role-based access
- Email notifications for task assignments
- Advanced reporting with charts
- File upload for test results
- Integration with testing tools
- Mobile responsive improvements
- Dark mode theme

## Contributing

This is a beginner-friendly QEA project. Feel free to:
- Add new features
- Improve the UI/UX
- Fix bugs
- Add more comprehensive reporting
- Enhance the testing functionality

## License

MIT License - feel free to use this project for learning and development purposes.

---

**Happy Quality Assuring! 🚀** 