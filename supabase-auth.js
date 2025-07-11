// Supabase认证逻辑
console.log('🔐 Supabase认证模块开始加载...');

// 全局变量
let isProcessing = false;

// 监听认证状态变化
if (window.supabase) {
    window.supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('认证状态变化:', event, session?.user?.email || '未登录');
        
        if (event === 'SIGNED_IN' && session && !isProcessing) {
            isProcessing = true;
            await handleUserSignIn(session.user);
        } else if (event === 'SIGNED_OUT') {
            handleUserSignOut();
        }
    });
}

// 处理用户登录成功
async function handleUserSignIn(user) {
    console.log('处理用户登录:', user.email);
    
    try {
        showMessage('登录成功，正在获取用户信息...', 'info');
        
        // 获取用户资料
        let { data: profile, error } = await window.supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            // 用户资料不存在，使用默认值
            profile = {
                id: user.id,
                name: user.email.split('@')[0],
                role: 'editor'
            };
            console.log('用户资料不存在，使用默认值:', profile);
        } else if (error) {
            throw error;
        }
        
        // 保存用户信息到本地存储
        const userInfo = {
            uid: user.id,
            email: user.email,
            name: profile.name,
            role: profile.role,
            permissions: getRolePermissions(profile.role),
            loginTime: new Date().getTime()
        };
        
        localStorage.setItem('userAuth', JSON.stringify(userInfo));
        
        showMessage('登录成功！正在跳转到主页...', 'success');
        
        // 延迟跳转，让用户看到成功信息
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('获取用户资料失败:', error);
        showMessage('获取用户信息失败: ' + error.message, 'error');
        isProcessing = false;
    }
}

// 处理用户登出
function handleUserSignOut() {
    console.log('用户已登出');
    localStorage.removeItem('userAuth');
    isProcessing = false;
}

// 用户登录函数
window.handleLogin = async function() {
    if (isProcessing) return;
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // 清除之前的错误信息
    clearValidationErrors();
    
    // 验证输入
    let hasError = false;
    
    if (!email) {
        showValidationError('loginEmailError', '请输入邮箱地址');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showValidationError('loginEmailError', '请输入正确的邮箱格式');
        hasError = true;
    }
    
    if (!password) {
        showValidationError('loginPasswordError', '请输入密码');
        hasError = true;
    }
    
    if (hasError) return;
    
    setLoadingState(true, 'loginBtn', '🔐 登录中...');
    
    try {
        console.log('尝试登录:', email);
        
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        console.log('Supabase登录成功:', data.user.email);
        // onAuthStateChange会处理后续逻辑
        
    } catch (error) {
        console.error('登录失败:', error);
        setLoadingState(false, 'loginBtn', '🔐 立即登录');
        showMessage(getErrorMessage(error.message), 'error');
        isProcessing = false;
    }
};

// 用户注册函数
window.handleRegister = async function() {
    if (isProcessing) return;
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('userRole').value;
    
    // 清除之前的错误信息
    clearValidationErrors();
    
    // 验证输入
    let hasError = false;
    
    if (!name) {
        showValidationError('registerNameError', '请输入用户名');
        hasError = true;
    } else if (name.length < 2 || name.length > 20) {
        showValidationError('registerNameError', '用户名长度应在2-20个字符之间');
        hasError = true;
    }
    
    if (!email) {
        showValidationError('registerEmailError', '请输入邮箱地址');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showValidationError('registerEmailError', '请输入正确的邮箱格式');
        hasError = true;
    }
    
    if (!password) {
        showValidationError('registerPasswordError', '请输入密码');
        hasError = true;
    } else if (password.length < 6) {
        showValidationError('registerPasswordError', '密码至少需要6位字符');
        hasError = true;
    }
    
    if (hasError) return;
    
    setLoadingState(true, 'registerBtn', '✨ 创建中...');
    
    try {
        console.log('尝试注册:', email);
        
        // 创建用户账户
        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        if (data.user) {
            console.log('Supabase注册成功:', data.user.email);
            
            // 创建用户资料
            const { error: profileError } = await window.supabase
                .from('user_profiles')
                .insert([
                    {
                        id: data.user.id,
                        name: name,
                        role: role
                    }
                ]);
            
            if (profileError) {
                console.warn('创建用户资料失败:', profileError);
                // 不抛出错误，因为用户已创建成功
            } else {
                console.log('用户资料创建成功');
            }
            
            showMessage('注册成功！正在自动登录...', 'success');
            // onAuthStateChange会处理自动登录
        }
        
    } catch (error) {
        console.error('注册失败:', error);
        setLoadingState(false, 'registerBtn', '✨ 创建账户');
        showMessage(getErrorMessage(error.message), 'error');
        isProcessing = false;
    }
};

// 显示注册表单
window.showRegister = function() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    clearMessage();
    clearValidationErrors();
    
    // 清空输入框
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    
    // 聚焦到用户名
    setTimeout(() => {
        document.getElementById('registerName').focus();
    }, 100);
};

// 显示登录表单
window.showLogin = function() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
    clearMessage();
    clearValidationErrors();
    
    // 清空输入框
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    
    // 聚焦到邮箱
    setTimeout(() => {
        document.getElementById('loginEmail').focus();
    }, 100);
};

// 显示消息
function showMessage(message, type = 'info') {
    console.log(`消息 (${type}):`, message);
    
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message ${type} show`;
    
    if (type === 'success') {
        setTimeout(clearMessage, 5000);
    } else if (type === 'error') {
        setTimeout(clearMessage, 8000);
    } else if (type === 'info') {
        setTimeout(clearMessage, 4000);
    }
}

// 清除消息
function clearMessage() {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.classList.remove('show');
    }
}

// 显示验证错误
function showValidationError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        
        // 添加错误样式到输入框
        const inputElement = errorElement.parentElement.querySelector('input');
        if (inputElement) {
            inputElement.classList.add('error');
        }
    }
}

// 清除验证错误
function clearValidationErrors() {
    const errorElements = document.querySelectorAll('.validation-message');
    const inputElements = document.querySelectorAll('.form-group input');
    
    errorElements.forEach(element => {
        element.classList.remove('show');
        element.textContent = '';
    });
    
    inputElements.forEach(element => {
        element.classList.remove('error');
    });
}

// 设置加载状态
function setLoadingState(loading, buttonId, loadingText) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = loading;
        
        if (loading) {
            button.classList.add('loading');
            button.setAttribute('data-original-text', button.textContent);
            button.textContent = loadingText;
        } else {
            button.classList.remove('loading');
            const originalText = button.getAttribute('data-original-text');
            button.textContent = originalText || button.textContent;
        }
    }
}

// 验证邮箱格式
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 获取角色权限
function getRolePermissions(role) {
    const permissions = {
        'visitor': ['view'],
        'editor': ['view', 'edit'],
        'admin': ['view', 'edit', 'admin']
    };
    return permissions[role] || permissions['visitor'];
}

// 错误信息处理
function getErrorMessage(errorMessage) {
    const commonErrors = {
        'Invalid login credentials': '邮箱或密码错误，请检查后重试',
        'User already registered': '该邮箱已被注册，请直接登录或使用其他邮箱',
        'Password should be at least 6 characters': '密码至少需要6位字符',
        'Unable to validate email address: invalid format': '邮箱格式不正确，请重新输入',
        'signup disabled': '注册功能暂时关闭，请联系管理员',
        'too many requests': '请求过于频繁，请稍后再试',
        'Email not confirmed': '请先验证您的邮箱地址',
        'Invalid email or password': '邮箱或密码错误'
    };
    
    return commonErrors[errorMessage] || `操作失败: ${errorMessage}`;
}

// 用户退出登录
window.logoutUser = async function() {
    if (isProcessing) return;
    
    try {
        isProcessing = true;
        const { error } = await window.supabase.auth.signOut();
        
        if (error) throw error;
        
        console.log('用户已退出登录');
        localStorage.removeItem('userAuth');
        window.location.href = 'supabase-login.html';
        
    } catch (error) {
        console.error('退出登录失败:', error);
        showMessage('退出登录失败: ' + error.message, 'error');
        isProcessing = false;
    }
};

// 回车键登录/注册
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !isProcessing) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (!loginForm.classList.contains('hidden')) {
            handleLogin();
        } else if (!registerForm.classList.contains('hidden')) {
            handleRegister();
        }
    }
});

// 页面加载完成后聚焦
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const emailInput = document.getElementById('loginEmail');
        if (emailInput && !emailInput.value) {
            emailInput.focus();
        }
    }, 500);
});

console.log('✅ Supabase认证模块加载完成');