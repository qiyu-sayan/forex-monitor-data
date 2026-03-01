# 🚀 外汇自动交易机器人

基于GitHub Actions的自动化外汇交易系统。

## 📁 文件结构

```
.
├── .github/workflows/
│   └── forex-trader.yml    # GitHub Actions工作流
├── scripts/
│   ├── fetch-and-analyze.js # 主程序
│   └── package.json        # 依赖配置
├── data/                   # 自动生成的数据文件
│   ├── history.json        # 历史汇率
│   └── signals.json        # 交易信号
└── README.md
```

## ⚙️ 配置步骤

### 1. 上传文件到GitHub
将本文件夹所有内容上传到你的仓库。

### 2. 配置Secrets
在仓库设置中添加：
- `PAT_TOKEN`: GitHub个人访问令牌（repo权限）
- `WECHAT_WEBHOOK`: 企业微信Webhook地址

### 3. 手动触发第一次运行
1. 访问 `https://github.com/你的用户名/forex-monitor-data/actions`
2. 点击 "Forex Auto Trader" 工作流
3. 点击 "Run workflow" → "Run workflow"

## 🕐 运行频率
- 首次：手动触发
- 之后：每30分钟自动运行
- 推送代码时：自动运行

## 📊 监控货币对
- EUR/USD（欧元/美元）

## 🔔 通知规则
- **买卖信号**：立即通知
- **持仓建议**：每2小时最多一次
- **改进建议**：每24小时最多一次

## 📈 交易策略
基于RSI和移动平均线的双指标策略。

## 🛠️ 技术支持
如有问题，检查GitHub Actions日志获取详细信息。