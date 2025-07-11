// Supabase文章管理系统

let articlesSubscription = null

// 初始化文章管理
window.initSupabaseArticles = async function() {
    console.log('初始化Supabase文章管理...')
    
    if (!window.supabase) {
        console.error('Supabase未初始化')
        showMessage('Supabase连接失败', 'error')
        return
    }
    
    // 测试连接
    try {
        const { data, error } = await window.supabase
            .from('articles')
            .select('count', { count: 'exact', head: true })
        
        if (error) throw error
        
        console.log('Supabase文章表连接成功')
        updateConnectionStatus('✅ 已连接到Supabase数据库', 'success')
        
        // 加载文章数据
        await loadArticles()
        
        // 设置实时监听
        setupRealtimeSubscription()
        
    } catch (error) {
        console.error('连接失败:', error)
        updateConnectionStatus('❌ 连接失败: ' + error.message, 'error')
    }
}

// 加载文章列表
async function loadArticles() {
    try {
        console.log('正在加载文章...')
        
        const { data: articles, error } = await window.supabase
            .from('articles')
            .select(`
                id,
                title,
                content,
                author,
                author_id,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false })
        
        if (error) throw error
        
        console.log('文章加载成功，数量:', articles.length)
        displayArticles(articles)
        
    } catch (error) {
        console.error('加载文章失败:', error)
        showMessage('加载文章失败: ' + error.message, 'error')
    }
}

// 设置实时订阅
function setupRealtimeSubscription() {
    console.log('设置实时监听...')
    
    articlesSubscription = window.supabase
        .channel('articles-changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'articles' 
            }, 
            (payload) => {
                console.log('收到实时更新:', payload.eventType, payload.new || payload.old)
                
                // 重新加载文章列表
                loadArticles()
                
                // 显示提示
                if (payload.eventType === 'INSERT') {
                    showMessage('有新文章发布！', 'info')
                } else if (payload.eventType === 'UPDATE') {
                    showMessage('文章已更新', 'info')
                } else if (payload.eventType === 'DELETE') {
                    showMessage('文章已删除', 'info')
                }
            }
        )
        .subscribe((status) => {
            console.log('实时订阅状态:', status)
            if (status === 'SUBSCRIBED') {
                console.log('实时监听已启动')
            }
        })
}

// 保存文章到Supabase
window.saveArticleToSupabase = async function(title, content) {
    const user = getCurrentUser()
    if (!user) {
        showMessage('用户未登录', 'error')
        return
    }
    
    console.log('保存文章到Supabase:', title)
    
    try {
        if (window.currentEditingId) {
            // 更新现有文章
            console.log('更新文章ID:', window.currentEditingId)
            
            const { data, error } = await window.supabase
                .from('articles')
                .update({
                    title: title,
                    content: content,
                    updated_at: new Date().toISOString()
                })
                .eq('id', window.currentEditingId)
                .select()
            
            if (error) throw error
            
            console.log('文章更新成功:', data)
            
        } else {
            // 创建新文章
            console.log('创建新文章')
            
            const { data, error } = await window.supabase
                .from('articles')
                .insert([
                    {
                        title: title,
                        content: content,
                        author: user.name,
                        author_id: user.uid
                    }
                ])
                .select()
            
            if (error) throw error
            
            console.log('新文章创建成功:', data)
        }
        
        closeEditor()
        showMessage('文章保存成功！', 'success')
        
        // 清空编辑器状态
        window.currentEditingId = null
        
    } catch (error) {
        console.error('保存文章失败:', error)
        showMessage('保存失败: ' + error.message, 'error')
    }
}

// 删除文章
window.deleteArticleFromSupabase = async function(articleId) {
    const user = getCurrentUser()
    
    if (!hasPermission('admin')) {
        showMessage('您没有删除权限', 'error')
        return
    }
    
    if (!confirm('确定要删除这篇文章吗？此操作不可恢复！')) {
        return
    }
    
    console.log('删除文章ID:', articleId)
    
    try {
        const { error } = await window.supabase
            .from('articles')
            .delete()
            .eq('id', articleId)
        
        if (error) throw error
        
        console.log('文章删除成功')
        showMessage('文章已删除', 'success')
        
    } catch (error) {
        console.error('删除失败:', error)
        showMessage('删除失败: ' + error.message, 'error')
    }
}

// 显示文章列表
function displayArticles(articles) {
    const articlesList = document.getElementById('articlesList')
    if (!articlesList) return
    
    console.log('显示文章列表，数量:', articles.length)
    
    if (articles.length === 0) {
        articlesList.innerHTML = `
            <div class="no-articles">
                <div class="empty-state">
                    <h3>📝 还没有文章</h3>
                    <p>点击上方按钮创建第一篇文章吧！</p>
                    <p class="small-text">数据保存在Supabase云端，支持实时同步</p>
                </div>
            </div>
        `
        return
    }
    
    articlesList.innerHTML = articles.map(article => {
        const preview = article.content.substring(0, 150) + (article.content.length > 150 ? '...' : '')
        const createDate = new Date(article.created_at).toLocaleString('zh-CN')
        const updateDate = new Date(article.updated_at).toLocaleString('zh-CN')
        const isUpdated = article.updated_at !== article.created_at
        
        return `
            <div class="article-card" data-id="${article.id}">
                <div class="article-header">
                    <h3 class="article-title">${escapeHtml(article.title)}</h3>
                    <div class="article-meta">
                        <span class="author">👤 ${escapeHtml(article.author)}</span>
                        <span class="date">📅 ${createDate}</span>
                        ${isUpdated ? `<span class="updated">🔄 更新: ${updateDate}</span>` : ''}
                    </div>
                </div>
                
                <div class="article-preview">${escapeHtml(preview)}</div>
                
                <div class="article-actions">
                    <button onclick="viewArticle('${article.id}', '${escapeHtml(article.title)}')" 
                            class="view-btn" title="查看完整文章">
                        👁️ 查看
                    </button>
                    ${hasPermission('edit') ? 
                        `<button onclick="editArticle('${article.id}')" 
                                class="edit-btn" title="编辑文章">
                            ✏️ 编辑
                        </button>` : ''}
                    ${hasPermission('admin') ? 
                        `<button onclick="deleteArticleFromSupabase('${article.id}')" 
                                class="delete-btn" title="删除文章">
                            🗑️ 删除
                        </button>` : ''}
                </div>
            </div>
        `
    }).join('')
}

// 查看文章详情
window.viewArticle = async function(articleId, title) {
    console.log('查看文章ID:', articleId)
    
    try {
        const { data: article, error } = await window.supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single()
        
        if (error) throw error
        
        // 创建文章查看窗口
        const viewWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
        
        viewWindow.document.write(`
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${escapeHtml(article.title)}</title>
                <style>
                    body {
                        font-family: 'Microsoft YaHei', Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        line-height: 1.8;
                        color: #333;
                        background: #fafafa;
                    }
                    .article-container {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #2c3e50;
                        border-bottom: 3px solid #3498db;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .meta {
                        color: #666;
                        font-size: 14px;
                        margin-bottom: 30px;
                        padding: 15px;
                        background: #f8f9fa;
                        border-radius: 5px;
                        border-left: 4px solid #3498db;
                    }
                    .content {
                        white-space: pre-wrap;
                        font-size: 16px;
                        line-height: 1.8;
                    }
                    .back-btn {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 15px;
                        border-radius: 5px;
                        cursor: pointer;
                    }
                </style>
            </head>
            <body>
                <button class="back-btn" onclick="window.close()">关闭</button>
                <div class="article-container">
                    <h1>${escapeHtml(article.title)}</h1>
                    <div class="meta">
                        <strong>作者：</strong>${escapeHtml(article.author)} | 
                        <strong>创建时间：</strong>${new Date(article.created_at).toLocaleString('zh-CN')}
                        ${article.updated_at !== article.created_at ? 
                            ` | <strong>更新时间：</strong>${new Date(article.updated_at).toLocaleString('zh-CN')}` : ''}
                    </div>
                    <div class="content">${escapeHtml(article.content)}</div>
                </div>
            </body>
            </html>
        `)
        
        viewWindow.document.close()
        
    } catch (error) {
        console.error('获取文章失败:', error)
        showMessage('获取文章失败: ' + error.message, 'error')
    }
}

// 编辑文章
window.editArticle = async function(articleId) {
    if (!hasPermission('edit')) {
        showMessage('您没有编辑权限', 'error')
        return
    }
    
    console.log('编辑文章ID:', articleId)
    
    try {
        const { data: article, error } = await window.supabase
            .from('articles')
            .select('*')
            .eq('id', articleId)
            .single()
        
        if (error) throw error
        
        window.currentEditingId = articleId
        document.getElementById('articleTitle').value = article.title
        document.getElementById('articleContent').value = article.content
        document.getElementById('editorInfo').textContent = `正在编辑：${article.title}`
        document.getElementById('articleEditor').classList.remove('hidden')
        document.getElementById('articleTitle').focus()
        
        console.log('文章编辑器已打开')
        
    } catch (error) {
        console.error('获取文章失败:', error)
        showMessage('获取文章失败: ' + error.message, 'error')
    }
}

// 更新连接状态
function updateConnectionStatus(message, type) {
    const statusElement = document.getElementById('connectionStatus')
    if (statusElement) {
        statusElement.innerHTML = message
        statusElement.className = `connection-status ${type}`
        
        if (type === 'success') {
            setTimeout(() => {
                statusElement.style.display = 'none'
            }, 3000)
        }
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    console.log(`消息 (${type}):`, message)
    
    // 创建消息提示元素
    const messageDiv = document.createElement('div')
    messageDiv.className = `message-toast ${type}`
    messageDiv.innerHTML = `
        <div class="message-content">
            <span class="message-text">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="message-close">×</button>
        </div>
    `
    
    // 添加样式
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        max-width: 350px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(45deg, #27ae60, #2ecc71);' : ''}
        ${type === 'error' ? 'background: linear-gradient(45deg, #e74c3c, #c0392b);' : ''}
        ${type === 'info' ? 'background: linear-gradient(45deg, #3498db, #2980b9);' : ''}
    `
    
    messageDiv.querySelector('.message-content').style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
    `
    
    messageDiv.querySelector('.message-close').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        margin-left: 10px;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `
    
    document.body.appendChild(messageDiv)
    
    // 自动移除
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.style.animation = 'slideOutRight 0.3s ease'
            setTimeout(() => messageDiv.remove(), 300)
        }
    }, type === 'error' ? 8000 : 5000)
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// 页面卸载时清理订阅
window.addEventListener('beforeunload', () => {
    if (articlesSubscription) {
        console.log('清理实时订阅')
        articlesSubscription.unsubscribe()
    }
})

// 添加CSS动画
if (!document.querySelector('#supabaseMessageStyles')) {
    const style = document.createElement('style')
    style.id = 'supabaseMessageStyles'
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .empty-state h3 {
            margin-bottom: 15px;
            color: #2c3e50;
        }
        
        .small-text {
            font-size: 12px;
            color: #999;
            margin-top: 10px;
        }
        
        .article-header {
            margin-bottom: 15px;
        }
        
        .article-title {
            margin-bottom: 8px;
            color: #2c3e50;
        }
        
        .article-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            font-size: 12px;
            color: #666;
        }
        
        .updated {
            color: #f39c12;
        }
    `
    document.head.appendChild(style)
}

console.log('Supabase文章管理模块已加载')