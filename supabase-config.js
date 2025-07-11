// Supabase配置文件
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

// ⚠️ 重要：请替换为你的真实Supabase配置
const supabaseUrl = 'https://zhyqffuujgxcfwakolgj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoeXFmZnV1amd4Y2Z3YWtvbGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMjI5MzcsImV4cCI6MjA2Nzc5ODkzN30.ic8DTzT8NkWoV6je9t86OaFFNULtRzwz0mjDZo4VWXM'

// 初始化Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseKey)

console.log('✅ Supabase配置已加载')

// 测试连接函数
export async function testConnection() {
    try {
        const { data, error } = await supabase.from('articles').select('count', { count: 'exact', head: true })
        if (error && error.code !== 'PGRST116') {
            throw error
        }
        console.log('✅ Supabase连接测试成功')
        return true
    } catch (error) {
        console.error('❌ Supabase连接测试失败:', error.message)
        return false
    }
}

// 检查表是否存在
export async function checkTables() {
    try {
        // 检查articles表
        const { error: articlesError } = await supabase
            .from('articles')
            .select('id')
            .limit(1)
        
        // 检查user_profiles表  
        const { error: profilesError } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1)
            
        return {
            articles: !articlesError,
            profiles: !profilesError
        }
    } catch (error) {
        console.error('检查表结构失败:', error)
        return { articles: false, profiles: false }
    }
}