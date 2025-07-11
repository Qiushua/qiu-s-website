// Supabase版本的认证检查
function checkAuth() {
    const userAuth = localStorage.getItem('userAuth')
    
    if (!userAuth) {
        console.log('用户未登录，跳转到Supabase登录页')
        window.location.href = 'supabase-login.html'
        return null
    }
    
    try {
        const user = JSON.parse(userAuth)
        const loginTime = user.loginTime
        const currentTime = new Date().getTime()
        
        // 检查登录是否过期（24小时）
        if (currentTime - loginTime > 24 * 60 * 60 * 1000) {
            console.log('登录已过期')
            localStorage.removeItem('userAuth')
            window.location.href = 'supabase-login.html'
            return null
        }
        
        console.log('用户已登录:', user.name, '权限:', user.permissions)
        return user
    } catch (error) {
        console.error('用户信息解析失败:', error)
        localStorage.removeItem('userAuth')
        window.location.href = 'supabase-login.html'
        return null
    }
}

// 获取当前用户信息
function getCurrentUser() {
    return checkAuth()
}

// 检查权限
function hasPermission(permission) {
    const user = getCurrentUser()
    return user && user.permissions.includes(permission)
}

// 退出登录
function logout() {
    if (window.logoutUser) {
        window.logoutUser()
    } else {
        localStorage.removeItem('userAuth')
        window.location.href = 'supabase-login.html'
    }
}

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    const user = checkAuth()
    if (user) {
        initializeUserInterface(user)
    }
})

// 初始化用户界面
function initializeUserInterface(user) {
    console.log('初始化用户界面，用户:', user.name)
    
    showUserInfo(user)
    
    if (hasPermission('edit')) {
        showEditFeatures()
    }
    
    if (hasPermission('admin')) {
        showAdminFeatures()
    }
}

// 显示用户信息
function showUserInfo(user) {
    const navbar = document.querySelector('.nav-container')
    if (navbar) {
        const existingUserInfo = navbar.querySelector('.user-info')
        if (existingUserInfo) {
            existingUserInfo.remove()
        }
        
        const userInfo = document.createElement('div')
        userInfo.className = 'user-info'
        userInfo.innerHTML = `
            <span>👋 ${user.name} (${user.role})</span>
            <button onclick="logout()" class="logout-btn">退出</button>
        `
        navbar.appendChild(userInfo)
    }
}

// 显示编辑功能
function showEditFeatures() {
    const articlesLink = document.getElementById('articlesLink')
    if (articlesLink) {
        articlesLink.style.display = 'inline-block'
    }
    console.log('编辑功能已启用')
}

// 显示管理功能
function showAdminFeatures() {
    console.log('管理员功能已启用')
}

console.log('Supabase认证检查模块已加载')