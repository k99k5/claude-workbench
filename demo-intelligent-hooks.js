// 智能化Hook自动化系统演示脚本
// 展示真正的自动化工作流价值

import { api } from '@/lib/api';
import { INTELLIGENT_HOOK_TEMPLATES } from '@/types/enhanced-hooks';

async function demonstrateIntelligentHooks() {
  console.log('🤖 开始演示智能化Hook自动化系统...\n');

  try {
    const projectPath = 'C:\\Users\\Administrator\\Desktop\\claude-workbench';

    // 1. 展示预定义的智能Hook模板
    console.log('📋 可用的智能化Hook模板:');
    console.log('='.repeat(50));
    INTELLIGENT_HOOK_TEMPLATES.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name} [${template.category}]`);
      console.log(`   描述: ${template.description}`);
      console.log(`   质量阈值: ${template.config.quality_threshold}`);
      console.log(`   阻止严重问题: ${template.config.block_critical_issues ? '是' : '否'}`);
      console.log(`   审查范围: ${template.config.review_scope}`);
      console.log(`   默认启用: ${template.enabled_by_default ? '是' : '否'}\n`);
    });

    // 2. 演示不同配置的Hook行为
    const testConfigs = [
      {
        name: '严格模式',
        config: INTELLIGENT_HOOK_TEMPLATES.find(t => t.id === 'strict-quality-gate')!.config
      },
      {
        name: '安全优先模式',
        config: INTELLIGENT_HOOK_TEMPLATES.find(t => t.id === 'security-focused')!.config
      },
      {
        name: '平衡模式',
        config: INTELLIGENT_HOOK_TEMPLATES.find(t => t.id === 'balanced-review')!.config
      }
    ];

    for (const testConfig of testConfigs) {
      console.log(`🔍 测试 "${testConfig.name}" 配置...`);
      console.log(`质量阈值: ${testConfig.config.quality_threshold}`);
      console.log(`阻止严重问题: ${testConfig.config.block_critical_issues}`);
      console.log(`阻止重要问题: ${testConfig.config.block_major_issues}`);
      console.log(`审查范围: ${testConfig.config.review_scope}\n`);

      try {
        const decision = await api.executePreCommitReview(projectPath, testConfig.config);

        console.log(`📊 Hook决策结果:`);
        if (decision.type === 'Allow') {
          console.log(`✅ 允许提交: ${decision.message}`);
          if (decision.suggestions.length > 0) {
            console.log('💡 改进建议:');
            decision.suggestions.forEach((suggestion, idx) => {
              console.log(`  ${idx + 1}. ${suggestion}`);
            });
          }
        } else {
          console.log(`❌ 阻止提交: ${decision.reason}`);
          console.log(`📝 代码审查摘要: ${decision.details.summary}`);
          console.log(`📊 质量评分: ${decision.details.overall_score.toFixed(1)}/10.0`);
          console.log(`🚨 发现问题: ${decision.details.issues.length}个`);

          // 按严重程度分组显示问题
          const groupedIssues = {
            critical: decision.details.issues.filter(i => i.severity === 'critical'),
            major: decision.details.issues.filter(i => i.severity === 'major'),
            minor: decision.details.issues.filter(i => i.severity === 'minor'),
            info: decision.details.issues.filter(i => i.severity === 'info')
          };

          Object.entries(groupedIssues).forEach(([severity, issues]) => {
            if (issues.length > 0) {
              console.log(`\n🔴 ${severity.toUpperCase()} (${issues.length}个):`);
              issues.slice(0, 3).forEach(issue => { // 只显示前3个
                console.log(`  • [${issue.category}] ${issue.message}`);
                if (issue.line) console.log(`    位置: ${issue.file_path}:${issue.line}`);
              });
              if (issues.length > 3) {
                console.log(`  ... 还有 ${issues.length - 3} 个 ${severity} 问题`);
              }
            }
          });

          console.log('\n💡 修复建议:');
          decision.suggestions.forEach((suggestion, idx) => {
            console.log(`  ${idx + 1}. ${suggestion}`);
          });
        }

        console.log('\n' + '─'.repeat(60) + '\n');

      } catch (error) {
        console.error(`❌ 测试 "${testConfig.name}" 时发生错误:`, error);
        console.log('\n' + '─'.repeat(60) + '\n');
      }
    }

    // 3. 展示Hook系统的智能化特性
    console.log('🧠 智能化Hook系统的核心特性:');
    console.log('='.repeat(50));
    console.log('✨ 1. 智能文件检测:');
    console.log('   - 自动获取git staged文件');
    console.log('   - 智能过滤排除node_modules、dist等');
    console.log('   - 只审查代码文件(js/ts/py/rs/go等)');
    console.log('   - 支持自定义排除模式\n');

    console.log('✨ 2. 专业化代码审查:');
    console.log('   - 集成code-reviewer专业化Agent');
    console.log('   - 多维度分析: 安全性、性能、可维护性、代码风格');
    console.log('   - 智能问题分类和优先级排序');
    console.log('   - 基于OWASP等最佳实践的检查规则\n');

    console.log('✨ 3. 智能决策引擎:');
    console.log('   - 基于代码质量评分的自动决策');
    console.log('   - 可配置的严重程度阈值');
    console.log('   - 上下文感知的建议生成');
    console.log('   - 支持不同项目需求的灵活配置\n');

    console.log('✨ 4. 开发体验优化:');
    console.log('   - 详细的问题报告和修复建议');
    console.log('   - 渐进式质量改进指导');
    console.log('   - 团队代码质量标准化');
    console.log('   - 与现有工作流无缝集成\n');

    // 4. 实际应用场景示例
    console.log('💼 实际应用场景:');
    console.log('='.repeat(50));
    console.log('🔒 场景1: 安全敏感项目');
    console.log('   配置: 启用"安全优先"模板');
    console.log('   效果: 自动阻止所有严重安全问题，确保代码安全');
    console.log('   价值: 防止安全漏洞进入生产环境\n');

    console.log('⚡ 场景2: 高性能应用');
    console.log('   配置: 启用"性能监控"模板');
    console.log('   效果: 检测N+1查询、大文件读取等性能问题');
    console.log('   价值: 保持应用性能，防止性能回归\n');

    console.log('🏢 场景3: 企业开发团队');
    console.log('   配置: 启用"严格质量门禁"模板');
    console.log('   效果: 统一代码质量标准，阻止低质量代码');
    console.log('   价值: 提高团队整体代码质量和可维护性\n');

    console.log('🚀 场景4: 快速迭代项目');
    console.log('   配置: 启用"平衡模式"模板');
    console.log('   效果: 平衡质量和开发速度，提供改进建议');
    console.log('   价值: 在保证基本质量的同时不阻碍开发效率\n');

    console.log('🎉 智能化Hook自动化系统演示完成！');
    console.log('\n🌟 这展示了真正的工作流自动化价值:');
    console.log('   - 从简单命令执行到智能决策制定');
    console.log('   - 与专业化Agent系统的深度集成');
    console.log('   - 基于实际代码质量的智能提交控制');
    console.log('   - 可配置的质量标准和团队协作流程');
    console.log('   - 提高代码质量的同时优化开发体验');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  // 添加到全局对象，可以在控制台中调用
  window.demonstrateIntelligentHooks = demonstrateIntelligentHooks;
  console.log('💡 在浏览器控制台中运行 demonstrateIntelligentHooks() 来体验智能化Hook自动化功能');
}

export { demonstrateIntelligentHooks };