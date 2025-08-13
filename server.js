const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple session storage (in production, use proper session management)
const sessions = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Data file paths
const DATA_DIR = 'data';
const TEAM_MEMBERS_FILE = path.join(DATA_DIR, 'team-members.json');
const WORK_LOGS_FILE = path.join(DATA_DIR, 'work-logs.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helper functions (moved here to be available for initialization)
const readJsonFile = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const writeJsonFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Authentication helper functions
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const verifyPassword = (inputPassword, hashedPassword) => {
    return hashPassword(inputPassword) === hashedPassword;
};

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = session.user;
    next();
};

// Role hierarchy and permission system (simplified)
const POSITIONS = {
    EMPLOYEE: 'Employee',
    ADMIN: 'Admin'
};

// Internal position mapping for backward compatibility
const INTERNAL_POSITIONS = {
    'Regular Employee': 'Employee',
    'Team Lead': 'Admin', 
    'QA Manager': 'Admin'
};

const POSITION_HIERARCHY = {
    [POSITIONS.EMPLOYEE]: 1,
    [POSITIONS.ADMIN]: 2
};

// Permission checking functions
const hasPermission = (userPosition, requiredPosition) => {
    return POSITION_HIERARCHY[userPosition] >= POSITION_HIERARCHY[requiredPosition];
};

// Helper function to convert old positions to new system
const normalizePosition = (position) => {
    return INTERNAL_POSITIONS[position] || position;
};

const canEditUser = (currentUser, targetUserId) => {
    // Users can always edit themselves
    if (currentUser.id == targetUserId) return true;
    
    // Admins can edit anyone
    const userPos = normalizePosition(currentUser.position);
    if (userPos === POSITIONS.ADMIN) return true;
    
    return false;
};

const canManageTeamMembers = (userPosition) => {
    const normalizedPos = normalizePosition(userPosition);
    return normalizedPos === POSITIONS.ADMIN;
};

const canAssignTasks = (userPosition) => {
    const normalizedPos = normalizePosition(userPosition);
    return normalizedPos === POSITIONS.ADMIN;
};

const canViewAllData = (userPosition) => {
    const normalizedPos = normalizePosition(userPosition);
    return normalizedPos === POSITIONS.ADMIN;
};

const canViewTeamData = (currentUser, targetUserId) => {
    // Admins can view everything
    const userPos = normalizePosition(currentUser.position);
    if (userPos === POSITIONS.ADMIN) return true;
    
    // Users can view their own data
    if (currentUser.id == targetUserId) return true;
    
    return false;
};

// Data Synchronization Functions
const syncUserAndTeamMemberData = () => {
    const users = readJsonFile(USERS_FILE);
    const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
    let usersUpdated = false;
    let teamMembersUpdated = false;

    console.log('Starting data synchronization...');

    // Sync missing team members to users (create login accounts)
    teamMembers.forEach(member => {
        const existingUser = users.find(u => u.email === member.email);
        if (!existingUser) {
            // Create user account for team member
            const newUser = {
                id: member.id, // Use same ID
                email: member.email,
                password: "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2", // Default: "hello123"
                name: member.name,
                role: member.role,
                position: getPositionFromRole(member.role),
                teamId: member.teamId || 1,
                createdDate: member.joinDate || new Date().toISOString().split('T')[0],
                isActive: true,
                needsPasswordReset: true // Flag to require password reset on first login
            };
            users.push(newUser);
            usersUpdated = true;
            console.log(`✅ Created login account for team member: ${member.email} (password: hello123)`);
        }
    });

    // Sync missing users to team members (create team profiles)
    users.forEach(user => {
        if (user.email === 'admin@qa-team.com') return; // Skip admin user
        
        const existingMember = teamMembers.find(m => m.email === user.email);
        if (!existingMember) {
            // Create team member profile for user
            const newMember = {
                id: user.id, // Use same ID
                name: user.name,
                email: user.email,
                role: user.role,
                availability: "available",
                teamId: user.teamId || 1,
                joinDate: user.createdDate || new Date().toISOString().split('T')[0]
            };
            teamMembers.push(newMember);
            teamMembersUpdated = true;
            console.log(`✅ Created team member profile for user: ${user.email}`);
        }
    });

    // Fix ID mismatches (use user ID as primary)
    users.forEach(user => {
        const member = teamMembers.find(m => m.email === user.email);
        if (member && member.id !== user.id) {
            console.log(`🔧 Fixing ID mismatch for ${user.email}: ${member.id} -> ${user.id}`);
            member.id = user.id;
            teamMembersUpdated = true;
        }
    });

    // Save updates
    if (usersUpdated) {
        writeJsonFile(USERS_FILE, users);
        console.log('💾 Users file updated with new accounts');
    }
    
    if (teamMembersUpdated) {
        writeJsonFile(TEAM_MEMBERS_FILE, teamMembers);
        console.log('💾 Team members file updated with new profiles');
    }

    if (!usersUpdated && !teamMembersUpdated) {
        console.log('✅ Data already synchronized');
    }

    return { usersUpdated, teamMembersUpdated };
};

const getPositionFromRole = (role) => {
    if (role === 'QA Manager') return 'QA Manager';
    if (role === 'QA Lead' || role === 'Senior QA Engineer') return 'Team Lead';
    return 'Regular Employee';
};

// Authorization middleware
const requirePermission = (permissionCheck) => {
    return (req, res, next) => {
        if (!permissionCheck(req.user)) {
            return res.status(403).json({ 
                error: 'Insufficient permissions',
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};

const requireUserAccess = (req, res, next) => {
    const targetUserId = req.params.id || req.body.memberId || req.body.assignedTo;
    
    if (!canEditUser(req.user, targetUserId)) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only modify your own data or data of your team members (if you are a Team Lead)'
        });
    }
    next();
};

// Audit logging function
const logActivity = (action, userId, targetId = null, details = {}) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        userId,
        targetId,
        details,
        id: Date.now()
    };
    
    // In a real application, this would go to a proper logging system
    console.log('AUDIT LOG:', JSON.stringify(logEntry, null, 2));
};

// Initialize data files if they don't exist
const initDataFile = (filePath, defaultData) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
};

// Initialize default data
initDataFile(TEAM_MEMBERS_FILE, [
    {
        id: 1,
        name: "John Doe",
        role: "Senior QA Engineer",
        email: "john.doe@company.com",
        availability: "available",
        joinDate: "2024-01-15"
    },
    {
        id: 2,
        name: "Jane Smith",
        role: "QA Analyst",
        email: "jane.smith@company.com",
        availability: "busy",
        joinDate: "2024-02-01"
    }
]);

initDataFile(WORK_LOGS_FILE, []);
initDataFile(TASKS_FILE, [
    {
        id: 1,
        title: "Test Login Functionality",
        assignedTo: 1,
        status: "in-progress",
        priority: "high",
        createdDate: "2024-12-20",
        dueDate: "2024-12-22"
    },
    {
        id: 2,
        title: "UI Regression Testing",
        assignedTo: 2,
        status: "pending",
        priority: "medium",
        createdDate: "2024-12-20",
        dueDate: "2024-12-25"
    }
]);

// Initialize users with default admin account
initDataFile(USERS_FILE, [
    {
        id: 1,
        email: "admin@qa-team.com",
        password: hashPassword("admin123"),
        name: "QA Administrator",
        role: "QA Manager",
        position: "QA Manager",
        teamId: null, // Admins don't belong to specific teams
        createdDate: "2024-12-20",
        isActive: true
    },
    {
        id: 2,
        email: "lead@qa-team.com",
        password: hashPassword("lead123"),
        name: "Sarah Wilson",
        role: "QA Lead",
        position: "Team Lead",
        teamId: 1,
        createdDate: "2024-12-20",
        isActive: true
    },
    {
        id: 3,
        email: "analyst@qa-team.com",
        password: hashPassword("analyst123"),
        name: "Mike Johnson",
        role: "QA Analyst",
        position: "Regular Employee",
        teamId: 1,
        createdDate: "2024-12-20",
        isActive: true
    }
]);

// API Routes

// Authentication routes
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    
    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ 
            error: 'Invalid credentials',
            message: 'Email or password is incorrect. Please try again or sign up for a new account.'
        });
    }
    
    // Create session
    const token = generateSessionToken();
    const sessionData = {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            position: normalizePosition(user.position) || POSITIONS.EMPLOYEE, // Default for legacy users
            teamId: user.teamId
        },
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    sessions.set(token, sessionData);
    
    // Log the login activity
    logActivity('USER_LOGIN', user.id, null, { email: user.email });
    
    res.json({
        success: true,
        token,
        user: sessionData.user,
        message: 'Login successful'
    });
});

// Admin-only employee registration endpoint
app.post('/api/admin/register-employee', 
    authenticateToken,
    requirePermission(user => user.position === 'QA Manager' || user.position === 'Team Lead'),
    (req, res) => {
        try {
            const { 
                email, password, name, role, position, availability,
                phone, emergencyContact, address, city, state, zipcode,
                employeeId, joinDate, department, employmentType,
                skills, education, experience, certifications
            } = req.body;
            
            // Validate required fields (address and education fields are now optional)
            const requiredFields = {
                email, password, name, role, position, phone, emergencyContact,
                employeeId, joinDate, department, employmentType
            };
            
            const missingFields = Object.keys(requiredFields).filter(field => !requiredFields[field]);
            if (missingFields.length > 0) {
                return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
            }
            
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }
            
            // Validate position (simplified to Employee/Admin)
            const validPositions = ['Employee', 'Admin'];
            if (!validPositions.includes(position)) {
                return res.status(400).json({ error: 'Invalid position selected' });
            }
            
            const users = readJsonFile(USERS_FILE);
            const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
            
            // Check if user already exists
            const emailLower = email.toLowerCase();
            if (users.find(u => u.email.toLowerCase() === emailLower)) {
                return res.status(409).json({ error: 'User with this email already exists' });
            }
            
            // Check if employee ID already exists
            if (teamMembers.find(m => m.employeeId === employeeId)) {
                return res.status(409).json({ error: 'Employee ID already exists' });
            }
            
            // Convert position to internal format
            let internalPosition;
            if (position === 'Admin') {
                internalPosition = role === 'QA Manager' ? 'QA Manager' : 'Team Lead';
            } else {
                internalPosition = 'Regular Employee';
            }
            
            // Assign team based on creating user's position
            let teamId = 1; // Default team
            if (req.user.position === 'Team Lead') {
                teamId = req.user.teamId; // Team leads can only add to their team
            }
            
            const userId = Date.now();
            
            // Create user account
            const newUser = {
                id: userId,
                email: emailLower,
                password: hashPassword(password),
                name,
                role: role,
                position: internalPosition,
                teamId: teamId,
                createdDate: new Date().toISOString().split('T')[0],
                isActive: true,
                needsPasswordReset: true // Force password change on first login
            };
            
            // Create comprehensive team member profile
            const newMember = {
                id: userId,
                name,
                email: emailLower,
                role: role,
                availability: availability || 'available',
                teamId: teamId,
                joinDate: joinDate,
                
                // Contact Information
                phone,
                emergencyContact,
                address: address || '',
                city: city || '',
                state: state || '',
                zipcode: zipcode || '',
                
                // Professional Details
                employeeId,
                department,
                employmentType,
                
                // Skills & Education
                skills: skills || '',
                education: education || '',
                experience: parseInt(experience) || 0,
                certifications: certifications || ''
            };
            
            // Save both records
            users.push(newUser);
            teamMembers.push(newMember);
            writeJsonFile(USERS_FILE, users);
            writeJsonFile(TEAM_MEMBERS_FILE, teamMembers);
            
            // Log the registration activity
            logActivity('ADMIN_REGISTER_EMPLOYEE', req.user.id, newUser.id, { 
                employeeEmail: newUser.email, 
                employeeRole: newUser.role, 
                employeePosition: newUser.position,
                employeeId: employeeId
            });
            
            res.json({
                success: true,
                message: 'Employee registered successfully',
                employee: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    position: position, // Return simplified position
                    employeeId: employeeId
                }
            });
        } catch (error) {
            console.error('Error registering employee:', error);
            res.status(500).json({ error: 'Internal server error while registering employee' });
        }
    }
);

// Password change endpoint for first-time login
app.post('/api/auth/change-password',
    authenticateToken,
    (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current password and new password are required' });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long' });
            }
            
            const users = readJsonFile(USERS_FILE);
            const userIndex = users.findIndex(u => u.id === req.user.id);
            
            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const user = users[userIndex];
            
            // Verify current password
            if (!bcrypt.compareSync(currentPassword, user.password)) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
            
            // Update password and remove reset flag
            users[userIndex] = {
                ...user,
                password: hashPassword(newPassword),
                needsPasswordReset: false
            };
            
            writeJsonFile(USERS_FILE, users);
            
            // Log the password change
            logActivity('PASSWORD_CHANGED', req.user.id, null, { 
                isFirstTimeChange: user.needsPasswordReset || false
            });
            
            // Create new session with updated user
            const token = generateSessionToken();
            const sessionData = {
                user: {
                    id: users[userIndex].id,
                    email: users[userIndex].email,
                    name: users[userIndex].name,
                    role: users[userIndex].role,
                    position: users[userIndex].position,
                    teamId: users[userIndex].teamId,
                    needsPasswordReset: false
                },
                expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            
            sessions.set(token, sessionData);
            
            res.json({
                success: true,
                token,
                user: sessionData.user,
                message: 'Password updated successfully'
            });
        } catch (error) {
            console.error('Error changing password:', error);
            res.status(500).json({ error: 'Internal server error while changing password' });
        }
    }
);

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        sessions.delete(token);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    const users = readJsonFile(USERS_FILE);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
        return res.status(404).json({ error: 'No account found with this email address' });
    }
    
    // In a real application, you would send an email here
    // For this demo, we'll return a temporary reset code
    const resetCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    res.json({
        success: true,
        message: 'Password reset instructions sent to your email',
        tempResetCode: resetCode, // In production, this would be sent via email
        note: 'Demo: Use this code to reset your password'
    });
});

app.post('/api/auth/reset-password', (req, res) => {
    const { email, resetCode, newPassword } = req.body;
    
    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Email and new password are required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    // In a real application, you would verify the reset code here
    // For this demo, we'll accept any code and just update the password
    
    const users = readJsonFile(USERS_FILE);
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'No account found with this email address' });
    }
    
    users[userIndex].password = hashPassword(newPassword);
    writeJsonFile(USERS_FILE, users);
    
    res.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
    });
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Team Members (protected routes with role-based access)
app.get('/api/team-members', authenticateToken, (req, res) => {
    const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
    
    // All authenticated users can now see all team members
    logActivity('VIEW_ALL_TEAM_MEMBERS', req.user.id);
    res.json(teamMembers);
});

app.post('/api/team-members', 
    authenticateToken, 
    requirePermission(user => canManageTeamMembers(user.position)),
    (req, res) => {
        const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
        
        // Assign team based on user's position
        let assignedTeamId = req.body.teamId || 1; // Admins can assign to any team (default to team 1)
        
        const newMember = {
            id: Date.now(),
            ...req.body,
            teamId: assignedTeamId,
            joinDate: new Date().toISOString().split('T')[0]
        };
        
        teamMembers.push(newMember);
        writeJsonFile(TEAM_MEMBERS_FILE, teamMembers);
        
        logActivity('ADD_TEAM_MEMBER', req.user.id, newMember.id, { 
            memberName: newMember.name,
            teamId: assignedTeamId 
        });
        
        // Auto-sync data to create user account for new team member
        setTimeout(() => syncUserAndTeamMemberData(), 100);
        
        res.json(newMember);
    }
);

app.put('/api/team-members/:id', authenticateToken, (req, res) => {
    const targetUserId = parseInt(req.params.id);
    
    // Check if user has permission to edit this member
    if (!canEditUser(req.user, targetUserId)) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only edit your own information or your team members\' information (if you are a Team Lead)'
        });
    }
    
    const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
    const memberIndex = teamMembers.findIndex(m => m.id == targetUserId);
    
    if (memberIndex !== -1) {
        const userPos = normalizePosition(req.user.position);
        
        if (userPos === POSITIONS.ADMIN) {
            // Admins can edit everything
            teamMembers[memberIndex] = { ...teamMembers[memberIndex], ...req.body };
        } else {
            // Employees can edit their own profile fields (but not admin-only fields)
            const adminOnlyFields = ['employeeId', 'joinDate', 'department', 'employmentType', 'role', 'name', 'email'];
            const filteredUpdates = {};
            
            Object.keys(req.body).forEach(field => {
                if (!adminOnlyFields.includes(field)) {
                    filteredUpdates[field] = req.body[field];
                }
            });
            
            teamMembers[memberIndex] = { ...teamMembers[memberIndex], ...filteredUpdates };
        }
        
        writeJsonFile(TEAM_MEMBERS_FILE, teamMembers);
        
        logActivity('UPDATE_TEAM_MEMBER', req.user.id, targetUserId, { 
            changes: req.body,
            isOwnData: req.user.id == targetUserId 
        });
        
        res.json(teamMembers[memberIndex]);
    } else {
        res.status(404).json({ error: 'Team member not found' });
    }
});

// Work Logs (with role-based access control)
app.get('/api/work-logs', authenticateToken, (req, res) => {
    const workLogs = readJsonFile(WORK_LOGS_FILE);
    const users = readJsonFile(USERS_FILE);
    
    // Add user names to work logs
    const enrichedWorkLogs = workLogs.map(log => {
        const user = users.find(u => u.id === log.memberId);
        return {
            ...log,
            memberName: user ? user.name : 'Unknown User'
        };
    });
    
    // QA Managers can see all work logs
    if (canViewAllData(req.user.position)) {
        logActivity('VIEW_ALL_WORK_LOGS', req.user.id);
        return res.json(enrichedWorkLogs);
    }
    
    // Employees can only see their own work logs
    const myLogs = enrichedWorkLogs.filter(log => log.memberId === req.user.id);
    logActivity('VIEW_MY_WORK_LOGS', req.user.id);
    res.json(myLogs);
});

app.post('/api/work-logs', authenticateToken, (req, res) => {
    const workLogs = readJsonFile(WORK_LOGS_FILE);
    const memberId = req.body.memberId;
    
    const userPos = normalizePosition(req.user.position);
    
    // Users can only log hours for themselves, unless they're admins
    if (userPos !== POSITIONS.ADMIN && memberId !== req.user.id) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only log work hours for yourself'
        });
    }
    
    // Validate that the member exists and user has permission to log for them
    if (userPos === POSITIONS.ADMIN && memberId !== req.user.id) {
        const users = readJsonFile(USERS_FILE);
        const targetUser = users.find(u => u.id == memberId);
        if (!targetUser) {
            return res.status(400).json({ error: 'Target user not found' });
        }
    }
    
    const newLog = {
        id: Date.now(),
        ...req.body,
        loggedBy: req.user.id, // Track who logged the hours
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
    };
    
    workLogs.push(newLog);
    writeJsonFile(WORK_LOGS_FILE, workLogs);
    
    logActivity('LOG_WORK_HOURS', req.user.id, memberId, { 
        hours: newLog.hours,
        activity: newLog.activity,
        isOwnLog: memberId === req.user.id 
    });
    
    res.json(newLog);
});

// Tasks (with role-based access control)
app.get('/api/tasks', authenticateToken, (req, res) => {
    const tasks = readJsonFile(TASKS_FILE);
    
    // QA Managers can see all tasks
    if (canViewAllData(req.user.position)) {
        logActivity('VIEW_ALL_TASKS', req.user.id);
        return res.json(tasks);
    }
    
    // Employees can only see tasks assigned to them
    const myTasks = tasks.filter(task => task.assignedTo === req.user.id);
    logActivity('VIEW_MY_TASKS', req.user.id);
    res.json(myTasks);
});

app.post('/api/tasks', 
    authenticateToken, 
    requirePermission(user => canAssignTasks(user.position)),
    (req, res) => {
        try {
            const tasks = readJsonFile(TASKS_FILE);
            const users = readJsonFile(USERS_FILE);
            const teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
            
            // Validate required fields
            const { title, assignedTo, priority, dueDate } = req.body;
            
            if (!title || !title.trim()) {
                return res.status(400).json({ error: 'Task title is required' });
            }
            
            if (!assignedTo) {
                return res.status(400).json({ error: 'Assignee is required' });
            }
            
            if (!priority) {
                return res.status(400).json({ error: 'Priority is required' });
            }
            
            if (!dueDate) {
                return res.status(400).json({ error: 'Due date is required' });
            }
            
            // Validate assignedTo user exists in team members
            const assigneeId = parseInt(assignedTo);
            const assignee = teamMembers.find(m => m.id === assigneeId);
            
            if (!assignee) {
                console.log('Task creation failed: Assignee ID', assigneeId, 'not found in team members');
                return res.status(400).json({ error: 'Assigned team member not found' });
            }
            
            // Also verify the assignee exists as a user (for permissions check)
            const assigneeUser = users.find(u => u.email === assignee.email || u.id === assigneeId);
        
            // Admins can assign tasks to anyone (already checked by canAssignTasks permission)
        
        const newTask = {
            id: Date.now(),
            ...req.body,
            createdBy: req.user.id,
            createdDate: new Date().toISOString().split('T')[0],
            status: 'pending'
        };
        
        tasks.push(newTask);
        writeJsonFile(TASKS_FILE, tasks);
        
            logActivity('CREATE_TASK', req.user.id, newTask.id, { 
                taskTitle: newTask.title,
                assignedTo: assigneeId,
                priority: newTask.priority 
            });
            
            res.json(newTask);
        } catch (error) {
            console.error('Error creating task:', error);
            res.status(500).json({ error: 'Internal server error while creating task' });
        }
    }
);

app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const taskId = parseInt(req.params.id);
    const tasks = readJsonFile(TASKS_FILE);
    const taskIndex = tasks.findIndex(t => t.id == taskId);
    
    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }
    
    const task = tasks[taskIndex];
    
    const userPos = normalizePosition(req.user.position);
    
    // Check permissions
    const canEdit = 
        userPos === POSITIONS.ADMIN || // Admins can edit all tasks
        task.createdBy === req.user.id || // Task creators can edit their tasks
        task.assignedTo === req.user.id; // Assignees can edit their tasks (status updates)
    
    if (!canEdit) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only edit tasks assigned to you or tasks you created'
        });
    }
    
    // Employees can only update status and add comments on their assigned tasks
    if (userPos === POSITIONS.EMPLOYEE && task.assignedTo === req.user.id) {
        const allowedFields = ['status', 'comments'];
        const filteredUpdates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                filteredUpdates[field] = req.body[field];
            }
        });
        tasks[taskIndex] = { ...tasks[taskIndex], ...filteredUpdates };
    } else {
        // Admins can edit all fields
        tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
    }
    
    writeJsonFile(TASKS_FILE, tasks);
    
    logActivity('UPDATE_TASK', req.user.id, taskId, { 
        changes: req.body,
        isAssignee: task.assignedTo === req.user.id 
    });
    
    res.json(tasks[taskIndex]);
});

// Analytics endpoint (with role-based data filtering)
app.get('/api/analytics', authenticateToken, (req, res) => {
    let teamMembers = readJsonFile(TEAM_MEMBERS_FILE);
    let workLogs = readJsonFile(WORK_LOGS_FILE);
    let tasks = readJsonFile(TASKS_FILE);
    const users = readJsonFile(USERS_FILE);

    const userPos = normalizePosition(req.user.position);
    
    // Keep original team members data for stats (everyone can see team counts)
    const allTeamMembers = teamMembers;
    
    // Filter data based on user position
    if (userPos === POSITIONS.EMPLOYEE) {
        // Employees can see all team members for stats, but only their own work logs and tasks
        workLogs = workLogs.filter(log => log.memberId === req.user.id);
        tasks = tasks.filter(task => task.assignedTo === req.user.id);
    }
    // Admins see all data (no filtering needed)

    // Enrich recent activity with user names
    const recentActivityWithNames = workLogs.slice(-5).reverse().map(log => {
        const user = users.find(u => u.id === log.memberId);
        return {
            ...log,
            memberName: user ? user.name : 'Unknown User'
        };
    });

    const analytics = {
        totalTeamMembers: allTeamMembers.length, // Use full team count for everyone
        availableMembers: allTeamMembers.filter(m => m.availability === 'available').length, // Use full team availability for everyone
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        totalHoursLogged: workLogs.reduce((sum, log) => sum + (log.hours || 0), 0),
        recentActivity: recentActivityWithNames,
        userPosition: req.user.position,
        userPermissions: {
            canManageTeam: canManageTeamMembers(req.user.position),
            canAssignTasks: canAssignTasks(req.user.position),
            canViewAllData: canViewAllData(req.user.position)
        }
    };

    logActivity('VIEW_ANALYTICS', req.user.id, null, { 
        dataScope: userPos === POSITIONS.ADMIN ? 'all' : 'personal'
    });

    res.json(analytics);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`QA Team Dashboard server running on http://localhost:${PORT}`);

// Run data synchronization on startup
setTimeout(() => {
    syncUserAndTeamMemberData();
}, 1000);
}); 