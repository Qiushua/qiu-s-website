// Supabase认证逻辑

// 监听认证状态变化
window.supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('认证状态变化:', event, session?.user?.email || '未登录')
    
    if (event === 'SIGNED_IN' && session) {
        await handleUserSignIn(session.user)
    } else if (event === 'SIGNED_OUT') {
        handleUserSignOut()
    }
})

// 处理用户登录
async function handleUserSignIn(user) {
    console.log('用户登录成功:', user.email)
    
    try {
        // 获取或创建用户资料
        let { data: profile, error } = await window.supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single()
        
        if (error && error.code === 'PGRST116') {
            // 用户资料不存在，可能是老用户，使用默认值
            profile = {
                id: user.id,
                name: user.email.split('@')[0],
                role: 'editor'
            }
            console.log('使用默认用户资料:', profile)
        } else if (error) {
            throw error
        }
        
        // 保存用户信息到本地存储
        const userInfo = {
            uid: user.id,
            email: user.email,
            name: profile.name,
            role: profile.role,
            permissions: getRolePermissions(profile.role),
            loginTime: new Date().getTime()
        }
        
        localStorage.setItem('userAuth', JSON.stringify(userInfo))
        
        showMessage('登录成功！正在跳转...', 'success')
        
        // 延迟跳转
        setTimeout(() => {
            window.location.href = 'index.html'
        }, 2000)
        
    } catch (error) {
        console.error('获取用户资料失败:', error)
        showMessage('获取用户信息失败: ' + error.message, 'error')
    }
}

// 处理用户登出
function handleUserSignOut() {
    console.log('用户已登出')
    localStorage.removeItem('userAuth')
}

// 用户登录函数
window.loginUser = async function() {
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value
    
    // 验证输入
    if (!email || !password) {
        showMessage('请填写邮箱和密码', 'error')
        return
    }
    
    if (!isValidEmail(email)) {
        showMessage('请输入正确的邮箱格式', 'error')
        return
    }
    
    showLoading(true)
    
    try {
        console.log('尝试登录:', email)
        
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        })
        
        if (error) throw error
        
        console.log('Supabase登录成功:', data.user.email)
        // onAuthStateChange会处理后续逻辑
        
    } catch (error) {
        console.error('登录失败:', error)
        showLoading(false)
        showMessage(getErrorMessage(error.message), 'error')
    }
}

// 用户注册函数
window.registerUser = async function() {
    const name = document.getElementById('registerName').value.trim()
    const email = document.getElementById('registerEmail').value.trim()
    const password = document.getElementById('registerPassword').value
    const role = document.getElementById('userRole').value
    
    // 验证输入
    if (!name || !email || !password) {
        showMessage('请填写所有信息', 'error')
        return
    }
    
    if (name.length < 2 || name.length > 20) {
        showMessage('用户名长度应在2-20个字符之间', 'error')
        return
    }
    
    if (!isValidEmail(email)) {
        showMessage('请输入正确的邮箱格式', 'error')
        return
    }
    
    if (password.length < 6) {
        showMessage('密码至少需要6位字符', 'error')
        return
    }
    
    showLoading(true)
    
    try {
        console.log('尝试注册:', email)
        
        // 创建用户账户
        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: password
        })
        
        if (error) throw error
        
        if (data.user) {
            console.log('Supabase注册成功:', data.user.email)
            
            // 创建用户资料
            const { error: profileError } = await window.supabase
                .from('user_profiles')
                .insert([
                    {
                        id: data.user.id,
                        name: name,
                        role: role
                    }
                ])
            
            if (profileError) {
                console.warn('创建用户资料失败:', profileError)
                // 不抛出错误，因为用户已创建成功
            } else {
                console.log('用户资料创建成功')
            }
            
            showMessage('注册成功！正在自动登录...', 'success')
            // onAuthStateChange会处理自动登录
        }
        
    } catch (error) {
        console.error('注册失败:', error)
        showLoading(false)
        showMessage(getErrorMessage(error.message), 'error')
    }
}

// 显示注册表单
window.showRegister = function() {
    document.getElementById('loginForm').classList.add('hidden')
    document.getElementById('registerForm').classList.remove('hidden')
    clearMessage()
    
    // 清空输入框
    document.getElementById('registerName').value = ''
    document.getElementById('registerEmail').value = ''
    document.getElementById('registerPassword').value = ''
    
    // 聚焦到用户名
    setTimeout(() => {
        document.getElementById('registerName').focus()
    }, 100)
}

// 显示登录表单
window.showLogin = function() {
    document.getElementById('registerForm').classList.add('hidden')
    document.getElementById('loginForm').classList.remove('hidden')
    clearMessage()
    
    // 清空输入框
    document.getElementById('loginEmail').value = ''
    document.getElementById('loginPassword').value = ''
    
    // 聚焦到邮箱
    setTimeout(() => {
        document.getElementById('loginEmail').focus()
    }, 100)
}

// 显示消息
function showMessage(message, type = 'info') {
    console.log(`消息 (${type}):`, message)
    
    const messageBox = document.getElementById('messageBox')
    messageBox.textContent = message
    messageBox.className = `message ${type} show`
    
    if (type === 'success') {
        setTimeout(clearMessage, 5000)
    } else if (type === 'error') {
        setTimeout(clearMessage, 8000)
    }
}

// 清除消息
function clearMessage() {
    const messageBox = document.getElementById('messageBox')
    messageBox.classList.remove('show')
}

// 显示加载状态
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner')
    const buttons = document.querySelectorAll('.auth-btn')
    
    if (show) {
        spinner.classList.remove('hidden')
        buttons.forEach(btn => btn.disabled = true)
    } else {
        spinner.classList.add('hidden')
        buttons.forEach(btn => btn.disabled = false)
    }
}

// 验证邮箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

// 获取角色权限
function getRolePermissions(role) {
    const permissions = {
        'visitor': ['view'],
        'editor': ['view', 'edit'],
        'admin': ['view', 'edit', 'admin']
    }
    return permissions[role] || permissions['visitor']
}

// 错误信息处理
function getErrorMessage(errorMessage) {
    // Supabase错误信息通常比较清晰，直接返回
    const commonErrors = {
        'Invalid login credentials': '邮箱或密码错误',
        'User already registered': '该邮箱已被注册',
        'Password should be at least 6 characters': '密码至少需要6位字符',
        'Unable to validate email address: invalid format': '邮箱格式不正确',
        'signup disabled': '注册功能已禁用',
        'too many requests': '请求过于频繁，请稍后再试'
    }
    
    return commonErrors[errorMessage] || errorMessage
}

// 用户退出登录
window.logoutUser = async function() {
    try {
        const { error } = await window.supabase.auth.signOut()
        if (error) throw error
        
        console.log('用户已退出登录')
        localStorage.removeItem('userAuth')
        window.location.href = 'supabase-login.html'
        
    } catch (error) {
        console.error('退出登录失败:', error)
        showMessage('退出登录失败: ' + error.message, 'error')
    }
}

// 回车键登录/注册
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const loginForm = document.getElementById('loginForm')
        const registerForm = document.getElementById('registerForm')
        
        if (!loginForm.classList.contains('hidden')) {
            loginUser()
        } else if (!registerForm.classList.contains('hidden')) {
            registerUser()
        }
    }
})

// 页面加载完成后聚焦
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const emailInput = document.getElementById('loginEmail')
        if (emailInput) {
            emailInput.focus()
        }
    }, 500)
})

console.log('Supabase认证模块已加载')