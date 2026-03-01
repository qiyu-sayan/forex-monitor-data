# 外汇自动交易机器人

基于GitHub Actions的自动化外汇交易系统。

## 功能
- 每30分钟自动获取EUR/USD汇率
- RSI + 移动平均线交易策略
- 企业微信实时通知
- 自动数据存储

## 配置
1. 添加GitHub Secrets:
   - `PAT_TOKEN`: GitHub个人访问令牌
   - `WECHAT_WEBHOOK`: 企业微信Webhook地址

2. 手动触发第一次运行
