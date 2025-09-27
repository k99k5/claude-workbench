// 这是一个包含多种代码问题的测试文件
// 用于演示code-reviewer专业化Agent的真实功能

const express = require('express');
const app = express();

// 硬编码的密钥 - 安全问题
const SECRET_KEY = "my-secret-password-123";
const API_TOKEN = 'sk-1234567890abcdef';

// SQL注入风险 - 安全问题
function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return database.query(query);
}

// XSS风险 - 安全问题
function displayMessage(message) {
    document.getElementById('content').innerHTML = message;
}

// N+1查询问题 - 性能问题
async function loadUsersWithPosts() {
    const users = await User.findAll();
    for (const user of users) {
        user.posts = await Post.findAllForUser(user.id);
    }
    return users;
}

// 大文件读取 - 性能问题
function processLargeFile(filename) {
    const data = fs.readFileSync(filename);
    return processData(data);
}

// 函数过长 - 可维护性问题
function processComplexData(input) {
    let result = {};

    // 这是一个非常长的函数，包含很多逻辑
    if (input.type === 'user') {
        result.id = input.id;
        result.name = input.name;
        result.email = input.email;
        result.created = new Date(input.created);
        result.updated = new Date(input.updated);

        if (input.profile) {
            result.profile = {
                bio: input.profile.bio,
                avatar: input.profile.avatar,
                social: input.profile.social
            };
        }

        if (input.settings) {
            result.settings = {
                theme: input.settings.theme,
                language: input.settings.language,
                notifications: input.settings.notifications
            };
        }

        if (input.permissions) {
            result.permissions = input.permissions.map(p => ({
                id: p.id,
                name: p.name,
                scope: p.scope
            }));
        }

        // TODO: 需要添加更多字段处理逻辑
        // FIXME: 这里有个bug需要修复

        result.computed = {
            fullName: `${result.name.first} ${result.name.last}`,
            displayName: result.name.display || result.name.first,
            initials: `${result.name.first[0]}${result.name.last[0]}`
        };

    } else if (input.type === 'admin') {
        // 管理员逻辑
        result = processAdminData(input);
    }

    return result;
}

// 行过长 - 代码风格问题
const verylongvariablenamethatshouldprobablybeshorterforbetterreadabilityandmaintainabilityinthefuture = "This line is way too long and violates coding standards for line length which should typically be under 120 characters for better readability";

console.log('Code review test file created');

module.exports = { getUserData, displayMessage, processLargeFile };