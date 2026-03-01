const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置 - 从环境变量读取
const CONFIG = {
  // 监控的货币对
  currencyPairs: ['EUR/USD'],
  
  // 企业微信Webhook（从GitHub Secrets读取）
  wechatWebhook: process.env.WECHAT_WEBHOOK || '',
  
  // 交易策略参数
  strategy: {
    rsiPeriod: 14,
    rsiOverbought: 70,
    rsiOversold: 30,
    maShortPeriod: 10,
    maLongPeriod: 30
  }
};

// 数据目录
const dataDir = path.join(__dirname, '../data');
const historyFile = path.join(dataDir, 'history.json');
const signalsFile = path.join(dataDir, 'signals.json');

// 确保目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class ForexTrader {
  constructor() {
    this.history = this.loadHistory();
    this.signals = this.loadSignals();
    this.lastNotificationTime = {};
  }

  loadHistory() {
    try {
      if (fs.existsSync(historyFile)) {
        return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
    return { updates: [], data: {} };
  }

  loadSignals() {
    try {
      if (fs.existsSync(signalsFile)) {
        return JSON.parse(fs.readFileSync(signalsFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading signals:', error);
    }
    return { signals: [] };
  }

  async fetchForexData() {
    console.log('🔄 获取外汇数据...');
    
    const results = {};
    const timestamp = new Date().toISOString();
    
    try {
      // 使用Frankfurter API获取EUR/USD数据
      const response = await axios.get('https://api.frankfurter.app/latest', {
        params: {
          from: 'EUR',
          to: 'USD'
        },
        timeout: 10000
      });
      
      const rate = response.data.rates.USD;
      console.log(`✅ EUR/USD: ${rate}`);
      
      results['EUR/USD'] = {
        rate,
        timestamp,
        high: rate,
        low: rate,
        change: 0
      };
      
      // 保存到历史
      this.saveDataPoint('EUR/USD', rate, timestamp);
      
    } catch (error) {
      console.error('❌ 获取外汇数据失败:', error.message);
      // 如果API失败，使用最后一次有效数据
      if (this.history.data['EUR/USD'] && this.history.data['EUR/USD'].length > 0) {
        const lastData = this.history.data['EUR/USD'][this.history.data['EUR/USD'].length - 1];
        results['EUR/USD'] = {
          rate: lastData.rate,
          timestamp: lastData.timestamp,
          high: lastData.rate,
          low: lastData.rate,
          change: 0
        };
        console.log(`📊 使用上次数据: ${lastData.rate}`);
      } else {
        console.log('⚠️ 无历史数据可用');
        return null;
      }
    }
    
    return results;
  }

  saveDataPoint(pair, rate, timestamp) {
    if (!this.history.data[pair]) {
      this.history.data[pair] = [];
    }
    
    this.history.data[pair].push({ rate, timestamp });
    
    // 只保留最近1000个数据点
    if (this.history.data[pair].length > 1000) {
      this.history.data[pair] = this.history.data[pair].slice(-1000);
    }
    
    this.history.updates.push({ pair, rate, timestamp });
    
    // 保存历史文件
    fs.writeFileSync(historyFile, JSON.stringify(this.history, null, 2));
  }

  // 计算RSI指标
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[prices.length - i] - prices[prices.length - i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // 计算移动平均线
  calculateMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  // 简单交易策略：RSI + 移动平均线
  analyzeStrategy(pair, currentRate, historyData) {
    if (!historyData || historyData.length < CONFIG.strategy.maLongPeriod) {
      return { 
        signal: 'HOLD', 
        reason: '数据不足，继续观察',
        indicators: {
          rsi: 'N/A',
          maShort: 'N/A',
          maLong: 'N/A',
          currentRate: currentRate.toFixed(4)
        }
      };
    }
    
    const prices = historyData.map(d => d.rate);
    
    // 计算指标
    const rsi = this.calculateRSI(prices, CONFIG.strategy.rsiPeriod);
    const maShort = this.calculateMA(prices, CONFIG.strategy.maShortPeriod);
    const maLong = this.calculateMA(prices, CONFIG.strategy.maLongPeriod);
    
    // 生成交易信号
    let signal = 'HOLD';
    let reason = '';
    
    if (rsi < CONFIG.strategy.rsiOversold && currentRate > maShort && maShort > maLong) {
      signal = 'BUY';
      reason = `RSI超卖(${rsi.toFixed(1)})，短期均线上穿长期均线`;
    } else if (rsi > CONFIG.strategy.rsiOverbought && currentRate < maShort && maShort < maLong) {
      signal = 'SELL';
      reason = `RSI超买(${rsi.toFixed(1)})，短期均线下穿长期均线`;
    } else {
      signal = 'HOLD';
      if (rsi < 40 && maShort > maLong) {
        reason = `接近买入条件 (RSI: ${rsi.toFixed(1)})`;
      } else if (rsi > 60 && maShort < maLong) {
        reason = `接近卖出条件 (RSI: ${rsi.toFixed(1)})`;
      } else {
        reason = `中性观望 (RSI: ${rsi.toFixed(1)})`;
      }
    }
    
    return {
      signal,
      reason,
      indicators: {
        rsi: rsi.toFixed(1),
        maShort: maShort.toFixed(4),
        maLong: maLong.toFixed(4),
        currentRate: currentRate.toFixed(4)
      }
    };
  }

  async sendWeChatNotification(signal, pair, indicators, reason) {
    // 检查是否最近发送过相同信号（避免重复通知）
    const signalKey = `${pair}_${signal}`;
    const now = Date.now();
    const lastTime = this.lastNotificationTime[signalKey] || 0;
    
    // 相同信号至少间隔2小时才再次通知
    if (signal === 'HOLD' && (now - lastTime) < 2 * 60 * 60 * 1000) {
      console.log(`⏸️ 跳过持仓通知（2小时内已发送过）`);
      return;
    }
    
    if (!CONFIG.wechatWebhook) {
      console.log('⚠️ 企业微信Webhook未配置');
      return;
    }
    
    const messageTypes = {
      BUY: '🟢 买入信号',
      SELL: '🔴 卖出信号',
      HOLD: '🟡 持仓建议'
    };
    
    const msgType = signal === 'HOLD' ? 'text' : 'markdown';
    const timestamp = new Date().toLocaleString('zh-CN');
    
    let content;
    if (signal === 'HOLD') {
      content = {
        content: `${messageTypes[signal]}\n货币对: ${pair}\n当前价: ${indicators.currentRate}\nRSI: ${indicators.rsi}\n${reason}\n时间: ${timestamp}`
      };
    } else {
      content = {
        content: `## ${messageTypes[signal]}\n**货币对:** ${pair}\n**当前价格:** ${indicators.currentRate}\n**RSI指标:** ${indicators.rsi}\n**短期MA:** ${indicators.maShort}\n**长期MA:** ${indicators.maLong}\n**信号理由:** ${reason}\n**时间:** ${timestamp}`
      };
    }
    
    try {
      await axios.post(CONFIG.wechatWebhook, {
        msgtype: msgType,
        [msgType]: content
      }, { timeout: 5000 });
      
      console.log(`✅ 企业微信通知已发送: ${signal}`);
      this.lastNotificationTime[signalKey] = now;
      
    } catch (error) {
      console.error('❌ 发送企业微信通知失败:', error.message);
    }
  }

  saveSignal(signal, pair, indicators, reason) {
    const signalData = {
      timestamp: new Date().toISOString(),
      pair,
      signal,
      indicators,
      reason
    };
    
    this.signals.signals.push(signalData);
    
    // 只保留最近100个信号
    if (this.signals.signals.length > 100) {
      this.signals.signals = this.signals.signals.slice(-100);
    }
    
    fs.writeFileSync(signalsFile, JSON.stringify(this.signals, null, 2));
    
    return signalData;
  }

  async run() {
    console.log('🚀 === 外汇自动交易机器人开始运行 ===');
    console.log('⏰ 时间:', new Date().toLocaleString('zh-CN'));
    console.log('📊 监控货币对:', CONFIG.currencyPairs.join(', '));
    
    // 1. 获取数据
    const forexData = await this.fetchForexData();
    
    if (!forexData) {
      console.log('❌ 无法获取外汇数据，本次运行终止');
      return;
    }
    
    // 2. 对每个货币对运行策略
    for (const [pair, data] of Object.entries(forexData)) {
      console.log(`\n📈 分析 ${pair}:`);
      console.log(`💰 当前汇率: ${data.rate}`);
      
      // 3. 运行交易策略
      const historyData = this.history.data[pair] || [];
      const analysis = this.analyzeStrategy(pair, data.rate, historyData);
      
      console.log(`📢 信号: ${analysis.signal}`);
      console.log(`📝 理由: ${analysis.reason}`);
      console.log(`📊 RSI: ${analysis.indicators.rsi}`);
      console.log(`📈 短期MA: ${analysis.indicators.maShort}, 长期MA: ${analysis.indicators.maLong}`);
      
      // 4. 保存信号
      const signalData = this.saveSignal(
        analysis.signal,
        pair,
        analysis.indicators,
        analysis.reason
      );
      
      // 5. 发送企业微信通知
      await this.sendWeChatNotification(
        analysis.signal,
        pair,
        analysis.indicators,
        analysis.reason
      );
      
      // 6. 每24小时生成一次改进建议
      if (historyData.length > 100) {
        this.generateImprovementSuggestions(pair, historyData, analysis);
      }
    }
    
    console.log('\n✅ === 外汇自动交易机器人运行完成 ===');
    console.log('📁 数据已保存到:', dataDir);
  }

  generateImprovementSuggestions(pair, historyData, currentAnalysis) {
    // 查找最近的改进建议
    const lastSuggestion = this.signals.signals
      .filter(s => s.type === 'STRATEGY_IMPROVEMENT')
      .pop();
    
    const hoursSinceLast = lastSuggestion 
      ? (new Date() - new Date(lastSuggestion.timestamp)) / (1000 * 60 * 60)
      : 24;
    
    // 每24小时最多发送一次改进建议
    if (hoursSinceLast >= 24) {
      // 分析策略表现
      const recentSignals = this.signals.signals
        .filter(s => s.pair === pair && s.signal !== 'HOLD')
        .slice(-20);
      
      let suggestion = '';
      let confidence = 0.5;
      
      if (recentSignals.length > 5) {
        // 简单分析：如果最近信号准确率低，建议调整参数
        suggestion = '建议回测调整RSI阈值或均线周期';
        confidence = 0.7;
      } else {
        suggestion = '数据积累中，建议继续观察市场表现';
        confidence = 0.6;
      }
      
      const improvement = {
        type: 'STRATEGY_IMPROVEMENT',
        pair,
        timestamp: new Date().toISOString(),
        suggestion,
        confidence,
        currentRSI: currentAnalysis.indicators.rsi
      };
      
      this.signals.signals.push(improvement);
      console.log('💡 策略改进建议已生成');
      
      // 发送改进建议到企业微信
      if (CONFIG.wechatWebhook && hoursSinceLast >= 24) {
        axios.post(CONFIG.wechatWebhook, {
          msgtype: 'text',
          text: {
            content: `🤖 交易机器人改进建议\n货币对: ${pair}\n当前RSI: ${currentAnalysis.indicators.rsi}\n建议: ${suggestion}\n置信度: ${confidence}\n时间: ${new Date().toLocaleString('zh-CN')}`
          }
        }, { timeout: 5000 }).catch(() => {
          console.log('⚠️ 改进建议发送失败');
        });
      }
    }
  }
}

// 主执行函数
async function main() {
  try {
    const trader = new ForexTrader();
    await trader.run();
    process.exit(0);
  } catch (error) {
    console.error('❌ 程序运行出错:', error);
    process.exit(1);
  }
}

// 执行
main();