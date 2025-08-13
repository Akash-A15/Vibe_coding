// Global variables
let teamMembers = [];
let workLogs = [];
let tasks = [];
let analytics = {};
let currentUser = null;
let authToken = null;

// DOM elements
const navTabs = document.querySelectorAll('.nav-tab');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Initialize application with authentication check
async function initializeApp() {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('qa_auth_token');
    if (savedToken) {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                authToken = savedToken;
                currentUser = data.user;
                showDashboard();
                await initializeDashboard();
                return;
            } else {
                localStorage.removeItem('qa_auth_token');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('qa_auth_token');
        }
    }
    
    // Show authentication if not logged in
    showAuthentication();
}

// Authentication functions
function showAuthentication() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('dashboard-container').style.display = 'none';
    setupAuthEventListeners();
}

function showDashboard() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'flex';
    
    // Update user welcome message
    if (currentUser) {
        document.getElementById('user-welcome').textContent = `Welcome, ${currentUser.name}`;
    }
    
    // Initialize theme
    initializeTheme();
}

function setupAuthEventListeners() {
    // Login form
    document.getElementById('login-form-element').addEventListener('submit', handleLogin);
    
    // Forgot password form
    document.getElementById('forgot-password-form-element').addEventListener('submit', handleForgotPassword);
    
    // Reset password form
    document.getElementById('reset-password-form-element').addEventListener('submit', handleResetPassword);
    
    // Change password form
    document.getElementById('change-password-form-element').addEventListener('submit', handleChangePassword);
}

// Show different auth forms
function showLogin() {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById('login-form').classList.add('active');
    clearAuthErrors();
}

function showChangePassword() {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById('change-password-form').classList.add('active');
    clearAuthErrors();
}

function showForgotPassword() {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById('forgot-password-form').classList.add('active');
    document.getElementById('reset-password-section').style.display = 'none';
    clearAuthErrors();
}

function clearAuthErrors() {
    document.querySelectorAll('.auth-error, .auth-success').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('login-error');
    
    setLoading(submitBtn, true);
    clearAuthErrors();
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            // Check if user needs to change password
            if (currentUser.needsPasswordReset) {
                localStorage.setItem('qa_temp_token', authToken);
                showChangePassword();
                showNotification('Please change your password to continue', 'info');
                return;
            }
            
            localStorage.setItem('qa_auth_token', authToken);
            showDashboard();
            await initializeDashboard();
            showNotification(data.message, 'success');
        } else {
            showAuthError(errorEl, data.error || 'Login failed');
            if (data.message) {
                showAuthError(errorEl, data.message);
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showAuthError(errorEl, 'Network error. Please try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

// Handle password change (first time login)
async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password-change').value;
    const confirmPassword = document.getElementById('confirm-new-password-change').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('change-password-error');
    
    clearAuthErrors();
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showAuthError(errorEl, 'New passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        showAuthError(errorEl, 'New password must be at least 6 characters long');
        return;
    }
    
    if (currentPassword === newPassword) {
        showAuthError(errorEl, 'New password must be different from current password');
        return;
    }
    
    setLoading(submitBtn, true);
    
    try {
        const tempToken = localStorage.getItem('qa_temp_token');
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tempToken}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.removeItem('qa_temp_token');
            localStorage.setItem('qa_auth_token', data.token);
            authToken = data.token;
            currentUser = data.user;
            
            showDashboard();
            await initializeDashboard();
            showNotification('Password updated successfully!', 'success');
        } else {
            showAuthError(errorEl, data.error || 'Password change failed');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showAuthError(errorEl, 'Network error. Please try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

// Handle forgot password
async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    
    setLoading(submitBtn, true);
    clearAuthErrors();
    
    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAuthSuccess(successEl, data.message);
            if (data.tempResetCode) {
                showAuthSuccess(successEl, `${data.message}\nDemo Reset Code: ${data.tempResetCode}`);
            }
            document.getElementById('reset-password-section').style.display = 'block';
        } else {
            showAuthError(errorEl, data.error || 'Failed to send reset code');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        showAuthError(errorEl, 'Network error. Please try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

// Handle reset password
async function handleResetPassword(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    const resetCode = document.getElementById('reset-code').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('reset-error');
    
    clearAuthErrors();
    
    if (newPassword !== confirmNewPassword) {
        showAuthError(errorEl, 'Passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        showAuthError(errorEl, 'Password must be at least 6 characters long');
        return;
    }
    
    setLoading(submitBtn, true);
    
    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetCode, newPassword })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            showLogin();
        } else {
            showAuthError(errorEl, data.error || 'Failed to reset password');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showAuthError(errorEl, 'Network error. Please try again.');
    } finally {
        setLoading(submitBtn, false);
    }
}

// Logout function
async function logout() {
    try {
        if (authToken) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('qa_auth_token');
        showAuthentication();
        showNotification('Logged out successfully', 'success');
    }
}

// Handle authentication errors
function handleAuthError() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('qa_auth_token');
    showAuthentication();
    showNotification('Session expired. Please login again.', 'error');
}

// Helper functions for auth UI
function setLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function showAuthError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function showAuthSuccess(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        await loadAllData();
        setupEventListeners();
        updateDashboard();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Load all data from API
async function loadAllData() {
    try {
        const authHeaders = { 'Authorization': `Bearer ${authToken}` };
        
        const [membersResponse, logsResponse, tasksResponse, analyticsResponse] = await Promise.all([
            fetch('/api/team-members', { headers: authHeaders }),
            fetch('/api/work-logs', { headers: authHeaders }),
            fetch('/api/tasks', { headers: authHeaders }),
            fetch('/api/analytics', { headers: authHeaders })
        ]);

        // Check for authentication errors
        if (membersResponse.status === 401 || logsResponse.status === 401 || 
            tasksResponse.status === 401 || analyticsResponse.status === 401) {
            handleAuthError();
            return;
        }

        teamMembers = await membersResponse.json();
        workLogs = await logsResponse.json();
        tasks = await tasksResponse.json();
        analytics = await analyticsResponse.json();
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('onclick').match(/'(.+?)'/)[1];
            showTab(tabName);
        });
    });

    // Form submissions
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
    document.getElementById('add-task-form').addEventListener('submit', handleAddTask);
    document.getElementById('add-worklog-form').addEventListener('submit', handleAddWorkLog);
    document.getElementById('update-status-form').addEventListener('submit', handleUpdateTaskStatus);
    document.getElementById('update-availability-form').addEventListener('submit', handleUpdateMemberAvailability);
    document.getElementById('edit-profile-form').addEventListener('submit', handleEditProfile);

    // Modal close handlers
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            console.log('Clicked outside modal, closing:', e.target.id);
            hideModal(e.target.id);
        }
    });
    
    // Mobile navigation close handler
    document.addEventListener('click', (e) => {
        const mobileNavMenu = document.getElementById('mobile-nav-menu');
        const toggleButton = document.getElementById('mobile-nav-toggle');
        
        // If mobile nav is open and click is outside nav and toggle button
        if (mobileNavMenu && mobileNavMenu.classList.contains('active')) {
            if (!mobileNavMenu.contains(e.target) && !toggleButton.contains(e.target)) {
                hideMobileNav();
            }
        }
    });
    
    // Add Escape key handler for modals and mobile nav
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            const mobileNavMenu = document.getElementById('mobile-nav-menu');
            
            if (activeModal) {
                console.log('Escape pressed, closing modal:', activeModal.id);
                hideModal(activeModal.id);
            } else if (mobileNavMenu && mobileNavMenu.classList.contains('active')) {
                hideMobileNav();
            }
        }
    });
}

// Tab navigation
function showTab(tabName) {
    // Update active tab
    navTabs.forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick*="${tabName}"]`).classList.add('active');

    // Show corresponding content
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Hide mobile nav after selection on mobile
    if (window.innerWidth <= 767) {
        hideMobileNav();
    }

    // Update content based on tab
    switch(tabName) {
        case 'overview':
            updateOverview();
            break;
        case 'team':
            displayTeamMembers();
            break;
        case 'tasks':
            displayTasks();
            break;
        case 'worklogs':
            displayWorkLogs();
            break;
        case 'reports':
            updateReports();
            break;
        case 'profile':
            // Always refresh profile data when switching to profile tab
            displayProfile();
            break;
    }
}

// Mobile navigation functions
function toggleMobileNav() {
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const toggleButton = document.getElementById('mobile-nav-toggle');
    const icon = toggleButton.querySelector('i');
    
    if (mobileNavMenu.classList.contains('active')) {
        hideMobileNav();
    } else {
        showMobileNav();
    }
}

function showMobileNav() {
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const toggleButton = document.getElementById('mobile-nav-toggle');
    const icon = toggleButton.querySelector('i');
    
    if (mobileNavMenu && mobileNavOverlay && icon) {
        mobileNavMenu.classList.add('active');
        mobileNavOverlay.classList.add('active');
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
        
        // Prevent body scrolling when menu is open
        document.body.style.overflow = 'hidden';
    }
}

function hideMobileNav() {
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
    const toggleButton = document.getElementById('mobile-nav-toggle');
    const icon = toggleButton.querySelector('i');
    
    if (mobileNavMenu && mobileNavOverlay && icon) {
        mobileNavMenu.classList.remove('active');
        mobileNavOverlay.classList.remove('active');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
        
        // Restore body scrolling
        document.body.style.overflow = '';
    }
}

// Mobile navigation tab function
function showTabMobile(tabName) {
    // Update mobile nav active state
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Hide mobile nav
    hideMobileNav();
    
    // Show the tab
    showTab(tabName);
}

// Handle window resize to reset mobile nav
window.addEventListener('resize', function() {
    if (window.innerWidth > 767) {
        // Hide mobile nav on larger screens
        hideMobileNav();
    }
});

// Initialize mobile nav state - removed redundant DOMContentLoaded listener

// Update dashboard overview
function updateDashboard() {
    updateOverview();
    populateDropdowns();
    updateUIBasedOnPermissions();
}

// Update overview stats and content
function updateOverview() {
    // Update stats
    document.getElementById('total-members').textContent = analytics.totalTeamMembers || 0;
    document.getElementById('available-members').textContent = analytics.availableMembers || 0;
    document.getElementById('total-tasks').textContent = analytics.totalTasks || 0;
    document.getElementById('completed-tasks').textContent = analytics.completedTasks || 0;

    // Update recent activity
    displayRecentActivity();
    
    // Update assigned tasks for employees
    displayMyAssignedTasks();
    
    // Update notification badge
    updateNotificationBadge();
}

// Update UI based on user permissions
function updateUIBasedOnPermissions() {
    if (!analytics.userPermissions) return;
    
    const permissions = analytics.userPermissions;
    const userPosition = analytics.userPosition;
    
    // Show/hide Add Member button based on permissions
    const addMemberBtn = document.querySelector('.section-header button[onclick*="showAddMemberForm"]');
    if (addMemberBtn) {
        addMemberBtn.style.display = permissions.canManageTeam ? 'block' : 'none';
    }
    
    // Show/hide Add Task button based on permissions
    const addTaskBtn = document.querySelector('.section-header button[onclick*="showAddTaskForm"]');
    if (addTaskBtn) {
        addTaskBtn.style.display = permissions.canAssignTasks ? 'block' : 'none';
    }
    
    // Update quick actions based on permissions
    updateQuickActions(permissions, userPosition);
    
    // Update section titles based on data scope
    updateSectionTitles(userPosition);
}

// Update quick actions based on permissions
function updateQuickActions(permissions, userPosition) {
    const quickActions = document.querySelector('.quick-actions');
    if (!quickActions) return;
    
    const actions = quickActions.querySelectorAll('.action-btn');
    actions.forEach(action => {
        const onclick = action.getAttribute('onclick');
        
        if (onclick && onclick.includes('showAddMemberForm')) {
            action.style.display = permissions.canManageTeam ? 'flex' : 'none';
        }
        
        if (onclick && onclick.includes('showAddTaskForm')) {
            action.style.display = permissions.canAssignTasks ? 'flex' : 'none';
        }
        
        // Work log button is always available (users can log their own hours)
        if (onclick && onclick.includes('showAddWorkLogForm')) {
            action.style.display = 'flex';
        }
    });
}

// Update section titles based on data scope
function updateSectionTitles(userPosition) {
    const overviewTitle = document.querySelector('#overview .section h2');
    if (overviewTitle && overviewTitle.textContent === 'Recent Activity') {
        switch(userPosition) {
            case 'Regular Employee':
                overviewTitle.textContent = 'My Recent Activity';
                break;
            case 'Team Lead':
                overviewTitle.textContent = 'Team Recent Activity';
                break;
            case 'QA Manager':
                overviewTitle.textContent = 'All Recent Activity';
                break;
        }
    }
}

// Permission checking functions for frontend
function canEditMember(memberId) {
    if (!currentUser) return false;
    
    // Users can always edit themselves (especially availability status)
    if (currentUser.id == memberId) return true;
    
    // If analytics data isn't loaded yet, still allow self-editing
    if (!analytics.userPermissions) {
        return currentUser.id == memberId;
    }
    
    // QA Managers can edit anyone
    if (analytics.userPermissions.canViewAllData) return true;
    
    // Team Leads can edit their team members (this would need team data to verify properly)
    if (currentUser.position === 'Team Lead') {
        // For now, allow team leads to edit others (server will validate properly)
        return true;
    }
    
    return false;
}

function canEditTask(task) {
    if (!currentUser || !analytics.userPermissions) return false;
    
    // QA Managers can edit all tasks
    if (analytics.userPermissions.canViewAllData) return true;
    
    // Users can edit tasks assigned to them
    if (task.assignedTo === currentUser.id) return true;
    
    // Task creators can edit their tasks
    if (task.createdBy === currentUser.id) return true;
    
    // Team leads can edit team tasks (simplified check)
    if (currentUser.position === 'Team Lead' && analytics.userPermissions.canAssignTasks) {
        return true;
    }
    
    return false;
}

// Display recent activity
function displayRecentActivity() {
    const activityContainer = document.getElementById('recent-activity');
    
    if (!analytics.recentActivity || analytics.recentActivity.length === 0) {
        activityContainer.innerHTML = '<p class="empty-state">No recent activity</p>';
        return;
    }

    const activityHtml = analytics.recentActivity.map(activity => {
        const memberName = activity.memberName || 'Unknown User';
        
        return `
            <div class="activity-item">
                <h4>${memberName} logged ${activity.hours} hours</h4>
                <p>${activity.activity} • ${activity.category} • ${formatDate(activity.date)}</p>
            </div>
        `;
    }).join('');

    activityContainer.innerHTML = activityHtml;
}

// Display assigned tasks for current user on overview page
function displayMyAssignedTasks() {
    const myTasksSection = document.getElementById('my-tasks-section');
    const myTasksContainer = document.getElementById('my-assigned-tasks');
    const taskCountBadge = document.getElementById('pending-tasks-count');
    
    // Only show for regular employees and team leads
    if (!currentUser || currentUser.position === 'QA Manager') {
        myTasksSection.style.display = 'none';
        return;
    }
    
    // Get tasks assigned to current user
    const myTasks = tasks.filter(task => task.assignedTo === currentUser.id);
    
    if (myTasks.length === 0) {
        myTasksSection.style.display = 'none';
        return;
    }
    
    // Show section
    myTasksSection.style.display = 'block';
    
    // Count pending tasks
    const pendingTasks = myTasks.filter(task => task.status === 'pending').length;
    taskCountBadge.textContent = pendingTasks;
    taskCountBadge.style.display = pendingTasks > 0 ? 'inline-flex' : 'none';
    
    // Get viewed tasks from localStorage
    const viewedTasks = getViewedTasks();
    
    // Sort tasks by date (newest first) and limit to 5 most recent
    const recentTasks = myTasks
        .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
        .slice(0, 5);
    
    const tasksHtml = recentTasks.map(task => {
        const isNew = !viewedTasks.includes(task.id);
        const daysAgo = Math.floor((new Date() - new Date(task.createdDate)) / (1000 * 60 * 60 * 24));
        const timeText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
        
        return `
            <div class="my-task-item ${task.priority} ${isNew ? 'new' : ''}" onclick="viewTaskDetails(${task.id})">
                <h4>
                    ${task.title}
                    ${isNew ? '<span class="task-new-indicator">!</span>' : ''}
                </h4>
                ${task.description ? `<p>${task.description}</p>` : ''}
                <div class="my-task-meta">
                    <span class="task-priority ${task.priority}">
                        <i class="fas fa-flag"></i> ${task.priority.toUpperCase()}
                    </span>
                    <span>Due: ${formatDate(task.dueDate)}</span>
                </div>
                <div class="my-task-meta" style="margin-top: 0.5rem;">
                    <span class="task-status ${task.status}">
                        ${task.status.replace('-', ' ').toUpperCase()}
                    </span>
                    <span style="font-size: 0.75rem; opacity: 0.8;">Assigned ${timeText}</span>
                </div>
            </div>
        `;
    }).join('');
    
    myTasksContainer.innerHTML = tasksHtml;
}

// Update notification badge on overview tab
function updateNotificationBadge() {
    const notificationBadge = document.getElementById('overview-notification-badge');
    
    if (!currentUser || currentUser.position === 'QA Manager') {
        notificationBadge.style.display = 'none';
        return;
    }
    
    // Get tasks assigned to current user
    const myTasks = tasks.filter(task => task.assignedTo === currentUser.id);
    const viewedTasks = getViewedTasks();
    
    // Count unviewed tasks
    const unviewedTasks = myTasks.filter(task => !viewedTasks.includes(task.id));
    
    if (unviewedTasks.length > 0) {
        notificationBadge.style.display = 'block';
    } else {
        notificationBadge.style.display = 'none';
    }
}

// Get viewed tasks from localStorage
function getViewedTasks() {
    const key = `viewed_tasks_${currentUser?.id}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
}

// Mark tasks as viewed
function markTasksAsViewed() {
    if (!currentUser) return;
    
    // Get all tasks assigned to current user
    const myTasks = tasks.filter(task => task.assignedTo === currentUser.id);
    
    // Get only the currently displayed tasks (5 most recent, matching displayMyAssignedTasks logic)
    const displayedTasks = myTasks
        .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
        .slice(0, 5);
    
    // Get existing viewed tasks
    const viewedTasks = getViewedTasks();
    
    // Add only the currently displayed tasks to viewed list
    const newViewedTasks = [...viewedTasks];
    displayedTasks.forEach(task => {
        if (!newViewedTasks.includes(task.id)) {
            newViewedTasks.push(task.id);
        }
    });
    
    // Save updated viewed tasks list
    const key = `viewed_tasks_${currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(newViewedTasks));
    
    // Update display
    displayMyAssignedTasks();
    updateNotificationBadge();
    
    showNotification(`${displayedTasks.length} tasks marked as viewed`, 'success');
}

// View task details (redirect to tasks tab)
function viewTaskDetails(taskId) {
    // Mark this specific task as viewed
    const viewedTasks = getViewedTasks();
    if (!viewedTasks.includes(taskId)) {
        viewedTasks.push(taskId);
        const key = `viewed_tasks_${currentUser.id}`;
        localStorage.setItem(key, JSON.stringify(viewedTasks));
    }
    
    // Update displays and go to tasks tab
    updateNotificationBadge();
    showTab('tasks');
}

// Display team members
function displayTeamMembers() {
    const teamGrid = document.getElementById('team-grid');
    
    if (teamMembers.length === 0) {
        teamGrid.innerHTML = '<p class="empty-state">No team members found</p>';
        return;
    }

    const membersHtml = teamMembers.map(member => {
        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
        const statusText = member.availability.replace('-', ' ').toUpperCase();
        
        return `
            <div class="member-card" onclick="handleMemberCardClick(${member.id}, event)" style="cursor: pointer;">
                <div class="member-header">
                    <div class="member-avatar">${initials}</div>
                    <div class="member-info">
                        <h3>${member.name}</h3>
                        <p>${member.role}</p>
                    </div>
                </div>
                <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 0.5rem;">${member.email}</p>
                <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 1rem;">Joined: ${formatDate(member.joinDate)}</p>
                <div class="member-status">
                    <span class="status-indicator ${member.availability}"></span>
                    <span style="font-size: 0.9rem; font-weight: 500;">${statusText}</span>
                    ${canEditMember(member.id) ? `
                        <button class="btn btn-secondary" style="margin-left: auto; padding: 0.5rem 1rem;" onclick="event.stopPropagation(); updateMemberAvailability(${member.id})">
                            Update Status
                        </button>
                    ` : ''}
                </div>
                <div style="position: absolute; top: 1rem; right: 1rem; color: #64748b; font-size: 0.8rem;">
                    <i class="fas fa-eye"></i>
                </div>
            </div>
        `;
    }).join('');

    teamGrid.innerHTML = membersHtml;
}

// Display tasks
function displayTasks() {
    const pendingContainer = document.getElementById('pending-tasks-container');
    const completedContainer = document.getElementById('completed-tasks-container');
    const pendingCountBadge = document.getElementById('pending-tasks-count');
    const completedCountBadge = document.getElementById('completed-tasks-count');
    
    // Separate tasks by status
    const pendingTasks = tasks.filter(task => task.status !== 'completed');
    const completedTasks = tasks.filter(task => task.status === 'completed');
    
    // Update count badges
    pendingCountBadge.textContent = pendingTasks.length;
    completedCountBadge.textContent = completedTasks.length;
    
    // Display pending tasks
    if (pendingTasks.length === 0) {
        pendingContainer.innerHTML = '<p class="empty-state">No pending tasks</p>';
    } else {
        const pendingHtml = pendingTasks.map(task => createTaskCard(task)).join('');
        pendingContainer.innerHTML = pendingHtml;
    }
    
    // Display completed tasks
    if (completedTasks.length === 0) {
        completedContainer.innerHTML = '<p class="empty-state">No completed tasks</p>';
    } else {
        const completedHtml = completedTasks.map(task => createTaskCard(task, true)).join('');
        completedContainer.innerHTML = completedHtml;
    }
}

// Create task card HTML
function createTaskCard(task, isCompleted = false) {
    const assignee = teamMembers.find(m => m.id === task.assignedTo);
    const assigneeName = assignee ? assignee.name : 'Unassigned';
    
    return `
        <div class="task-card ${task.priority} ${isCompleted ? 'completed' : ''}">
            <div class="task-header">
                <div class="task-title">${task.title}</div>
                <span class="task-priority ${task.priority}">${task.priority}</span>
            </div>
            ${task.description ? `<p class="text-secondary" style="margin-bottom: 1rem;">${task.description}</p>` : ''}
            <div class="task-meta">
                <span class="task-assignee">Assigned to: ${assigneeName}</span>
                <span class="task-status ${task.status}">${task.status.replace('-', ' ')}</span>
            </div>
            <div class="text-secondary" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; font-size: 0.9rem;">
                <span>Due: ${formatDate(task.dueDate)}</span>
                ${canEditTask(task) && !isCompleted ? `
                    <button class="btn btn-secondary" style="padding: 0.5rem 1rem;" onclick="showUpdateTaskStatusModal(${task.id})">
                        Update Status
                    </button>
                ` : ''}
                ${isCompleted ? `
                    <span style="color: #22c55e; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> Completed
                    </span>
                ` : ''}
            </div>
        </div>
    `;
}

// Display work logs
function displayWorkLogs() {
    const workLogsContainer = document.getElementById('work-logs-container');
    
    if (workLogs.length === 0) {
        workLogsContainer.innerHTML = '<p class="empty-state">No work logs found</p>';
        return;
    }

    const logsHtml = workLogs.map(log => {
        const memberName = log.memberName || 'Unknown User';
        
        return `
            <div class="worklog-item">
                <div class="worklog-info">
                    <h4>${memberName}</h4>
                    <p>${log.activity} • ${log.category} • ${formatDate(log.date)}</p>
                </div>
                <div class="worklog-hours">${log.hours}h</div>
            </div>
        `;
    }).join('');

    workLogsContainer.innerHTML = logsHtml;
}

// Update reports
function updateReports() {
    // Update team performance metrics
    document.getElementById('total-hours').textContent = analytics.totalHoursLogged || 0;
    
    const avgHours = analytics.totalTeamMembers > 0 ? 
        (analytics.totalHoursLogged / analytics.totalTeamMembers).toFixed(1) : 0;
    document.getElementById('avg-hours').textContent = avgHours;

    // Update task status breakdown
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;

    document.getElementById('pending-count').textContent = pendingTasks;
    document.getElementById('progress-count').textContent = inProgressTasks;
    document.getElementById('completed-count').textContent = completedTasks;
}

// Populate dropdown menus
function populateDropdowns() {
    // Populate task assignee dropdown (only for users who can assign tasks)
    const taskAssigneeSelect = document.getElementById('task-assignee');
    if (taskAssigneeSelect) {
        taskAssigneeSelect.innerHTML = '<option value="">Assign to...</option>';
        
        if (teamMembers && teamMembers.length > 0) {
            teamMembers.forEach(member => {
                taskAssigneeSelect.innerHTML += `<option value="${member.id}">${member.name}</option>`;
            });
        } else {
            console.warn('No team members available for task assignment');
            taskAssigneeSelect.innerHTML += '<option value="" disabled>No team members available</option>';
        }
    }

    // Populate worklog member dropdown based on permissions
    const worklogMemberSelect = document.getElementById('worklog-member');
    if (worklogMemberSelect) {
        worklogMemberSelect.innerHTML = '<option value="">Select Team Member</option>';
        
        if (analytics.userPermissions && analytics.userPermissions.canViewAllData) {
            // QA Managers can log hours for anyone
            teamMembers.forEach(member => {
                worklogMemberSelect.innerHTML += `<option value="${member.id}">${member.name}</option>`;
            });
        } else {
            // Regular employees and team leads can only log hours for themselves
            worklogMemberSelect.innerHTML += `<option value="${currentUser.id}">${currentUser.name} (You)</option>`;
            // Pre-select the current user
            worklogMemberSelect.value = currentUser.id;
            // Disable the dropdown since they can only select themselves
            if (currentUser.position === 'Regular Employee') {
                worklogMemberSelect.disabled = true;
            }
        }
    }
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
    
    // Set today's date for join date field when opening add member modal
    if (modalId === 'add-member-modal') {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('member-join-date').value = today;
    }
}

function hideModal(modalId) {
    console.log('Hiding modal:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        
        // Restore body scrolling
        document.body.style.overflow = '';
        
        console.log('Modal hidden:', modalId);
    }
    // Reset forms
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
}

// Handle member card click
function handleMemberCardClick(memberId, event) {
    console.log('=== MEMBER CARD CLICKED ===');
    console.log('Member ID:', memberId);
    console.log('Event target:', event.target);
    
    // Don't open modal if clicking on buttons
    if (event.target.classList.contains('btn') || event.target.closest('.btn')) {
        console.log('Clicked on button, not opening modal');
        return;
    }
    
    console.log('Opening member details for ID:', memberId);
    showMemberDetails(memberId);
}

// Show member details modal
function showMemberDetails(memberId) {
    console.log('=== showMemberDetails called ===');
    console.log('Member ID:', memberId);
    console.log('teamMembers array:', teamMembers);
    
    const member = teamMembers.find(m => m.id == memberId);
    console.log('Found member:', member);
    
    if (!member) {
        console.error('Member not found for ID:', memberId);
        console.error('Available member IDs:', teamMembers.map(m => m.id));
        showNotification('Member details not found', 'error');
        return;
    }
    
    console.log('Populating modal with member data...');
    
    // Populate member details
    const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('details-member-avatar').textContent = initials;
    document.getElementById('details-member-name').textContent = member.name || 'N/A';
    document.getElementById('details-member-role').textContent = member.role || 'N/A';
    
    // Update status badge
    const statusBadge = document.getElementById('details-member-status');
    statusBadge.innerHTML = `<span class="member-status ${member.availability || 'available'}">${(member.availability || 'available').replace('-', ' ')}</span>`;
    
    // Personal Information
    document.getElementById('details-employee-id').textContent = member.employeeId || 'N/A';
    document.getElementById('details-email').textContent = member.email || 'N/A';
    document.getElementById('details-phone').textContent = member.phone || 'N/A';
    document.getElementById('details-emergency-contact').textContent = member.emergencyContact || 'N/A';
    
    // Professional Information
    document.getElementById('details-department').textContent = member.department || 'Quality Assurance';
    document.getElementById('details-join-date').textContent = member.joinDate || 'N/A';
    document.getElementById('details-employment-type').textContent = member.employmentType || 'N/A';
    document.getElementById('details-experience').textContent = member.experience ? `${member.experience} years` : 'N/A';
    
    // Address Information
    document.getElementById('details-address').textContent = member.address || 'N/A';
    document.getElementById('details-city').textContent = member.city || 'N/A';
    document.getElementById('details-state').textContent = member.state || 'N/A';
    document.getElementById('details-zipcode').textContent = member.zipcode || 'N/A';
    
    // Skills & Education
    document.getElementById('details-skills').textContent = member.skills || 'N/A';
    document.getElementById('details-education').textContent = member.education || 'N/A';
    document.getElementById('details-certifications').textContent = member.certifications || 'N/A';
    
    console.log('Data populated, now opening modal...');
    
    // Show the modal
    const modal = document.getElementById('member-details-modal');
    if (modal) {
        console.log('Modal found, showing modal...');
        
        // Hide any other active modals first
        document.querySelectorAll('.modal.active').forEach(m => {
            if (m.id !== 'member-details-modal') {
                m.classList.remove('active');
            }
        });
        
        // Clear any existing inline styles that might interfere
        modal.removeAttribute('style');
        
        // Move modal to end of body to ensure it's on top
        document.body.appendChild(modal);
        
        // Add the active class to show the modal
        modal.classList.add('active');
        
        // Prevent background scrolling
        document.body.style.overflow = 'hidden';
        
        // Force immediate display with high z-index
        modal.style.display = 'flex';
        modal.style.zIndex = '999999';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        
        console.log('Modal should be visible now!');
        console.log('Modal classes:', modal.className);
        showNotification('Member details modal opened', 'success');
    } else {
        console.error('Modal element not found!');
        showNotification('Error: Could not open member details', 'error');
    }
}

// Show forms
function showAddMemberForm() {
    showModal('add-member-modal');
}

function showAddTaskForm() {
    populateDropdowns();
    showModal('add-task-modal');
}

function showAddWorkLogForm() {
    populateDropdowns();
    showModal('add-worklog-modal');
}

// Handle employee registration (admin only)
async function handleAddMember(e) {
    e.preventDefault();
    
    // Collect all form data
    const formData = {
        // Basic Information
        name: document.getElementById('member-name').value.trim(),
        email: document.getElementById('member-email').value.trim().toLowerCase(),
        role: document.getElementById('member-role').value,
        position: document.getElementById('member-position').value,
        password: document.getElementById('member-password').value,
        availability: document.getElementById('member-availability').value,
        
        // Contact Information
        phone: document.getElementById('member-phone').value.trim(),
        emergencyContact: document.getElementById('member-emergency-contact').value.trim(),
        address: document.getElementById('member-address').value.trim(),
        city: document.getElementById('member-city').value.trim(),
        state: document.getElementById('member-state').value.trim(),
        zipcode: document.getElementById('member-zipcode').value.trim(),
        
        // Professional Details
        employeeId: document.getElementById('member-employee-id').value.trim(),
        joinDate: document.getElementById('member-join-date').value,
        department: document.getElementById('member-department').value.trim(),
        employmentType: document.getElementById('member-employment-type').value,
        
        // Skills & Education
        skills: document.getElementById('member-skills').value.trim(),
        education: document.getElementById('member-education').value.trim(),
        experience: document.getElementById('member-experience').value || 0,
        certifications: document.getElementById('member-certifications').value.trim()
    };
    
    // Validate required fields (address and education fields are now optional)
    const requiredFields = ['name', 'email', 'role', 'position', 'password', 'phone', 'emergencyContact', 'employeeId', 'joinDate', 'department', 'employmentType'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
        showNotification(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    if (formData.password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    // Validate phone number format (basic validation)
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(formData.phone)) {
        showNotification('Please enter a valid phone number', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/register-employee', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            const result = await response.json();
            await refreshData();
            hideModal('add-member-modal');
            document.getElementById('add-member-form').reset(); // Clear form
            showNotification(`Employee registered successfully! Login credentials: ${formData.email} / temporary password provided`, 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || 'Failed to register employee';
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error registering employee:', error);
        showNotification('Error registering employee', 'error');
    }
}

async function handleAddTask(e) {
    e.preventDefault();
    
    // Validate form data
    const title = document.getElementById('task-title').value.trim();
    const assigneeId = document.getElementById('task-assignee').value;
    const priority = document.getElementById('task-priority').value;
    const dueDate = document.getElementById('task-due-date').value;
    const description = document.getElementById('task-description').value.trim();
    
    // Client-side validation
    if (!title) {
        showNotification('Please enter a task title', 'error');
        return;
    }
    
    if (!assigneeId) {
        showNotification('Please select a team member to assign the task to', 'error');
        return;
    }
    
    if (!priority) {
        showNotification('Please select task priority', 'error');
        return;
    }
    
    if (!dueDate) {
        showNotification('Please select a due date', 'error');
        return;
    }
    
    // Validate due date is not in the past
    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showNotification('Due date cannot be in the past', 'error');
        return;
    }

    const formData = {
        title: title,
        assignedTo: parseInt(assigneeId),
        priority: priority,
        dueDate: dueDate,
        description: description,
        status: 'pending'
    };

    console.log('Submitting task data:', formData); // Debug log

    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            const result = await response.json();
            console.log('Task created successfully:', result); // Debug log
            await refreshData();
            hideModal('add-task-modal');
            showNotification('Task added successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || errorData.message || `Server error: ${response.status}`;
            console.error('Server error:', errorData); // Debug log
            showNotification(`Error adding task: ${errorMessage}`, 'error');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification(`Error adding task: ${error.message}`, 'error');
    }
}

async function handleAddWorkLog(e) {
    e.preventDefault();
    
    const formData = {
        memberId: parseInt(document.getElementById('worklog-member').value),
        hours: parseFloat(document.getElementById('worklog-hours').value),
        activity: document.getElementById('worklog-activity').value,
        category: document.getElementById('worklog-category').value
    };

    try {
        const response = await fetch('/api/work-logs', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            await refreshData();
            hideModal('add-worklog-modal');
            showNotification('Work hours logged successfully!', 'success');
        } else {
            throw new Error('Failed to log work hours');
        }
    } catch (error) {
        console.error('Error logging work hours:', error);
        showNotification('Error logging work hours', 'error');
    }
}

// Update functions
function updateMemberAvailability(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) {
        showNotification('Member not found', 'error');
        return;
    }

    // Remove any existing standalone modal
    const existingModal = document.getElementById('availability-modal-standalone');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal element
    const modalDiv = document.createElement('div');
    modalDiv.id = 'availability-modal-standalone';
    modalDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
    `;
    
    // Get current theme colors
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const colors = {
        bg: isDark ? '#1a1a1a' : '#ffffff',
        cardBg: isDark ? '#2d2d2d' : '#f8f9fa',
        text: isDark ? '#ffffff' : '#333333',
        textSecondary: isDark ? '#b0b0b0' : '#666666',
        border: isDark ? '#404040' : '#d1d5db',
        inputBg: isDark ? '#3a3a3a' : '#ffffff',
        primary: isDark ? '#ff4757' : '#3b82f6',
        primaryHover: isDark ? '#ff3742' : '#2563eb',
        secondary: isDark ? '#5a5a5a' : '#6b7280',
        secondaryHover: isDark ? '#6a6a6a' : '#4b5563'
    };

    modalDiv.innerHTML = `
        <div style="
            background: ${colors.bg};
            padding: 2.5rem;
            border-radius: 16px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
            max-width: 500px;
            width: 90%;
            border: 1px solid ${colors.border};
            position: relative;
        ">
            <button id="standalone-close-btn" style="
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: ${colors.textSecondary};
                cursor: pointer;
                padding: 0.5rem;
                border-radius: 8px;
                transition: all 0.2s ease;
            " onmouseover="this.style.background='${colors.cardBg}'; this.style.color='${colors.text}'" onmouseout="this.style.background='none'; this.style.color='${colors.textSecondary}'">×</button>
            
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="
                    width: 3rem; 
                    height: 3rem; 
                    background: linear-gradient(135deg, ${colors.primary} 0%, ${isDark ? '#ffa502' : '#8b5cf6'} 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                ">🔄</div>
                <h3 style="margin: 0; color: ${colors.text}; font-size: 1.5rem; font-weight: 700;">Update Availability</h3>
            </div>
            
            <div style="
                margin-bottom: 2rem; 
                padding: 1.25rem; 
                background: ${colors.cardBg}; 
                border-radius: 12px; 
                border-left: 4px solid ${colors.primary};
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: ${colors.text}; font-size: 1.1rem;">${member.name}</p>
                <p style="margin: 0; font-size: 0.9rem; color: ${colors.textSecondary};">Current Status: <span style="font-weight: 500; color: ${colors.text};">${member.availability.replace('-', ' ')}</span></p>
            </div>
            
            <label style="
                display: block; 
                margin-bottom: 0.75rem; 
                font-weight: 600; 
                color: ${colors.text};
                font-size: 1rem;
            ">New Availability Status:</label>
            
            <select id="standalone-availability-select" style="
                width: 100%;
                padding: 1rem;
                border: 2px solid ${colors.border};
                border-radius: 12px;
                font-size: 1rem;
                margin-bottom: 2rem;
                background: ${colors.inputBg};
                color: ${colors.text};
                cursor: pointer;
                transition: all 0.2s ease;
                appearance: none;
                background-image: url('data:image/svg+xml;utf8,<svg fill=\"${encodeURIComponent(colors.text)}\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>');
                background-repeat: no-repeat;
                background-position: right 1rem center;
                background-size: 1.25rem;
                padding-right: 3rem;
            " onfocus="this.style.borderColor='${colors.primary}'; this.style.boxShadow='0 0 0 3px ${colors.primary}20'" onblur="this.style.borderColor='${colors.border}'; this.style.boxShadow='none'">
                <option value="">Select availability status...</option>
                <option value="available">🟢 Available</option>
                <option value="busy">🟡 Busy</option>
                <option value="on-leave">🔴 On Leave</option>
            </select>
            
            <div style="display: flex; gap: 1rem;">
                <button id="standalone-update-btn" style="
                    flex: 1;
                    padding: 1rem 1.5rem;
                    background: ${colors.primary};
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px ${colors.primary}30;
                " onmouseover="this.style.background='${colors.primaryHover}'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px ${colors.primary}40'" onmouseout="this.style.background='${colors.primary}'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px ${colors.primary}30'">
                    <span style="margin-right: 0.5rem;">💾</span>Update Availability
                </button>
                <button id="standalone-cancel-btn" style="
                    flex: 1;
                    padding: 1rem 1.5rem;
                    background: ${colors.secondary};
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='${colors.secondaryHover}'" onmouseout="this.style.background='${colors.secondary}'">Cancel</button>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.appendChild(modalDiv);
    
    // Add event listeners
    const closeModal = () => {
        document.getElementById('availability-modal-standalone').remove();
        document.body.style.overflow = '';
    };
    
    document.getElementById('standalone-cancel-btn').onclick = closeModal;
    document.getElementById('standalone-close-btn').onclick = closeModal;
    
    document.getElementById('standalone-update-btn').onclick = async () => {
        const newStatus = document.getElementById('standalone-availability-select').value;
        if (!newStatus) {
            alert('Please select an availability status');
            return;
        }
        
        try {
            const response = await fetch('/api/team-members/' + memberId, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({ availability: newStatus })
            });

            if (response.status === 401) {
                handleAuthError();
                return;
            }

            if (response.ok) {
                document.getElementById('availability-modal-standalone').remove();
                document.body.style.overflow = '';
                await refreshData();
                showNotification('Member availability updated successfully!', 'success');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to update member availability');
            }
        } catch (error) {
            console.error('Error updating member:', error);
            alert('Error updating member availability: ' + error.message);
        }
    };
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
    
    // Close on outside click
    modalDiv.onclick = (e) => {
        if (e.target.id === 'availability-modal-standalone') {
            document.getElementById('availability-modal-standalone').remove();
            document.body.style.overflow = '';
        }
    };
}

// Handle member availability update from modal
async function handleUpdateMemberAvailability(e) {
    e.preventDefault();
    
    const memberId = parseInt(e.target.dataset.memberId);
    const newStatus = document.getElementById('new-member-availability').value;
    
    if (!newStatus) {
        showNotification('Please select an availability status', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/team-members/${memberId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ availability: newStatus })
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            // Hide modal completely
            const modal = document.getElementById('update-availability-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.className = 'modal';
                modal.removeAttribute('style');
                document.body.style.overflow = '';
            }
            
            await refreshData();
            showNotification('Member availability updated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update member availability');
        }
    } catch (error) {
        console.error('Error updating member:', error);
        showNotification(error.message || 'Error updating member availability', 'error');
    }
}

// Show update task status modal
function showUpdateTaskStatusModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('status-task-title').textContent = task.title;
    document.getElementById('current-task-status').textContent = task.status.replace('-', ' ');
    document.getElementById('new-task-status').value = '';
    
    showModal('update-status-modal');
    
    // Store task ID for form submission
    document.getElementById('update-status-form').dataset.taskId = taskId;
}

// Handle task status update
async function handleUpdateTaskStatus(e) {
    e.preventDefault();
    
    const taskId = parseInt(e.target.dataset.taskId);
    const newStatus = document.getElementById('new-task-status').value;
    
    if (!newStatus) {
        showNotification('Please select a status', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            hideModal('update-status-modal');
            await refreshData();
            showNotification('Task status updated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update task');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification(error.message || 'Error updating task status', 'error');
    }
}

// Refresh data (internal function for auto-refresh after operations)
async function refreshData() {
    try {
        await loadAllData();
        updateDashboard();
        
        // Update current tab content
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) {
            const tabName = activeTab.getAttribute('onclick').match(/'(.+?)'/)[1];
            showTab(tabName);
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        showNotification('Error refreshing data', 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        ${type === 'success' ? 'background: #10b981;' : 
          type === 'info' ? 'background: #ff4757;' : 
          'background: #ef4444;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Profile functions
function displayProfile() {
    if (!currentUser) return;
    
    // Find current user in team members array (get most up-to-date data)
    const userProfile = teamMembers.find(m => m.id === currentUser.id);
    if (!userProfile) {
        console.warn('User profile not found in team members, using currentUser data');
        const fallbackProfile = currentUser;
        displayProfileData(fallbackProfile);
        return;
    }
    
    displayProfileData(userProfile);
}

function displayProfileData(userProfile) {
    // Update profile display
    const initials = userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('profile-name').textContent = userProfile.name || 'N/A';
    document.getElementById('profile-role').textContent = userProfile.role || 'N/A';
    
    // Update status
    const statusElement = document.getElementById('profile-status');
    statusElement.innerHTML = `<span class="member-status ${userProfile.availability || 'available'}">${(userProfile.availability || 'available').replace('-', ' ')}</span>`;
    
    // Personal Information
    document.getElementById('profile-email').textContent = userProfile.email || 'N/A';
    document.getElementById('profile-phone').textContent = userProfile.phone || 'Not provided';
    document.getElementById('profile-emergency-contact').textContent = userProfile.emergencyContact || 'Not provided';
    
    // Address Information
    document.getElementById('profile-address').textContent = userProfile.address || 'Not provided';
    document.getElementById('profile-city').textContent = userProfile.city || 'Not provided';
    document.getElementById('profile-state').textContent = userProfile.state || 'Not provided';
    document.getElementById('profile-zipcode').textContent = userProfile.zipcode || 'Not provided';
    
    // Education & Skills
    document.getElementById('profile-education').textContent = userProfile.education || 'Not provided';
    document.getElementById('profile-certifications').textContent = userProfile.certifications || 'Not provided';
    document.getElementById('profile-skills').textContent = userProfile.skills || 'Not provided';
    
    // Professional Information (Read-only)
    document.getElementById('profile-employee-id').textContent = userProfile.employeeId || 'N/A';
    document.getElementById('profile-join-date').textContent = userProfile.joinDate || 'N/A';
    document.getElementById('profile-department').textContent = userProfile.department || 'Quality Assurance';
    document.getElementById('profile-employment-type').textContent = userProfile.employmentType || 'N/A';
    document.getElementById('profile-experience').textContent = userProfile.experience ? `${userProfile.experience} years` : 'N/A';
}

function showEditProfileModal() {
    if (!currentUser) return;
    
    // Get the most up-to-date profile data
    const userProfile = teamMembers.find(m => m.id === currentUser.id) || currentUser;
    
    // Populate edit form with current values
    document.getElementById('edit-phone').value = userProfile.phone || '';
    document.getElementById('edit-emergency-contact').value = userProfile.emergencyContact || '';
    document.getElementById('edit-address').value = userProfile.address || '';
    document.getElementById('edit-city').value = userProfile.city || '';
    document.getElementById('edit-state').value = userProfile.state || '';
    document.getElementById('edit-zipcode').value = userProfile.zipcode || '';
    document.getElementById('edit-education').value = userProfile.education || '';
    document.getElementById('edit-experience').value = userProfile.experience || 0;
    document.getElementById('edit-certifications').value = userProfile.certifications || '';
    document.getElementById('edit-skills').value = userProfile.skills || '';
    
    showModal('edit-profile-modal');
}

async function handleEditProfile(e) {
    e.preventDefault();
    
    const formData = {
        phone: document.getElementById('edit-phone').value.trim(),
        emergencyContact: document.getElementById('edit-emergency-contact').value.trim(),
        address: document.getElementById('edit-address').value.trim(),
        city: document.getElementById('edit-city').value.trim(),
        state: document.getElementById('edit-state').value.trim(),
        zipcode: document.getElementById('edit-zipcode').value.trim(),
        education: document.getElementById('edit-education').value.trim(),
        experience: parseInt(document.getElementById('edit-experience').value) || 0,
        certifications: document.getElementById('edit-certifications').value.trim(),
        skills: document.getElementById('edit-skills').value.trim()
    };
    
    // Validate required phone and emergency contact
    if (!formData.phone) {
        showNotification('Phone number is required', 'error');
        return;
    }
    
    if (!formData.emergencyContact) {
        showNotification('Emergency contact is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/team-members/${currentUser.id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            handleAuthError();
            return;
        }

        if (response.ok) {
            // First update the local data immediately
            const memberIndex = teamMembers.findIndex(m => m.id === currentUser.id);
            if (memberIndex !== -1) {
                // Update team members array with form data
                teamMembers[memberIndex] = { 
                    ...teamMembers[memberIndex], 
                    ...formData
                };
                
                // Also update the currentUser object
                currentUser = { ...currentUser, ...formData };
            }
            
            hideModal('edit-profile-modal');
            
            // Force immediate profile display update with new data
            displayProfile();
            
            // Update team members display if currently viewing that tab
            const activeTab = document.querySelector('.nav-tab.active');
            if (activeTab && activeTab.getAttribute('onclick').includes('team')) {
                displayTeamMembers();
            }
            
            // Refresh data in background to sync with server
            refreshData().then(() => {
                // Refresh profile again after server sync
                if (document.getElementById('profile').classList.contains('active')) {
                    displayProfile();
                }
            });
            
            showNotification('Profile updated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification(error.message || 'Error updating profile', 'error');
    }
}

// Add CSS for notifications and profile styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    /* Modal close button styles */
    .modal-close-btn {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #64748b;
        cursor: pointer;
        z-index: 10;
        padding: 0.5rem;
        border-radius: 50%;
        transition: all 0.2s ease;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .modal-close-btn:hover {
        background: var(--bg-card);
        color: #374151;
        transform: scale(1.1);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-right: 3rem;
    }
    
    /* Profile styles */
    .profile-sections {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }
    
    .profile-card {
        background: var(--bg-card);
        padding: 2rem;
        border-radius: 16px;
        box-shadow: var(--shadow);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .profile-header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }
    
    .profile-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff4757 0%, #ffa502 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 2rem;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .profile-basic-info h2 {
        margin: 0;
        color: var(--text-primary);
        font-size: 1.8rem;
    }
    
    .profile-basic-info p {
        margin: 0.5rem 0;
        color: var(--text-secondary);
        font-size: 1.1rem;
    }
    
    .profile-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
    }
    
    .profile-section {
        background: var(--bg-card);
        padding: 2rem;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .profile-section.readonly {
        background: var(--bg-secondary);
        border-left: 4px solid #94a3b8;
    }
    
    .profile-section h3 {
        margin: 0 0 1.5rem 0;
        color: var(--text-primary);
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .readonly-notice {
        background: var(--warning);
        color: #ffffff;
        padding: 0.75rem;
        border-radius: 8px;
        font-size: 0.9rem;
        margin-bottom: 1rem;
        border: 1px solid #ffeaa7;
    }
    
    .profile-details {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .profile-detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .profile-detail-item label {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .profile-detail-item span {
        color: var(--text-secondary);
        font-size: 1rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--border-color);
    }
`;
document.head.appendChild(style);

// Theme Management
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Update button icon
    const themeButton = document.querySelector('.theme-toggle-btn i');
    if (newTheme === 'dark') {
        themeButton.className = 'fas fa-sun';
    } else {
        themeButton.className = 'fas fa-moon';
    }
    
    // Save preference to localStorage
    localStorage.setItem('theme', newTheme);
}

function initializeTheme() {
    // Get saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Update button icon based on current theme
    const themeButton = document.querySelector('.theme-toggle-btn i');
    if (themeButton) {
        if (savedTheme === 'dark') {
            themeButton.className = 'fas fa-sun';
        } else {
            themeButton.className = 'fas fa-moon';
        }
    }
} 