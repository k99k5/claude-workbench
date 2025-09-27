// 代码审查功能演示脚本
// 展示真正的专业化Agent功能

import { api } from '@/lib/api';

async function demonstrateCodeReview() {
  console.log('🔍 开始演示专业化代码审查功能...\n');

  try {
    // 1. 初始化专业化系统
    console.log('📋 初始化专业化系统...');
    await api.initSubagentSystem();
    console.log('✅ 专业化系统初始化完成\n');

    // 2. 列出可用的专业化类型
    console.log('📊 获取可用的专业化类型...');
    const specialties = await api.listSubagentSpecialties();
    console.log('可用的专业化类型：');
    specialties.forEach(s => {
      console.log(`  - ${s.display_name}: ${s.description}`);
    });
    console.log('');

    // 3. 测试智能路由
    console.log('🧠 测试智能路由功能...');
    const routingTests = [
      "请帮我审查这个代码的安全性",
      "检查代码质量和性能问题",
      "Review the code for security vulnerabilities"
    ];

    for (const request of routingTests) {
      const decision = await api.routeToSubagent(request);
      console.log(`请求: "${request}"`);
      console.log(`路由结果: ${decision.specialty_type} (置信度: ${decision.confidence_score.toFixed(2)})`);
      console.log(`原因: ${decision.reasoning}\n`);
    }

    // 4. 执行真正的代码审查
    console.log('🔍 执行专业化代码审查...');
    const testFile = 'C:\\Users\\Administrator\\Desktop\\claude-workbench\\test-code-review.js';

    console.log('审查文件:', testFile);
    console.log('正在分析代码...\n');

    const reviewResult = await api.executeCodeReview([testFile], 'all');

    // 5. 展示审查结果
    console.log('📊 代码审查结果:');
    console.log('='.repeat(50));
    console.log(`总体评分: ${reviewResult.overall_score.toFixed(1)}/10.0`);
    console.log(`审查文件数: ${reviewResult.files_reviewed.length}`);
    console.log(`发现问题数: ${reviewResult.issues.length}`);
    console.log(`摘要: ${reviewResult.summary}\n`);

    // 6. 按严重程度分类显示问题
    const severityGroups = {
      critical: reviewResult.issues.filter(i => i.severity === 'critical'),
      major: reviewResult.issues.filter(i => i.severity === 'major'),
      minor: reviewResult.issues.filter(i => i.severity === 'minor'),
      info: reviewResult.issues.filter(i => i.severity === 'info')
    };

    Object.entries(severityGroups).forEach(([severity, issues]) => {
      if (issues.length > 0) {
        console.log(`\n🚨 ${severity.toUpperCase()} 问题 (${issues.length}个):`);
        issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. [${issue.category}] ${issue.message}`);
          if (issue.line) console.log(`     文件: ${issue.file_path}:${issue.line}`);
          if (issue.suggestion) console.log(`     建议: ${issue.suggestion}`);
          console.log('');
        });
      }
    });

    // 7. 显示改进建议
    console.log('\n💡 改进建议:');
    reviewResult.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log('\n🎉 代码审查演示完成！');
    console.log('\n✨ 这展示了真正的专业化功能:');
    console.log('   - 智能路由选择合适的专业Agent');
    console.log('   - 执行具体的静态代码分析');
    console.log('   - 提供详细的问题报告和改进建议');
    console.log('   - 基于专业知识库的安全性、性能、可维护性检查');

  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  }
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
  // 添加到全局对象，可以在控制台中调用
  window.demonstrateCodeReview = demonstrateCodeReview;
  console.log('💡 在浏览器控制台中运行 demonstrateCodeReview() 来体验专业化代码审查功能');
}

export { demonstrateCodeReview };