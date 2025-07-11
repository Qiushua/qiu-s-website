// Supabase文章管理系统
console.log('📝 开始加载Supabase文章管理模块...');

// 全局变量
let articlesSubscription = null;
let currentArticles = [];
let currentEditingId = null;
let currentUser = null;
let deleteTargetId = null;

// 初始化文章管理系统
window.initArticleSystem = async function() {
    console.log('🚀 初始化文章管理系统...');
    
    // 获取当前用户
    currentUser = getCurrentUser();
    if (!currentUser) {
        console.error('用户未登录');
        window.location.href = 'supabase-login.html';
        return;
    }
    
    if (!window.supabase) {
        console.error('Supabase未初始化');
        updateSystemStatus('❌ Supabase连接失败', 'error');
        return;
    }
    
    try {
        // 测试数据库连接
        const { data, error } = await window.supabase
            .from('articles')
            .select('count', { count: 'exact', head: true });
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        console.log('✅ 数据库连接成功');
        updateSystemStatus('✅ 系统连接成功，正在加载文章...', 'success');
        
        // 加载文章列表
        await loadArticles();
        
        // 设置实时监听
        setupRealtimeSubscription();
        
        // 显示统计信息
        showArticlesStats();
        
        // 初始化编辑器
        initializeEditor();
        
        console.log('✅ 文章管理系统初始化完成');
        
    } catch (error) {
        console.error('初始化失败:', error);
        updateSystemStatus('❌ 初始化失败: ' + error.message, 'error');
    }
};

// 加载文章列表
async function loadArticles(sortOrder = 'newest') {
    try {
        console.log('📖 正在加载文章列表...');
        
        let query = window.supabase
            .from('articles')
            .select(`
                id,
                title,
                content,
                author,
                author_id,
                created_at,
                updated_at
            `);
        
        // 应用排序
        switch (sortOrder) {
            case 'newest':
                query = query.order('created_at', { ascending: false });
                break;
            case 'oldest':
                query = query.order('created_at', { ascending: true });
                break;
            case 'updated':
                query = query.order('updated_at', { ascending: false });
                break;
            case 'title':
                query = query.order('title', { ascending: true });
                break;
        }
        
        const { data: articles, error } = await query;
        
        if (error) throw error;
        
        currentArticles = articles || [];
        console.log(`✅ 文章加载成功，共 ${currentArticles.length} 篇`);
        
        displayArticles(currentArticles);
        updateArticlesStats(currentArticles);
        
    } catch (error) {
        console.error('加载文章失败:', error);
        showToast('加载文章失败: ' + error.message, 'error');
        displayErrorState('加载文章失败，请刷新页面重试');
    }
}

// 设置实时订阅
function setupRealtimeSubscription() {
    console.log('🔔 设置实时文章订阅...');
    
    articlesSubscription = window.supabase
        .channel('articles-realtime')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'articles' 
            }, 
            (payload) => {
                console.log('📡 收到实时更新:', payload.eventType, payload.new || payload.old);
                
                handleRealtimeUpdate(payload);
            }
        )
        .subscribe((status) => {
            console.log('实时订阅状态:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ 实时监听已启动');
                showToast('实时同步已启用', 'success');
            } else if (status === 'CLOSED') {
                console.log('❌ 实时连接已断开');
                showToast('实时连接断开，正在重连...', 'warning');
            }
        });
}

// 处理实时更新
function handleRealtimeUpdate(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
        case 'INSERT':
            if (newRecord) {
                currentArticles.unshift(newRecord);
                displayArticles(currentArticles);
                updateArticlesStats(currentArticles);
                showToast(`📝 新文章《${newRecord.title}》已发布`, 'info');
            }
            break;
            
        case 'UPDATE':
            if (newRecord) {
                const index = currentArticles.findIndex(article => article.id === newRecord.id);
                if (index !== -1) {
                    currentArticles[index] = newRecord;
                    displayArticles(currentArticles);
                    
                    // 如果不是当前用户的更新，显示提示
                    if (newRecord.author_id !== currentUser.uid) {
                        showToast(`📝 文章《${newRecord.title}》已被${newRecord.author}更新`, 'info');
                    }
                }
            }
            break;
            
        case 'DELETE':
            if (oldRecord) {
                currentArticles = currentArticles.filter(article => article.id !== oldRecord.id);
                displayArticles(currentArticles);
                updateArticlesStats(currentArticles);
                showToast(`🗑️ 文章《${oldRecord.title}》已被删除`, 'warning');
            }
            break;
    }
}

// 显示文章列表
function displayArticles(articles) {
    const articlesList = document.getElementById('articlesList');
    if (!articlesList) return;
    
    console.log(`🎨 显示文章列表，共 ${articles.length} 篇`);
    
    if (articles.length === 0) {
        displayEmptyState();
        return;
    }
    
    articlesList.innerHTML = articles.map(article => createArticleCard(article)).join('');
}

// 创建文章卡片HTML
function createArticleCard(article) {
    const preview = truncateText(article.content, 200);
    const createDate = formatDate(article.created_at);
    const updateDate = formatDate(article.updated_at);
    const isUpdated = article.updated_at !== article.created_at;
    const isOwner = article.author_id === currentUser.uid;
    const canEdit = hasPermission('edit') && isOwner;
    const canDelete = hasPermission('admin') || isOwner;
    
    return `
        <div class="article-card" data-id="${article.id}">
            <div class="article-header">
                <div class="article-title-section">
                    <h3 class="article-title" title="${escapeHtml(article.title)}">
                        ${escapeHtml(article.title)}
                    </h3>
                    <div class="article-badges">
                        ${isOwner ? '<span class="badge owner">我的文章</span>' : ''}
                        ${isUpdated ? '<span class="badge updated">已更新</span>' : ''}
                    </div>
                </div>
                <div class="article-actions">
                    <button onclick="viewArticle('${article.id}')" 
                            class="action-btn view-btn" 
                            title="查看文章">
                        👁️
                    </button>
                    ${canEdit ? `
                        <button onclick="editArticle('${article.id}')" 
                                class="action-btn edit-btn" 
                                title="编辑文章">
                            ✏️
                        </button>
                    ` : ''}
                    ${canDelete ? `
                        <button onclick="deleteArticle('${article.id}')" 
                                class="action-btn delete-btn" 
                                title="删除文章">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="article-preview">
                ${escapeHtml(preview)}
            </div>
            
            <div class="article-meta">
                <div class="meta-info">
                    <span class="author">
                        <span class="meta-icon">👤</span>
                        ${escapeHtml(article.author)}
                    </span>
                    <span class="create-date">
                        <span class="meta-icon">📅</span>
                        ${createDate}
                    </span>
                    ${isUpdated ? `
                        <span class="update-date">
                            <span class="meta-icon">🔄</span>
                            更新于 ${updateDate}
                        </span>
                    ` : ''}
                </div>
                <div class="article-stats">
                    <span class="word-count">
                        ${article.content.length} 字
                    </span>
                </div>
            </div>
        </div>
    `;
}

// 显示空状态
function displayEmptyState() {
    const articlesList = document.getElementById('articlesList');
    articlesList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📝</div>
            <h3>还没有文章</h3>
            <p>点击上方的"创建新文章"按钮开始写作吧！</p>
            <p class="empty-tip">所有文章都会保存在Supabase云端，支持多人协作编辑</p>
            <button onclick="createNewArticle()" class="empty-action-btn">
                ✨ 立即创建第一篇文章
            </button>
        </div>
    `;
}

// 显示错误状态
function displayErrorState(message) {
    const articlesList = document.getElementById('articlesList');
    articlesList.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>加载失败</h3>
            <p>${message}</p>
            <button onclick="refreshArticles()" class="retry-btn">
                🔄 重新加载
            </button>
        </div>
    `;
}

// 创建新文章
window.createNewArticle = function() {
    if (!hasPermission('edit')) {
        showToast('您没有创建文章的权限', 'error');
        return;
    }
    
    console.log('📝 创建新文章');
    
    currentEditingId = null;
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleContent').value = '';
    updateEditorStatus('正在创建新文章...');
    updateWordCount();
    updateTitleCounter();
    
    showEditor();
    document.getElementById('articleTitle').focus();
};

// 查看文章
window.viewArticle = async function(articleId) {
    console.log('👁️ 查看文章:', articleId);
    
    try {
        const { data: article, error } = await window.supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();
        
        if (error) throw error;
        
        showArticlePreview(article);
        
    } catch (error) {
        console.error('获取文章失败:', error);
        showToast('获取文章失败: ' + error.message, 'error');
    }
};

// 编辑文章
window.editArticle = async function(articleId) {
    if (!hasPermission('edit')) {
        showToast('您没有编辑权限', 'error');
        return;
    }
    
    console.log('✏️ 编辑文章:', articleId);
    
    try {
        const { data: article, error } = await window.supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single();
        
        if (error) throw error;
        
        // 检查权限
        if (article.author_id !== currentUser.uid && !hasPermission('admin')) {
            showToast('您只能编辑自己的文章', 'error');
            return;
        }
        
        currentEditingId = articleId;
        document.getElementById('articleTitle').value = article.title;
        document.getElementById('articleContent').value = article.content;
        updateEditorStatus(`正在编辑《${article.title}》`);
        updateWordCount();
        updateTitleCounter();
        
        showEditor();
        document.getElementById('articleTitle').focus();
        
    } catch (error) {
        console.error('获取文章失败:', error);
        showToast('获取文章失败: ' + error.message, 'error');
    }
};

// 删除文章
window.deleteArticle = function(articleId) {
    const article = currentArticles.find(a => a.id === articleId);
    if (!article) return;
    
    // 检查权限
    if (article.author_id !== currentUser.uid && !hasPermission('admin')) {
        showToast('您只能删除自己的文章', 'error');
        return;
    }
    
    deleteTargetId = articleId;
    showDeleteModal(article.title);
};

// 确认删除
window.confirmDelete = async function() {
    if (!deleteTargetId) return;
    
    console.log('🗑️ 删除文章:', deleteTargetId);
    
    try {
        const { error } = await window.supabase
            .from('articles')
            .delete()
            .eq('id', deleteTargetId);
        
        if (error) throw error;
        
        console.log('✅ 文章删除成功');
        showToast('文章已删除', 'success');
        hideDeleteModal();
        
        // 本地更新（实时订阅会自动处理，但这样更快）
        currentArticles = currentArticles.filter(a => a.id !== deleteTargetId);
        displayArticles(currentArticles);
        updateArticlesStats(currentArticles);
        
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
    }
    
    deleteTargetId = null;
};

// 取消删除
window.cancelDelete = function() {
    deleteTargetId = null;
    hideDeleteModal();
};

// 保存文章
window.saveArticle = async function() {
    const title = document.getElementById('articleTitle').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    
    if (!title || !content) {
        showToast('请填写标题和内容', 'error');
        return;
    }
    
    if (title.length > 100) {
        showToast('标题不能超过100个字符', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 保存中...';
    
    updateEditorStatus('正在保存到云端...');
    
    try {
        if (currentEditingId) {
            // 更新现有文章
            console.log('📝 更新文章:', currentEditingId);
            
            const { data, error } = await window.supabase
                .from('articles')
                .update({
                    title: title,
                    content: content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentEditingId)
                .select()
                .single();
            
            if (error) throw error;
            
            console.log('✅ 文章更新成功');
            showToast('文章更新成功', 'success');
            
        } else {
            // 创建新文章
            console.log('📝 创建新文章');
            
            const { data, error } = await window.supabase
                .from('articles')
                .insert([
                    {
                        title: title,
                        content: content,
                        author: currentUser.name,
                        author_id: currentUser.uid
                    }
                ])
                .select()
                .single();
            
            if (error) throw error;
            
            console.log('✅ 新文章创建成功');
            showToast('文章发布成功', 'success');
        }
        
        updateEditorStatus('保存成功');
        updateSaveTime();
        hideEditor();
        
        // 不需要手动刷新，实时订阅会自动更新
        
    } catch (error) {
        console.error('保存失败:', error);
        showToast('保存失败: ' + error.message, 'error');
        updateEditorStatus('保存失败');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
};

// 预览文章
window.previewArticle = function() {
    const title = document.getElementById('articleTitle').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    
    if (!title && !content) {
        showToast('没有内容可以预览', 'warning');
        return;
    }
    
    showArticlePreview({
        title: title || '无标题',
        content: content || '无内容',
        author: currentUser.name,
        created_at: new Date().toISOString()
    });
};

// 刷新文章列表
window.refreshArticles = async function() {
    console.log('🔄 手动刷新文章列表');
    const sortOrder = document.getElementById('sortOrder').value;
    await loadArticles(sortOrder);
    showToast('文章列表已刷新', 'success');
};

// 处理排序变化
window.handleSortChange = function() {
    const sortOrder = document.getElementById('sortOrder').value;
    console.log('📊 排序方式变更:', sortOrder);
    loadArticles(sortOrder);
};

// 显示编辑器
function showEditor() {
    document.getElementById('articleEditor').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

// 隐藏编辑器
function hideEditor() {
    document.getElementById('articleEditor').classList.add('hidden');
    document.body.style.overflow = ''; // 恢复滚动
    currentEditingId = null;
}

// 关闭编辑器
window.closeEditor = function() {
    const title = document.getElementById('articleTitle').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    
    if ((title || content) && !confirm('您有未保存的内容，确定要关闭吗？')) {
        return;
    }
    
    hideEditor();
};

// 显示文章预览
function showArticlePreview(article) {
    const modal = document.getElementById('previewModal');
    const content = document.getElementById('previewContent');
    
    content.innerHTML = `
        <div class="preview-header">
            <h1>${escapeHtml(article.title)}</h1>
            <div class="preview-meta">
                <span>作者：${escapeHtml(article.author)}</span>
                <span>发布时间：${formatDate(article.created_at)}</span>
                <span>字数：${article.content.length}</span>
            </div>
        </div>
        <div class="preview-body">
            ${formatContent(article.content)}
        </div>
    `;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// 关闭预览
window.closePreview = function() {
    document.getElementById('previewModal').classList.add('hidden');
    document.body.style.overflow = '';
};

// 显示删除确认模态框
function showDeleteModal(articleTitle) {
    const modal = document.getElementById('deleteModal');
    modal.querySelector('.modal-body p').textContent = `您确定要删除文章《${articleTitle}》吗？`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// 隐藏删除确认模态框
function hideDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
    document.body.style.overflow = '';
}

// 初始化编辑器
function initializeEditor() {
    const titleInput = document.getElementById('articleTitle');
    const contentTextarea = document.getElementById('articleContent');
    
    // 标题字数统计
    titleInput.addEventListener('input', updateTitleCounter);
    
    // 内容字数统计
    contentTextarea.addEventListener('input', updateWordCount);
    
    // 自动保存（可选功能）
    let autoSaveTimer;
    contentTextarea.addEventListener('input', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            if (currentEditingId && titleInput.value.trim() && contentTextarea.value.trim()) {
                // 自动保存逻辑
                updateEditorStatus('自动保存中...');
            }
        }, 30000); // 30秒后自动保存
    });
}

// 更新标题计数器
function updateTitleCounter() {
    const titleInput = document.getElementById('articleTitle');
    const counter = document.getElementById('titleCounter');
    const length = titleInput.value.length;
    
    counter.textContent = `${length}/100`;
    
    if (length > 90) {
        counter.style.color = '#e74c3c';
    } else if (length > 70) {
        counter.style.color = '#f39c12';
    } else {
        counter.style.color = '#95a5a6';
    }
}

// 更新字数统计
function updateWordCount() {
    const content = document.getElementById('articleContent').value;
    const wordCount = content.length;
    document.getElementById('wordCount').textContent = `${wordCount.toLocaleString()} 字`;
}

// 更新编辑器状态
function updateEditorStatus(status) {
    document.getElementById('editorStatus').textContent = status;
}

// 更新保存时间
function updateSaveTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    document.getElementById('saveTime').textContent = `已保存 ${timeString}`;
}

// 插入文本（工具栏功能）
window.insertText = function(before, after) {
    const textarea = document.getElementById('articleContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + selectedText + after;
    
    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    
    // 重新设置光标位置
    const newPosition = start + before.length + selectedText.length;
    textarea.setSelectionRange(newPosition, newPosition);
    textarea.focus();
    
    updateWordCount();
};

// 更新文章统计
function updateArticlesStats(articles) {
    const totalElement = document.getElementById('totalArticles');
    const myElement = document.getElementById('myArticles');
    const todayElement = document.getElementById('todayArticles');
    
    if (!totalElement) return;
    
    const total = articles.length;
    const myArticles = articles.filter(a => a.author_id === currentUser.uid).length;
    const today = new Date().toDateString();
    const todayArticles = articles.filter(a => 
        new Date(a.created_at).toDateString() === today
    ).length;
    
    totalElement.textContent = total;
    myElement.textContent = myArticles;
    todayElement.textContent = todayArticles;
    
    // 显示统计区域
    document.getElementById('articlesStats').classList.remove('hidden');
}

// 显示统计信息
function showArticlesStats() {
    updateArticlesStats(currentArticles);
}

// 显示提示消息
function showToast(message, type = 'info') {
    console.log(`💬 提示 (${type}):`, message);
    
    // 移除已存在的提示
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新提示
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="toast-close">✕</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, type === 'error' ? 6000 : 4000);
}

// 获取提示图标
function getToastIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// 工具函数
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '今天';
    } else if (diffDays === 2) {
        return '昨天';
    } else if (diffDays <= 7) {
        return `${diffDays - 1}天前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

function formatContent(content) {
    // 简单的内容格式化
    return content
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 键盘快捷键
document.addEventListener('keydown', function(e) {
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!document.getElementById('articleEditor').classList.contains('hidden')) {
            saveArticle();
        }
    }
    
    // Ctrl+Enter 发布
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!document.getElementById('articleEditor').classList.contains('hidden')) {
            saveArticle();
        }
    }
    
    // Esc 关闭
    if (e.key === 'Escape') {
        if (!document.getElementById('articleEditor').classList.contains('hidden')) {
            closeEditor();
        } else if (!document.getElementById('previewModal').classList.contains('hidden')) {
            closePreview();
        } else if (!document.getElementById('deleteModal').classList.contains('hidden')) {
            cancelDelete();
        }
    }
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (articlesSubscription) {
        console.log('🧹 清理实时订阅');
        articlesSubscription.unsubscribe();
    }
});

console.log('✅ Supabase文章管理模块加载完成');