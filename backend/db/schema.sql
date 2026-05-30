-- 1. Bảng USERS
-- Lưu trữ thông tin người dùng trung tâm
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULLABLE: OAuth users don't have passwords
    avatar_url TEXT,

    -- OAuth fields
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50) DEFAULT 'local' NOT NULL CHECK (auth_provider IN ('local', 'google', 'github')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- System-level RBAC role (for Admin Portal access only, not team/project roles)
    system_role VARCHAR(20) DEFAULT 'user' NOT NULL CHECK (system_role IN ('user', 'admin'))
);

-- Indexes for OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_system_role ON users(system_role);
-- 2. Bảng TEAMS (Workspaces)
-- Đây là không gian làm việc chính 
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng TEAM_MEMBERS
-- Quản lý ai thuộc Team nào. Đây là điều kiện tiên quyết để được thêm vào Project.
CREATE TABLE team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id) -- Một người không thể tham gia 1 team 2 lần
);

-- 4. Bảng PROJECTS
-- Nhóm các công việc lại với nhau (VD: Dự án Web App, Chiến dịch Q1)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng PROJECT_MEMBERS 
-- Chỉ định rõ ai được quyền truy cập vào dự án nào.
-- Note: User phải có trong team_members trước thì mới được add vào đây.
CREATE TABLE project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('lead', 'editor', 'viewer')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- 6. Bảng TASKS
-- Bỏ cột assignee_id vì một task không còn thuộc về duy nhất 1 người nữa
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.5. Bảng TASK_ASSIGNEES (Quan hệ Nhiều - Nhiều)
-- Bảng này đóng vai trò như danh sách "Những người được chọn"
CREATE TABLE task_assignees (
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Khóa chính phức hợp: Đảm bảo 1 user chỉ được gán vào 1 task 1 lần (tránh trùng lặp)
    PRIMARY KEY (task_id, user_id)
);

-- 7. Bảng CHANNELS (Project-Specific Chat)
-- Hỗ trợ chat nhóm. Có thể chat chung (General) hoặc chat theo dự án.
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Nếu project_id có giá trị: Kênh chat này DÀNH RIÊNG cho Project đó.
    -- Nếu project_id là NULL: Kênh chat này là kênh chung của Team (VD: #general, #random).
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, 
    
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'voice')),
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Tên kênh phải duy nhất trong phạm vi 1 team (tránh trùng tên #general)
    UNIQUE(team_id, project_id, name) 
);

-- 8. Bảng MESSAGES
-- Nội dung tin nhắn trong các kênh
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT, -- Link ảnh/file nếu có
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Bảng TEAM_INVITATIONS
-- Lưu trữ các lời mời đang chờ xử lý
CREATE TABLE team_invitations (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    inviter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Ai là người mời
    email VARCHAR(255) NOT NULL, -- Email được mời
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    token VARCHAR(64) UNIQUE NOT NULL, -- Token bảo mật cho link invite
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Đảm bảo không spam invite cùng 1 email trong 1 team
    UNIQUE(team_id, email) 
);

-- Index để tìm kiếm token nhanh khi user click link
CREATE INDEX idx_invitations_token ON team_invitations(token);

-- 10. Bảng PROJECT_RISK_REPORTS (AI Analysis Cache - Ollama/Llama 3.1)
-- Lưu trữ kết quả phân tích rủi ro từ AI để tránh gọi API liên tục
CREATE TABLE project_risk_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Risk score: 0 (Safe) to 100 (Very Dangerous)
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Risk levels: 'Low', 'Medium', 'High', 'Critical'
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    
    -- AI-generated summary (human-readable overview)
    summary TEXT,
    
    -- Detailed risk factors from AI analysis (JSONB array)
    -- e.g., [{"factor": "3 overdue tasks", "severity": "high"}, ...]
    risk_factors JSONB DEFAULT '[]',
    
    -- AI-suggested actions (JSONB array)
    -- e.g., ["Reassign task #12 to reduce workload", "Extend deadline by 3 days"]
    suggested_actions JSONB DEFAULT '[]',
    
    -- Raw context sent to AI (for debugging/audit)
    analysis_context JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient retrieval: Get latest report for a project
CREATE INDEX idx_project_risk_reports_project_id ON project_risk_reports(project_id);
CREATE INDEX idx_project_risk_reports_created_at ON project_risk_reports(project_id, created_at DESC);

-- 11. Bảng NOTIFICATIONS (For n8n Integration & User Notification History)
-- Stores notifications sent to users (from n8n agents, system events, etc.)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Type for UI styling: 'info', 'warning', 'success', 'error', 'reminder'
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'reminder')),
    
    -- Source tracking: 'system', 'n8n', 'user', 'bot'
    source VARCHAR(20) DEFAULT 'system' CHECK (source IN ('system', 'n8n', 'user', 'bot')),
    
    -- Optional link to related resource (e.g., task, project)
    resource_type VARCHAR(50), -- 'task', 'project', 'team', 'channel', etc.
    resource_id INTEGER,
    
    -- Read status for notification center
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata for n8n workflow tracking
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient notification queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(user_id, created_at DESC);

-- 12. Bảng BOT_USERS (System Bot Accounts for n8n)
-- Virtual bot users for posting automated messages to channels
CREATE TABLE bot_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system bot
INSERT INTO bot_users (username, display_name, description) VALUES 
    ('system-bot', 'System Bot', 'Automated system notifications and updates'),
    ('reminder-bot', 'Reminder Bot', 'Deadline reminders and task notifications'),
    ('onboarding-bot', 'Onboarding Bot', 'Welcome messages for new team members'),
    ('health-bot', 'Health Monitor', 'Project health reports and analytics');

-- 13. Bảng MESSAGE_LINKS (Scraped Link Metadata)
-- Stores Open Graph metadata for URLs shared in messages
CREATE TABLE message_links (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,                    -- OG:title
    description TEXT,              -- OG:description  
    image_url TEXT,                -- OG:image
    domain TEXT,                   -- Extracted domain (e.g., "youtube.com")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookup by message_id
CREATE INDEX idx_message_links_message_id ON message_links(message_id);

-- Index for fetching links by channel (via JOIN with messages)
CREATE INDEX idx_message_links_created_at ON message_links(created_at DESC);

-- 14. Bảng ADMIN_AUDIT_LOGS (Audit Logs for Admin Actions)
-- Logs all admin actions for forensics and accountability
CREATE TABLE admin_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,            -- 'role_change', 'user_delete'
    target_user_id INTEGER,                 -- Who was affected
    old_value TEXT,                          -- Previous role
    new_value TEXT,                          -- New role
    ip_address INET,                        -- Request IP for forensics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);