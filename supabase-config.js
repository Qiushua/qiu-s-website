// Supabase配置和初始化
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

// 你的Supabase配置（替换为你在步骤8中获取的信息）
const supabaseUrl = 'https://zhyqffuujgxcfwakolgj.supabase.co'  // 替换为你的项目URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoeXFmZnV1amd4Y2Z3YWtvbGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMjI5MzcsImV4cCI6MjA2Nzc5ODkzN30.ic8DTzT8NkWoV6je9t86OaFFNULtRzwz0mjDZo4VWXM'  // 替换为你的公钥

// 初始化Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Supabase已初始化:', supabaseUrl)

// 检查连接状态
export async function checkConnection() {
    try {
        const { data, error } = await supabase.from('articles').select('count', { count: 'exact', head: true })
        if (error) throw error
        console.log('Supabase连接成功')
        return true
    } catch (error) {
        console.error('Supabase连接失败:', error)
        return false
    }
}