// Supabase认证检查模块
console.log('🔒 加载认证检查模块...');

// 检查用户认证状态
function checkAuth() {
    const userAuth = localStorage.getItem('userAuth');
    
    if (!userAuth) {
        console.log('用户未登录，跳转到登录页');
        redirectToLogin();
        return null;
    }
    
    try {
        const user = JSON.parse(userAuth);
        const loginTime = user.loginTime;
        const currentTime = new Date().getTime();
        
        // 检查登录是否过期（24小时）
        const expirationTime = 24 * 60 * 60 * 1000; // 24小时
        if (currentTime - loginTime > expirationTime) {
            console.log('登录已过期，重新登录');
            localStorage.removeItem('userAuth');
            redirectToLogin();
            return null;
        }
        
        // 验证必要字段
        if (!user.uid || !user.email || !user.name || !user.role || !user.permissions) {
            console.log('用户信息不完整，重新登录');
            localStorage.removeItem('userAuth');
            redirectToLogin();
            return null;
        }
        
        console.log('用户已登录:', user.name, '角色:', user.role, '权限:', user.permissions);
        return user;
        
    } catch (error) {
        console.error('用户信息解析失败:', error);
        localStorage.removeItem('userAuth');
        redirectToLogin();
        return null;
    }
}

// 跳转到登录页
function redirectToLogin() {
    // 避免在登录页面循环跳转
    if (!window.location.pathname.includes('supabase-login.html')) {
        window.location.href = 'supabase-login.html';
    }
}

// 获取当前用户信息
function getCurrentUser() {
    return checkAuth();
}

// 检查用户权限
function hasPermission(permission) {
    const user = getCurrentUser();
    if (!user || !user.permissions) {
        return false;
    }
    return user.permissions.includes(permission);
}

// 用户退出登录
function logout() {
    console.log('执行退出登录');
    
    if (window.logoutUser && typeof window.logoutUser === 'function') {
        // 使用Supabase的退出函数
        window.logoutUser();
    } else {
        // 后备方案
        localStorage.removeItem('userAuth');
        window.location.href = 'supabase-login.html';
    }
}

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    // 避免在登录页面进行认证检查
    if (window.location.pathname.includes('supabase-login.html')) {
        console.log('当前在登录页面，跳过认证检查');
        return;
    }
    
    const user = checkAuth();
    if (user) {
        initializeUserInterface(user);
    }
});

// 初始化用户界面
function initializeUserInterface(user) {
    console.log('初始化用户界面，用户:', user.name, '角色:', user.role);
    
    // 显示用户信息
    showUserInfo(user);
    
    // 根据权限显示功能
    if (hasPermission('edit')) {
        showEditFeatures();
    }
    
    if (hasPermission('admin')) {
        showAdminFeatures();
    }
    
    // 更新页面标题（如果需要）
    updatePageTitle(user);
}

// 显示用户信息在导航栏
function showUserInfo(user) {
    const navbar = document.querySelector('.nav-container');
    if (!navbar) {
        console.log('未找到导航栏容器');
        return;
    }
    
    // 移除已存在的用户信息
    const existingUserInfo = navbar.querySelector('.user-info');
    if (existingUserInfo) {
        existingUserInfo.remove();
    }
    
    // 创建用户信息元素
    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';
    userInfo.innerHTML = `
        <div class="user-details">
            <span class="user-name">👋 ${escapeHtml(user.name)}</span>
            <span class="user-role">${getRoleDisplayName(user.role)}</span>
        </div>
        <button onclick="logout()" class="logout-btn" title="退出登录">
            🚪 退出
        </button>
    `;
    
    // 添加到导航栏
    navbar.appendChild(userInfo);
    
    console.log('用户信息已显示在导航栏');
}

// 显示编辑功能
function showEditFeatures() {
    const articlesLink = document.getElementById('articlesLink');
    if (articlesLink) {
        articlesLink.style.display = 'inline-block';
        console.log('编辑功能已启用');
    }
    
    // 显示其他编辑相关功能
    const editButtons = document.querySelectorAll('.edit-feature');
    editButtons.forEach(button => {
        button.style.display = 'inline-block';
    });
}

// 显示管理功能
function showAdminFeatures() {
    console.log('管理员功能已启用');
    
    // 显示管理员特有功能
    const adminButtons = document.querySelectorAll('.admin-feature');
    adminButtons.forEach(button => {
        button.style.display = 'inline-block';
    });
}

// 更新页面标题
function updatePageTitle(user) {
    const title = document.title;
    if (!title.includes(user.name)) {
        document.title = `${title} - ${user.name}`;
    }
}

// 获取角色显示名称
function getRoleDisplayName(role) {
    const roleNames = {
        'visitor': '👁️ 访客',
        'editor': '📝 编辑者',
        'admin': '👑 管理员'
    };
    return roleNames[role] || '👤 用户';
}

// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 检查Supabase连接状态
async function checkSupabaseConnection() {
    if (!window.supabase) {
        console.warn('Supabase未初始化');
        return false;
    }
    
    try {
        const { data, error } = await window.supabase
            .from('articles')
            .select('count', { count: 'exact', head: true });
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        console.log('Supabase连接正常');
        return true;
    } catch (error) {
        console.error('Supabase连接失败:', error);
        return false;
    }
}

// 监听页面可见性变化，检查登录状态
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 页面变为可见时，检查登录状态
        const user = getCurrentUser();
        if (user) {
            console.log('页面恢复可见，用户仍在登录状态');
        }
    }
});

// 监听存储变化（多标签页同步）
window.addEventListener('storage', function(e) {
    if (e.key === 'userAuth') {
        if (e.newValue === null) {
            // 其他标签页退出了登录
            console.log('检测到其他标签页退出登录');
            window.location.href = 'supabase-login.html';
        }
    }
});

console.log('✅ 认证检查模块加载完成');