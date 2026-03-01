# 🚀 外汇自动交易机器人

基于GitHub Actions和企业微信的自动化外汇交易监控系统。

## ✨ 功能特性

- **云端运行**：GitHub Actions每30分钟自动执行
- **智能策略**：RSI + 移动平均线双指标策略
- **实时通知**：企业微信推送买卖信号
- **数据持久化**：GitHub仓库存储历史数据
- **策略优化**：自动生成改进建议

## 📊 监控货币对

- EUR/USD（欧元/美元）

## 🔔 通知类型

1. **🟢 买入信号** - RSI超卖 + 均线金叉
2. **🔴 卖出信号** - RSI超买 + 均线死叉  
3. **🟡 持仓建议** - 当前市场分析（每2小时一次）
4. **🤖 机器人改进** - 策略优化建议（每24小时一次）

## 🛠️ 技术架构

```
GitHub Actions (每30分钟)
    ↓
Node.js脚本 (数据分析)
    ↓
Frankfurter API (汇率数据)
    ↓
技术指标计算 (RSI, MA)
    ↓
交易信号生成
    ↓
企业微信通知
    ↓
GitHub仓库存储
```

## ⚙️ 安装配置

### 1. 仓库设置
- Fork或克隆本仓库
- 添加GitHub Secrets：
  - `PAT_TOKEN`: GitHub个人访问令牌（repo权限）
  - `WECHAT_WEBHOOK`: 企业微信Webhook地址

### 2. 手动上传文件
将本文件夹所有内容上传到你的GitHub仓库。

### 3. 系统自动运行
上传完成后，系统将：
- 立即运行一次
- 之后每30分钟自动运行
- 发送通知到企业微信

## 📈 交易策略

### 指标参数
- **RSI周期**: 14天
- **RSI超买线**: 70
- **RSI超卖线**: 30
- **短期均线**: 10天
- **长期均线**: 30天

### 信号逻辑
- **买入**: RSI < 30 + 短期MA > 长期MA
- **卖出**: RSI > 70 + 短期MA < 长期MA
- **持仓**: 其他情况

## 📁 文件结构

```
forex-monitor-data/
├── .github/workflows/
│   └── forex-trader.yml    # GitHub Actions配置
├── scripts/
│   ├── fetch-and-analyze.js # 主程序
│   └── package.json        # 依赖配置
├── data/                   # 自动生成的数据文件
│   ├── history.json        # 历史汇率数据
│   └── signals.json        # 交易信号记录
└── README.md
```

## 🔧 自定义配置

修改 `scripts/fetch-and-analyze.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  currencyPairs: ['EUR/USD', 'USD/JPY'], // 添加更多货币对
  strategy: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    maShortPeriod: 10,
    maLongPeriod: 30
  }
};
```

## 🚀 快速开始

1. **下载本文件夹**到本地
2. **上传到GitHub**你的仓库
3. **配置Secrets**（PAT_TOKEN, WECHAT_WEBHOOK）
4. **等待运行**（首次约1-2分钟内开始）

## 📝 注意事项

1. **免费额度**：GitHub Actions每月2000分钟免费
2. **API限制**：Frankfurter API有频率限制
3. **模拟交易**：当前仅为策略模拟，不涉及真实资金
4. **风险提示**：外汇交易风险高，建议先用模拟账户

## 🔮 未来计划

- [ ] 添加更多技术指标
- [ ] 实现多时间框架分析
- [ ] 添加风险管理模块
- [ ] 支持回测功能
- [ ] 集成更多消息平台

## 📄 许可证

MIT License